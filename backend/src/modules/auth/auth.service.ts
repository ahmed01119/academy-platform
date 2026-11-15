import * as crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';
import { TokenService, type GeneratedTokens } from './token.service';
import { rateLimitIpKey } from '../../common/client-ip';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '../../config/app-config.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ErrorCode,
  type TenantRole,
  type AuthResponse,
  type ChangePasswordRequest,
  type ForgotPasswordRequest,
  type LoginRequest,
  type RegisterRequest,
  type RegisterResponse,
  type ResetPasswordRequest,
  RESET_CODE_PATTERN,
  RESET_LINK_TOKEN_PATTERN,
  type TenantMembershipSummary,
  type UpdateUserProfileRequest,
  type UserSummary,
} from '@academy/shared';

/** Password reset codes and links expire after 5 minutes (K1). */
const PASSWORD_RESET_TTL_MS = 5 * 60 * 1000;
/** Wrong attempts allowed per issued 6-digit code before it is cancelled. */
const RESET_CODE_ATTEMPT_LIMIT = 5;
/** Failed code attempts per account per rolling 24 h before code entry is suspended (the link still works). */
const RESET_CODE_DAILY_FAILURE_LIMIT = 10;

const resetCodeAttemptsKey = (email: string) => `ratelimit:reset-code-attempts:${email}`;
const resetCodeDailyFailuresKey = (email: string) => `ratelimit:reset-code-failures-daily:${email}`;

/** The single generic error for every reset failure (unknown e-mail, wrong/expired/cancelled code or link, suspended code entry). */
function invalidResetError(): BadRequestException {
  return new BadRequestException({
    code: ErrorCode.TOKEN_INVALID,
    message:
      'رمز التحقق أو الرابط غير صالح أو منتهي الصلاحية. استخدم الرابط من أحدث رسالة أو اطلب رمزاً جديداً (The code or link is invalid or has expired. Use the link from your most recent email, or request a new one.)',
  });
}

