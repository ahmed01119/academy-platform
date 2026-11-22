import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { type JwtSignOptions, JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '@academy/database';
import { ErrorCode, type TenantRole } from '@academy/shared';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  role?: TenantRole;
  branchId?: string;
  isPlatformSuperAdmin?: boolean;
  isPlatformOwner?: boolean;
  /** users.session_version at issuance (K13b). Missing on tokens issued before K13b, treated as 0. */
  sv?: number;
}

/** How long after a rotation the previous refresh token is still accepted once (lost-response grace window). */
export const REFRESH_REUSE_GRACE_MS = 60_000;

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /**
   * Hashes a random token with SHA-256 to ensure secrets are never stored in plaintext.
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateSecureRandomString(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Reuse grace window: when an already-rotated refresh token comes back and its family's newest token was issued less
   * than REFRESH_REUSE_GRACE_MS ago, the earlier answer most likely never reached the browser (two parallel requests,
   * or a request cut off by a page change). That successor is revoked and the caller issues a fresh one, so exactly one
   * live token remains and the user stays signed in. Outside the window a reuse is still treated as theft.
   */
  private async takeOverRecentSuccessor(
    tx: Prisma.TransactionClient,
    familyId: string,
  ): Promise<boolean> {
    const successor = await tx.refreshToken.findFirst({
      where: {
        familyId,
        isRevoked: false,
        createdAt: { gte: new Date(Date.now() - REFRESH_REUSE_GRACE_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!successor) return false;
    const revoked = await tx.refreshToken.updateMany({
      where: { id: successor.id, isRevoked: false },
      data: { isRevoked: true },
    });
    return revoked.count === 1;
  }

  /**
   * Generates short-lived access token and long-lived rotated refresh token.
   */
  async generateTokens(
    userId: string,
    email: string,
    activeTenant?: { tenantId: string; role: TenantRole; branchId?: string },
    deviceInfo?: string,
    ipAddress?: string,
    existingFamilyId?: string,
    isPlatformSuperAdmin?: boolean,
    isPlatformOwner?: boolean,
    /** Session version to stamp; read from the user when omitted. */
    sessionVersion?: number,
    /** Transaction client when issuing inside a transaction (e.g. right after a password change). */
    client?: Prisma.TransactionClient,
  ): Promise<GeneratedTokens> {
    const db = client ?? this.prisma;
    const sv =
      sessionVersion ??
      (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { sessionVersion: true } }))
        .sessionVersion;
    const payload: JwtPayload = {
      sub: userId,
      email,
      tenantId: activeTenant?.tenantId,
      role: activeTenant?.role,
      branchId: activeTenant?.branchId,
      isPlatformSuperAdmin: isPlatformSuperAdmin ?? false,
      isPlatformOwner: isPlatformOwner ?? false,
      sv,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.jwtSecret,
      expiresIn: this.config.jwtExpiresIn as JwtSignOptions['expiresIn'],
    });

    const plainRefreshToken = this.generateSecureRandomString(40);
    const tokenHash = this.hashToken(plainRefreshToken);
    const familyId = existingFamilyId ?? crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.config.refreshTokenExpiresDays);

    await db.refreshToken.create({
      data: {
        userId,
        tokenHash,
        familyId,
        deviceInfo,
        ipAddress,
        expiresAt,
        sessionVersion: sv,
      },
    });

    return {
      accessToken,
      refreshToken: plainRefreshToken,
      expiresIn: 15 * 60, // 15 mins
    };
  }

  /**
   * Rotates a refresh token with reuse detection and session-version checks (K13b).
   *
   * Concurrency: password change/reset, suspension and admin revocation all UPDATE the user row (bumping
   * session_version, which takes the row lock) BEFORE revoking refresh tokens. Rotation takes FOR SHARE on the same
   * row, so it either waits for such a transaction and then sees the new version (and refuses the old token), or runs
   * first - in which case the token it issues carries the old version and is revoked by the password change's next
   * statement. An old refresh token can therefore never produce tokens carrying the new version.
   */
  async rotateRefreshToken(
    plainRefreshToken: string,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<{ tokens: GeneratedTokens; userId: string; email: string }> {
    const tokenHash = this.hashToken(plainRefreshToken);
    const result = await this.prisma.$transaction(async (tx) => {
      const existingToken = await tx.refreshToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, familyId: true, expiresAt: true },
      });
      if (!existingToken) {
        throw new UnauthorizedException({
          code: ErrorCode.TOKEN_INVALID,
          message: 'Invalid refresh token',
        });
      }

      const [user] = await tx.$queryRaw<
        Array<{
          email: string;
          is_platform_super_admin: boolean;
          is_platform_owner: boolean;
          is_suspended: boolean;
          session_version: number;
        }>
      >`SELECT email, is_platform_super_admin, is_platform_owner, is_suspended, session_version
          FROM public.users WHERE id = ${existingToken.userId}::uuid FOR SHARE`;
      if (!user) {
        throw new UnauthorizedException({
          code: ErrorCode.TOKEN_INVALID,
          message: 'Invalid refresh token',
        });
      }

      // Re-read after the lock: the transaction we may have waited for can have revoked this token.
      const current = await tx.refreshToken.findUniqueOrThrow({
        where: { id: existingToken.id },
        select: { isRevoked: true, sessionVersion: true },
      });

      if (current.isRevoked) {
        if (current.sessionVersion !== user.session_version) {
          // Revoked by a password change / suspension / revocation, not reuse.
          return { revokedSession: true as const };
        }
        // A token rotated moments ago whose answer never reached the browser (request cut off by a navigation or a
        // network blip): the browser still holds it. Within the grace window this is not theft.
        if (!(await this.takeOverRecentSuccessor(tx, existingToken.familyId))) {
          await tx.refreshToken.updateMany({
            where: { familyId: existingToken.familyId },
            data: { isRevoked: true },
          });
          return { compromised: true as const };
        }
      }

      if (existingToken.expiresAt < new Date()) {
        throw new UnauthorizedException({
          code: ErrorCode.TOKEN_EXPIRED,
          message: 'Refresh token has expired',
        });
      }

      if (current.sessionVersion !== user.session_version || user.is_suspended) {
        await tx.refreshToken.updateMany({
          where: { familyId: existingToken.familyId },
          data: { isRevoked: true },
        });
        return { revokedSession: true as const };
      }

      // Consume exactly once: a concurrent rotation of the same token loses this conditional update.
      const updateResult = current.isRevoked
        ? { count: 1 } // grace path above: already revoked, its unused successor was just revoked too
        : await tx.refreshToken.updateMany({
            where: { id: existingToken.id, isRevoked: false, sessionVersion: user.session_version },
            data: { isRevoked: true },
          });
      if (
        updateResult.count === 0 &&
        !(await this.takeOverRecentSuccessor(tx, existingToken.familyId))
      ) {
        await tx.refreshToken.updateMany({
          where: { familyId: existingToken.familyId },
          data: { isRevoked: true },
        });
        return { compromised: true as const };
      }

      const payload: JwtPayload = {
        sub: existingToken.userId,
        email: user.email,
        isPlatformSuperAdmin: user.is_platform_super_admin,
        isPlatformOwner: user.is_platform_owner,
        sv: user.session_version,
      };

      const accessToken = await this.jwtService.signAsync(payload, {
        secret: this.config.jwtSecret,
        expiresIn: this.config.jwtExpiresIn as JwtSignOptions['expiresIn'],
      });

      const newPlainRefreshToken = this.generateSecureRandomString(40);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.config.refreshTokenExpiresDays);

      await tx.refreshToken.create({
        data: {
          userId: existingToken.userId,
          tokenHash: this.hashToken(newPlainRefreshToken),
          familyId: existingToken.familyId,
          deviceInfo,
          ipAddress,
          expiresAt,
          sessionVersion: user.session_version,
        },
      });

      return {
        tokens: {
          accessToken,
          refreshToken: newPlainRefreshToken,
          expiresIn: 15 * 60, // 15 mins
        },
        userId: existingToken.userId,
        email: user.email,
      };
    });

    if ('compromised' in result) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Refresh token reuse detected; session family revoked',
      });
    }
    if ('revokedSession' in result) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Session is no longer valid. Please sign in again.',
      });
    }

    return result;
  }

  /**
   * Revokes a specific refresh token session and its family (used on logout).
   */
  async revokeRefreshToken(plainRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(plainRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (existing) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId },
        data: { isRevoked: true },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    }
  }

  /**
   * Revokes all refresh tokens for a user (used on password reset or account compromise).
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }
}
