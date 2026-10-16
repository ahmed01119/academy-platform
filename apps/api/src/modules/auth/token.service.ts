import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { type JwtSignOptions, JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import { ErrorCode, type TenantRole } from '@academy/shared';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  role?: TenantRole;
  branchId?: string;
}

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
   * Generates short-lived access token and long-lived rotated refresh token.
   */
  async generateTokens(
    userId: string,
    email: string,
    activeTenant?: { tenantId: string; role: TenantRole; branchId?: string },
    deviceInfo?: string,
    ipAddress?: string,
    existingFamilyId?: string,
  ): Promise<GeneratedTokens> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      tenantId: activeTenant?.tenantId,
      role: activeTenant?.role,
      branchId: activeTenant?.branchId,
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

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        familyId,
        deviceInfo,
        ipAddress,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: plainRefreshToken,
      expiresIn: 15 * 60, // 15 mins
    };
  }

  /**
   * Rotates a refresh token with strict reuse detection.
   * If a revoked token is used again, the entire family is compromised and revoked!
   */
  async rotateRefreshToken(
    plainRefreshToken: string,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<{ tokens: GeneratedTokens; userId: string; email: string }> {
    const tokenHash = this.hashToken(plainRefreshToken);

    const existingToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existingToken) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid refresh token',
      });
    }

    // Reuse detection: If token was already revoked, someone is replaying it!
    if (existingToken.isRevoked) {
      // Invalidate the ENTIRE token family for this compromised session
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existingToken.familyId },
        data: { isRevoked: true },
      });

      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Compromised token detected. All sessions in this family have been revoked.',
      });
    }

    if (existingToken.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'Refresh token has expired',
      });
    }

    // Revoke the current token as it is being replaced
    await this.prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { isRevoked: true },
    });

    // Generate new token pair in the SAME family
    const tokens = await this.generateTokens(
      existingToken.userId,
      existingToken.user.email,
      undefined,
      deviceInfo,
      ipAddress,
      existingToken.familyId,
    );

    return {
      tokens,
      userId: existingToken.userId,
      email: existingToken.user.email,
    };
  }

  /**
   * Revokes a specific refresh token (used on logout).
   */
  async revokeRefreshToken(plainRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(plainRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    });
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