/** True when a reset SQL function rejected the token (raised INVALID_OR_EXPIRED_TOKEN / TOKEN_REQUIRED). */
function isInvalidResetTokenError(err: unknown): boolean {
  if (err instanceof BadRequestException) return true;
  const message = (err as { message?: unknown })?.message;
  return typeof message === 'string' && /INVALID_OR_EXPIRED_TOKEN|TOKEN_REQUIRED/.test(message);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(EmailService) private readonly emailService: EmailService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
  ) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Registers a new User, and submits an AcademyApplication for platform review and approval.
   */
  async register(
    dto: RegisterRequest,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ response: RegisterResponse }> {
    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException({
        code: ErrorCode.EMAIL_ALREADY_EXISTS,
        message: 'An account with this email address already exists',
      });
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const slugBase = dto.academySlug || this.slugify(dto.academyName) || 'academy';
    let finalSlug = slugBase;
    let counter = 1;

    while (
      (await this.prisma.tenant.findUnique({ where: { slug: finalSlug } })) ||
      (await this.prisma.academyApplication.findFirst({
        where: { academySlug: finalSlug, status: { in: ['PENDING_REVIEW', 'APPROVED'] } },
      }))
    ) {
      finalSlug = `${slugBase}-${counter++}`;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: dto.name.trim(),
          phone: dto.phone?.trim() ?? null,
          isEmailVerified: false,
        },
      });

      const rawSport = (dto.sport as string) || 'FOOTBALL';
      const applicationSport = rawSport === 'FOOTBALL' ? 'FOOTBALL' : 'FOOTBALL';
      const initialNotes = rawSport !== 'FOOTBALL' ? `Sport: ${rawSport}` : null;

      const application = await tx.academyApplication.create({
        data: {
          applicantUserId: user.id,
          academyName: dto.academyName.trim(),
          academySlug: finalSlug,
          sport: applicationSport as any,
          city: dto.city?.trim() ?? null,
          contactEmail: email,
          contactPhone: dto.phone?.trim() ?? null,
          notes: initialNotes,
          status: 'PENDING_REVIEW',
        },
      });

      return { user, application };
    });

    // Notify Super Admins & Platform Owners
    try {
      const platformStaff = await this.prisma.user.findMany({
        where: {
          OR: [{ isPlatformSuperAdmin: true }, { isPlatformOwner: true }],
          isSuspended: false,
        },
        select: { id: true },
      });

      for (const admin of platformStaff) {
        await this.notificationsService.createNotification({
          userId: admin.id,
          type: 'ACADEMY_APPLICATION',
          title: 'New Academy Application',
          body: `"${dto.academyName}" submitted a registration application for review.`,
          href: '/platform?tab=applications',
        });
      }
    } catch (e) {
      this.logger.warn(
        `Failed to notify platform admins of new application: ${(e as Error)?.message}`,
      );
    }

    // Send confirmation email to applicant
    try {
      await this.emailService.sendAcademyApplicationReceived(
        email,
        dto.name.trim(),
        dto.academyName.trim(),
        'ar',
      );
    } catch (e) {
      this.logger.warn(`Failed to send application confirmation email: ${(e as Error)?.message}`);
    }

    await this.auditService.logEvent({
      actorUserId: result.user.id,
      action: 'ACADEMY_APPLICATION_SUBMITTED',
      resourceType: 'AcademyApplication',
      resourceId: result.application.id,
      metadata: { academyName: dto.academyName.trim(), slug: finalSlug },
      ipAddress,
      userAgent,
    });

    return {
      response: {
        status: 'PENDING_REVIEW',
        message: 'تم استلام طلب تسجيل الأكاديمية بنجاح وهو قيد المراجعة حالياً من إدارة المنصة.',
        applicationId: result.application.id,
        academyName: result.application.academyName,
      },
    };
  }

  /**
   * Logs in a user with brute-force rate limiting and timing-attack protection.
   */
  async login(
    dto: LoginRequest,
    ipAddress?: string,
    userAgent?: string,
    activeTenantId?: string,
  ): Promise<{ response: AuthResponse; rawTokens: GeneratedTokens }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const rateLimitKey = `ratelimit:login:${rateLimitIpKey(ipAddress)}:${normalizedEmail}`;

    const { count, remainingTime } = await this.redisService.incrementRateLimit(
      rateLimitKey,
      15 * 60,
    );
    if (count > 5) {
      this.logger.warn(`Rate limit exceeded for login on ${normalizedEmail} from ${ipAddress}`);
      throw new UnauthorizedException({
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: `Too many login attempts. Please try again in ${Math.ceil(remainingTime / 60)} minutes.`,
      });
    }

    // Credential lookup must not depend on tenant-scoped RLS visibility.
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        playerProfile: { select: { id: true } },
        guardianProfiles: { select: { id: true } },
      },
    });

    // Timing-attack prevention: If user does not exist, run a dummy hash verification
    const passwordHashToVerify = user
      ? user.passwordHash
      : '$argon2id$v=19$m=65536,t=3,p=4$dummyhashfordummycheckpadding$dummyhashfordummycheckpadding';

    const isPasswordValid = await this.passwordService.verify(passwordHashToVerify, dto.password);

    if (!user || !isPasswordValid) {
      await this.auditService.logEvent({
        actorUserId: user?.id,
        action: 'AUTH_LOGIN_FAILURE',
        resourceType: 'Auth',
        metadata: { email: normalizedEmail },
        ipAddress,
        userAgent,
      });

      // Generic error message to prevent user enumeration
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    // Reset rate limit counter asynchronously upon successful credentials verification
    void this.redisService.resetRateLimit(rateLimitKey).catch(() => undefined);

    if (user.isSuspended) {
      throw new UnauthorizedException({
        code: ErrorCode.FORBIDDEN,
        message: 'تم تعليق هذا الحساب. يرجى التواصل مع الدعم الفني (Account suspended).',
      });
    }

    // Only discover tenant memberships AFTER successful password verification.
    // Actor-bound, transaction-local context keeps unrelated tenants invisible.
    const userMemberships = await this.prisma.withAuthLookupTransaction(
      { actorUserId: user.id },
      (tx) =>
        tx.tenantMembership.findMany({
          where: { userId: user.id, status: 'ACTIVE' },
          include: { tenant: true, branch: true },
        }),
    );

    // Enforce approval & tenant status gating
    if (!user.isPlatformSuperAdmin && !user.isPlatformOwner && userMemberships.length === 0) {
      const application = await this.prisma.academyApplication.findFirst({
        where: { applicantUserId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      if (application) {
        if (
          application.status === 'PENDING_REVIEW' ||
          application.status === 'MORE_INFO_REQUESTED'
        ) {
          throw new UnauthorizedException({
            code: 'ACADEMY_PENDING_APPROVAL',
            message:
              'طلب تسجيل الأكاديمية قيد المراجعة حالياً من قبل إدارة المنصة. ستصلك رسالة تأكيد عبر البريد الإلكتروني فور الموافقة.',
          });
        }
        if (application.status === 'REJECTED') {
          throw new UnauthorizedException({
            code: 'ACADEMY_REJECTED',
            message: 'تم رفض طلب تسجيل الأكاديمية. يرجى مراجعة إدارة المنصة للمزيد من التفاصيل.',
          });
        }
      }
      const joinRequest = await this.prisma.playerRegistrationRequest.findFirst({
        where: { applicantUserId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      if (joinRequest) {
        if (joinRequest.status === 'PENDING_REVIEW') {
          throw new UnauthorizedException({
            code: 'PLAYER_PENDING_APPROVAL',
            message: 'طلب انضمام اللاعب قيد المراجعة حالياً من قبل إدارة الأكاديمية.',
          });
        }
        if (joinRequest.status === 'REJECTED') {
          throw new UnauthorizedException({
            code: 'PLAYER_REJECTED',
            message: 'تم رفض طلب انضمام اللاعب من إدارة الأكاديمية.',
          });
        }
      }
    }

    // Map memberships
    const memberships: TenantMembershipSummary[] = userMemberships
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        tenantSlug: m.tenant.slug,
        role: m.role as TenantRole,
        status: m.status,
        branchId: m.branchId,
        branchName: m.branch?.name,
        canReviewApplications: Boolean((m as any).canReviewApplications),
      }));

    // Choose active tenant: prefer requested activeTenantId if valid, otherwise default to first active membership
    const activeTenant = activeTenantId
      ? (memberships.find((m) => m.tenantId === activeTenantId) ?? memberships[0] ?? null)
      : (memberships[0] ?? null);

    const tokens = await this.tokenService.generateTokens(
      user.id,
      user.email,
      activeTenant
        ? {
            tenantId: activeTenant.tenantId,
            role: activeTenant.role,
            branchId: activeTenant.branchId ?? undefined,
          }
        : undefined,
      userAgent,
      ipAddress,
      undefined,
      user.isPlatformSuperAdmin,
      user.isPlatformOwner,
    );

    void this.auditService
      .logEvent({
        tenantId: activeTenant?.tenantId,
        actorUserId: user.id,
        action: 'AUTH_LOGIN_SUCCESS',
        resourceType: 'Auth',
        resourceId: user.id,
        ipAddress,
        userAgent,
      })
      .catch((err) => {
        this.logger.warn(`Failed to log auth login event asynchronously: ${err?.message}`);
      });

    const userSummary: UserSummary = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      isPlatformSuperAdmin: user.isPlatformSuperAdmin,
      isPlatformOwner: user.isPlatformOwner,
      hasPlayerProfile: Boolean(user.playerProfile),
      hasGuardianProfile: (user.guardianProfiles?.length ?? 0) > 0,
      createdAt: user.createdAt.toISOString(),
    };

    return {
      response: {
        accessToken: tokens.accessToken,
        user: userSummary,
        activeTenant,
        memberships,
      },
      rawTokens: tokens,
    };
  }

  /**
   * Refreshes access token with rotation and reuse detection.
   */
  async refresh(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
    activeTenantId?: string,
  ): Promise<{ response: AuthResponse; rawTokens: GeneratedTokens }> {
    const { tokens, userId, email } = await this.tokenService.rotateRefreshToken(
      refreshToken,
      userAgent,
      ipAddress,
    );

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        playerProfile: { select: { id: true } },
        guardianProfiles: { select: { id: true } },
      },
    });

    // Refresh tokens authenticate the user, but must not bypass tenant RLS.
    // Reload active memberships using the verified actor's discovery context.
    const userMemberships = await this.prisma.withAuthLookupTransaction(
      { actorUserId: userId },
      (tx) =>
        tx.tenantMembership.findMany({
          where: { userId, status: 'ACTIVE' },
          include: { tenant: true, branch: true },
        }),
    );

    const memberships: TenantMembershipSummary[] = userMemberships
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        tenantSlug: m.tenant.slug,
        role: m.role as TenantRole,
        status: m.status,
        branchId: m.branchId,
        branchName: m.branch?.name,
        canReviewApplications: Boolean((m as any).canReviewApplications),
      }));

    // Choose active tenant: prefer requested activeTenantId if valid, otherwise default to first active membership
    const activeTenant = activeTenantId
      ? (memberships.find((m) => m.tenantId === activeTenantId) ?? memberships[0] ?? null)
      : (memberships[0] ?? null);

    const userSummary: UserSummary = {
      id: user.id,
      email,
      name: user.name,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      isPlatformSuperAdmin: user.isPlatformSuperAdmin,
      isPlatformOwner: user.isPlatformOwner,
      hasPlayerProfile: Boolean(user.playerProfile),
      hasGuardianProfile: (user.guardianProfiles?.length ?? 0) > 0,
      createdAt: user.createdAt.toISOString(),
    };

    return {
      response: {
        accessToken: tokens.accessToken,
        user: userSummary,
        activeTenant,
        memberships,
      },
      rawTokens: tokens,
    };
  }

  /**
   * Logs out the user and revokes their refresh token.
   */
  async logout(refreshToken?: string, userId?: string): Promise<void> {
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }
    if (userId) {
      await this.auditService.logEvent({
        actorUserId: userId,
        action: 'AUTH_LOGOUT',
        resourceType: 'Auth',
        resourceId: userId,
      });
    }
  }

  /**
   * Starts a password reset (K1). The response is always the same generic message, so it never reveals whether an
   * account exists. For an existing account it issues BOTH a 6-digit code and a 256-bit single-use link token; only
   * their SHA-256 hashes are stored and both expire after 5 minutes. The link carries the token in the URL
   * *fragment*, so it never reaches server access logs or Referer headers.
   *
   * Flood protection (keyed by the submitted e-mail and client IP, independent of account existence):
   * 60 s between requests per e-mail, and 5 min (the code lifetime) after 3 requests in an hour, so a valid e-mail
   * cannot be superseded before it expires; 3 per 15 min per IP + e-mail; 10 per hour per IP across all e-mails.
   */
  async forgotPassword(
    dto: ForgotPasswordRequest,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; debugOtp?: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    await this.enforceResetRequestLimits(normalizedEmail, rateLimitIpKey(ipAddress));

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true },
    });

    let debugOtp: string | undefined;

    if (user) {
      const code = crypto.randomInt(100000, 1000000).toString();
      const linkToken = this.tokenService.generateSecureRandomString(32); // 32 bytes = 256 bits, 64 hex chars
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

      await this.prisma.$queryRaw`
        SELECT public.request_password_reset_with_link(
          ${normalizedEmail},
          ${this.tokenService.hashToken(code)},
          ${this.tokenService.hashToken(linkToken)},
          ${expiresAt}
        )
      `;

      // A new code gets a fresh per-code counter. The 24 h account counter is deliberately NOT reset.
      await this.redisService.resetRateLimit(resetCodeAttemptsKey(normalizedEmail));

      await this.auditService.logEvent({
        actorUserId: user.id,
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        resourceType: 'User',
        resourceId: user.id,
        ipAddress,
        userAgent,
      });

      try {
        const appUrl =
          process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const resetUrl = `${appUrl}/reset-password#token=${linkToken}&email=${encodeURIComponent(normalizedEmail)}`;
        await this.emailService.sendPasswordReset(user.email, user.name, resetUrl, 'ar', code);
      } catch (e) {
        this.logger.warn(`Failed to dispatch password reset email: ${(e as Error)?.message}`);
      }

      if (this.config.nodeEnv === 'development') {
        debugOtp = code;
      }
    }

    return {
      message:
        'If that email address is registered, instructions have been sent to reset your password with a 6-digit verification code.',
      ...(debugOtp ? { debugOtp } : {}),
    };
  }

  private async enforceResetRequestLimits(email: string, ipKey: string): Promise<void> {
    const tooMany = (retryAfterSeconds: number) =>
      new BadRequestException({
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: `يرجى الانتظار قبل طلب رمز جديد (Please wait ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} minute(s) before requesting a new code).`,
      });

    const perIp = await this.redisService.incrementRateLimit(
      `ratelimit:forgot-password-ip:${ipKey}`,
      60 * 60,
    );
    if (perIp.count > 10) throw tooMany(perIp.remainingTime);

    const hourly = await this.redisService.incrementRateLimit(
      `ratelimit:forgot-password-hourly:${email}`,
      60 * 60,
    );
    const cooldownSeconds = hourly.count > 3 ? PASSWORD_RESET_TTL_MS / 1000 : 60;
    const cooldown = await this.redisService.incrementRateLimit(
      `ratelimit:forgot-password-cooldown:${cooldownSeconds}:${email}`,
      cooldownSeconds,
    );
    if (cooldown.count > 1) throw tooMany(cooldown.remainingTime);

    const perIpEmail = await this.redisService.incrementRateLimit(
      `ratelimit:forgot-password:${ipKey}:${email}`,
      15 * 60,
    );
    if (perIpEmail.count > 3) throw tooMany(perIpEmail.remainingTime);
  }

  /**
   * Completes a password reset (K1).
   *
   * - 6-digit code: only valid together with the e-mail it was sent to. 5 wrong attempts cancel that code (the link
   *   from the same e-mail stays valid); after 10 failed code attempts in 24 h code entry is refused for the account
   *   until the window passes - the link keeps working, so an attacker cannot block a legitimate reset.
   * - 64-hex token: the e-mailed link (single-use) or a platform activation link. Not counted per account.
   * - Every attempt counts against the client IP (30 per 15 min). Every failure returns the same generic error.
   *
   * Token consumption, password update, session-version bump and refresh-token revocation happen atomically inside
   * one database function call.
   */
  async resetPassword(
    dto: ResetPasswordRequest,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const perIp = await this.redisService.incrementRateLimit(
      `ratelimit:reset-password-ip:${rateLimitIpKey(ipAddress)}`,
      15 * 60,
    );
    if (perIp.count > 30) {
      throw new BadRequestException({
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: `Too many attempts. Please try again in ${Math.max(1, Math.ceil(perIp.remainingTime / 60))} minute(s).`,
      });
    }

    const token = dto.token.trim();
    let userId: string;
    if (RESET_CODE_PATTERN.test(token) && dto.email) {
      userId = await this.resetWithCode(dto.email.toLowerCase().trim(), token, dto.newPassword);
    } else if (RESET_LINK_TOKEN_PATTERN.test(token)) {
      userId = await this.resetWithLink(token, dto.newPassword);
    } else {
      throw invalidResetError();
    }

    await this.auditService.logEvent({
      actorUserId: userId,
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      resourceType: 'User',
      resourceId: userId,
      ipAddress,
      userAgent,
    });

    try {
      const userRecord = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });
      if (userRecord) {
        await this.emailService.sendPasswordChangedNotification(
          userRecord.email,
          userRecord.name,
          { ipAddress, userAgent, changedAt: new Date() },
          'ar',
        );
      }
    } catch (e) {
      this.logger.warn(
        `Failed to dispatch password changed security email: ${(e as Error)?.message}`,
      );
    }

    return {
      message: 'Password has been successfully reset. You may now log in with your new password.',
    };
  }

  private async resetWithCode(email: string, code: string, newPassword: string): Promise<string> {
    const dailyKey = resetCodeDailyFailuresKey(email);
    if ((await this.redisService.peekRateLimit(dailyKey)) >= RESET_CODE_DAILY_FAILURE_LIMIT) {
      // Code entry suspended for this account; the e-mailed link still works. Same generic response.
      throw invalidResetError();
    }

    const passwordHash = await this.passwordService.hash(newPassword);
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ complete_password_reset_for_email: string }>
      >`
        SELECT public.complete_password_reset_for_email(
          ${email},
          ${this.tokenService.hashToken(code)},
          ${passwordHash}
        )
      `;
      const userId = rows[0]?.complete_password_reset_for_email;
      if (!userId) throw invalidResetError();
      await this.redisService.resetRateLimit(resetCodeAttemptsKey(email));
      return userId;
    } catch (err) {
      if (!isInvalidResetTokenError(err)) throw err;
      const perCode = await this.redisService.incrementRateLimit(
        resetCodeAttemptsKey(email),
        PASSWORD_RESET_TTL_MS / 1000,
      );
      await this.redisService.incrementRateLimit(dailyKey, 24 * 60 * 60);
      if (perCode.count >= RESET_CODE_ATTEMPT_LIMIT) {
        await this.prisma
          .$executeRaw`SELECT public.invalidate_password_reset_code_for_email(${email})`;
      }
      throw invalidResetError();
    }
  }

  private async resetWithLink(token: string, newPassword: string): Promise<string> {
    const passwordHash = await this.passwordService.hash(newPassword);
    const tokenHash = this.tokenService.hashToken(token);
    try {
      const rows = await this.prisma.$queryRaw<Array<{ complete_password_reset_by_link: string }>>`
        SELECT public.complete_password_reset_by_link(${tokenHash}, ${passwordHash})
      `;
      const userId = rows[0]?.complete_password_reset_by_link;
      if (userId) return userId;
    } catch (err) {
      if (!isInvalidResetTokenError(err)) throw err;
    }
    // Platform staff activation links (64-hex tokens issued via request_password_reset).
    try {
      const rows = await this.prisma.$queryRaw<Array<{ complete_password_reset: string }>>`
        SELECT public.complete_password_reset(${tokenHash}, ${passwordHash})
      `;
      const userId = rows[0]?.complete_password_reset;
      if (userId) return userId;
    } catch (err) {
      if (!isInvalidResetTokenError(err)) throw err;
    }
    throw invalidResetError();
  }

  /**
   * Verifies email address using single-use verification token.
   */
  async verifyEmail(
    token: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const tokenHash = this.tokenService.hashToken(token);

    try {
      const rows = await this.prisma.$queryRaw<Array<{ verify_user_email: string }>>`
        SELECT public.verify_user_email(${tokenHash})
      `;

      const userId = rows[0]?.verify_user_email;
      if (!userId) {
        throw new BadRequestException({
          code: ErrorCode.TOKEN_INVALID,
          message: 'Invalid or expired email verification token',
        });
      }

      await this.auditService.logEvent({
        actorUserId: userId,
        action: 'AUTH_EMAIL_VERIFIED',
        resourceType: 'User',
        resourceId: userId,
        ipAddress,
        userAgent,
      });

      return { message: 'Email address verified successfully' };
    } catch {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid or expired email verification token',
      });
    }
  }

  /**
   * Resends email verification link with rate limiting.
   */
  async resendVerificationEmail(
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const rateLimitKey = `ratelimit:email-verify:${rateLimitIpKey(ipAddress)}:${normalizedEmail}`;
    const { count, remainingTime } = await this.redisService.incrementRateLimit(
      rateLimitKey,
      15 * 60,
    );
    if (count > 3) {
      throw new BadRequestException({
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: `Too many verification requests. Please try again in ${Math.ceil(remainingTime / 60)} minutes.`,
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user && !user.isEmailVerified) {
      const rawToken = this.tokenService.generateSecureRandomString(32);
      const tokenHash = this.tokenService.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await this.prisma.$executeRaw`
        SELECT public.request_email_verification(
          ${normalizedEmail},
          ${tokenHash},
          ${expiresAt}
        )
      `;

      await this.auditService.logEvent({
        actorUserId: user.id,
        action: 'AUTH_EMAIL_VERIFICATION_RESENT',
        resourceType: 'User',
        resourceId: user.id,
        ipAddress,
        userAgent,
      });

      try {
        const appUrl =
          process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`;
        await this.emailService.sendEmailVerification(user.email, user.name, verifyUrl, 'ar');
      } catch (e) {
        this.logger.warn(`Failed to dispatch verification email: ${(e as Error)?.message}`);
      }
    }

    return {
      message:
        'If that email address is registered and unverified, verification instructions have been sent.',
    };
  }

  /**
   * Retrieves profile and memberships for current user under authenticated discovery path.
   */
  async getMe(
    userId: string,
    activeTenantId?: string,
  ): Promise<{
    user: UserSummary;
    activeTenant: TenantMembershipSummary | null;
    memberships: TenantMembershipSummary[];
  }> {
    return this.prisma.withAuthLookupTransaction({ actorUserId: userId }, async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: {
          memberships: {
            include: {
              tenant: true,
              branch: true,
            },
          },
          playerProfile: { select: { id: true } },
          guardianProfiles: { select: { id: true } },
        },
      });

      const memberships: TenantMembershipSummary[] = user.memberships
        .filter((m) => m.status === 'ACTIVE')
        .map((m) => ({
          id: m.id,
          tenantId: m.tenantId,
          tenantName: m.tenant.name,
          tenantSlug: m.tenant.slug,
          role: m.role as TenantRole,
          status: m.status,
          branchId: m.branchId,
          branchName: m.branch?.name,
          canReviewApplications: Boolean((m as any).canReviewApplications),
        }));

      const activeTenant = activeTenantId
        ? (memberships.find((m) => m.tenantId === activeTenantId) ?? memberships[0] ?? null)
        : (memberships[0] ?? null);

      const userSummary: UserSummary = {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        isPlatformSuperAdmin: user.isPlatformSuperAdmin,
        isPlatformOwner: user.isPlatformOwner,
        hasPlayerProfile: Boolean(user.playerProfile),
        hasGuardianProfile: (user.guardianProfiles?.length ?? 0) > 0,
        createdAt: user.createdAt.toISOString(),
      };

      return {
        user: userSummary,
        activeTenant,
        memberships,
      };
    });
  }

  /**
   * Changes the password for an authenticated user after verifying their current password.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordRequest,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; rawTokens: GeneratedTokens }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const isCurrentPasswordValid = await this.passwordService.verify(
      user.passwordHash,
      dto.currentPassword,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Current password is incorrect',
      });
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'New password must be different from current password',
      });
    }

    const newHash = await this.passwordService.hash(dto.newPassword);
    // K13/K13b in one transaction: the new hash and the session-version bump are written first (taking the user row
    // lock that serialises against refresh rotation), all refresh tokens are revoked, and this device receives new
    // tokens carrying the new version. Every other device and every older access token stop working immediately.
    const rawTokens = await this.prisma.$transaction(async (tx) => {
      const sessionVersion = await this.tokenService.invalidateAllSessions(tx, userId, {
        passwordHash: newHash,
      });
      return this.tokenService.generateTokens(
        userId,
        user.email,
        undefined,
        userAgent,
        ipAddress,
        undefined,
        user.isPlatformSuperAdmin,
        user.isPlatformOwner,
        sessionVersion,
        tx,
      );
    });

    await this.auditService.logEvent({
      action: 'PASSWORD_CHANGED',
      resourceType: 'USER',
      resourceId: userId,
      actorUserId: userId,
      ipAddress,
      userAgent,
      metadata: { method: 'authenticated_change' },
    });

    // Security alert: dispatch password changed confirmation email
    try {
      await this.emailService.sendPasswordChangedNotification(
        user.email,
        user.name,
        { ipAddress, userAgent, changedAt: new Date() },
        'ar',
      );
    } catch (e) {
      this.logger.warn(
        `Failed to dispatch password changed security email: ${(e as Error)?.message}`,
      );
    }

    this.logger.log(`Password changed for user ${userId}`);
    return { message: 'Password changed successfully', rawTokens };
  }

  /**
   * Updates the authenticated user's profile information (name, phone).
   */
  async updateUserProfile(
    userId: string,
    dto: UpdateUserProfileRequest,
  ): Promise<{ message: string; name?: string; phone?: string | null }> {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;

    if (Object.keys(data).length === 0) {
      return { message: 'No changes to apply' };
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    this.logger.log(`Profile updated for user ${userId}: ${Object.keys(data).join(', ')}`);
    return {
      message: 'Profile updated successfully',
      name: updated.name,
      phone: updated.phone,
    };
  }
}
