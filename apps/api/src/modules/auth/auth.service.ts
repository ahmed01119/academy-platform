import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';
import { TokenService, type GeneratedTokens } from './token.service';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '../../config/app-config.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ErrorCode,
  TenantRole,
  type AuthResponse,
  type ChangePasswordRequest,
  type ForgotPasswordRequest,
  type LoginRequest,
  type RegisterRequest,
  type RegisterResponse,
  type ResetPasswordRequest,
  type TenantMembershipSummary,
  type UpdateUserProfileRequest,
  type UserSummary,
} from '@academy/shared';

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

      const application = await tx.academyApplication.create({
        data: {
          applicantUserId: user.id,
          academyName: dto.academyName.trim(),
          academySlug: finalSlug,
          sport: (dto.sport as any) || 'FOOTBALL',
          city: dto.city?.trim() ?? null,
          contactEmail: email,
          contactPhone: dto.phone?.trim() ?? null,
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
      this.logger.warn(`Failed to notify platform admins of new application: ${(e as Error)?.message}`);
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
    const rateLimitKey = `ratelimit:login:${ipAddress || 'unknown'}:${normalizedEmail}`;

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

    // Reset rate limit counter upon successful credentials verification
    await this.redisService.resetRateLimit(rateLimitKey);

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

    await this.auditService.logEvent({
      tenantId: activeTenant?.tenantId,
      actorUserId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'Auth',
      resourceId: user.id,
      ipAddress,
      userAgent,
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
   * Generates single-use expiring password reset token with brute-force rate limiting.
   * Returns a generic success message to prevent user enumeration.
   */
  async forgotPassword(
    dto: ForgotPasswordRequest,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const rateLimitKey = `ratelimit:forgot-password:${ipAddress || 'unknown'}:${normalizedEmail}`;
    const { count, remainingTime } = await this.redisService.incrementRateLimit(
      rateLimitKey,
      15 * 60,
    );
    if (count > 3) {
      this.logger.warn(
        `Rate limit exceeded for forgot-password on ${normalizedEmail} from ${ipAddress}`,
      );
      throw new BadRequestException({
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: `Too many password reset requests. Please try again in ${Math.ceil(remainingTime / 60)} minutes.`,
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      const rawToken = this.tokenService.generateSecureRandomString(32);
      const tokenHash = this.tokenService.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.$executeRaw`
        SELECT public.request_password_reset(
          ${normalizedEmail},
          ${tokenHash},
          ${expiresAt}
        )
      `;

      await this.auditService.logEvent({
        actorUserId: user.id,
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        resourceType: 'User',
        resourceId: user.id,
        ipAddress,
        userAgent,
      });

      try {
        const appUrl = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
        await this.emailService.sendPasswordReset(user.email, user.name, resetUrl, 'ar');
      } catch (e) {
        this.logger.warn(`Failed to dispatch password reset email: ${(e as Error)?.message}`);
      }
    }

    return {
      message:
        'If that email address is registered, instructions have been sent to reset your password.',
    };
  }

  /**
   * Resets password with single-use expiring token.
   */
  async resetPassword(
    dto: ResetPasswordRequest,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const tokenHash = this.tokenService.hashToken(dto.token);
    const passwordHash = await this.passwordService.hash(dto.newPassword);

    try {
      const rows = await this.prisma.$queryRaw<Array<{ complete_password_reset: string }>>`
        SELECT public.complete_password_reset(
          ${tokenHash},
          ${passwordHash}
        )
      `;

      const userId = rows[0]?.complete_password_reset;
      if (!userId) {
        throw new BadRequestException({
          code: ErrorCode.TOKEN_INVALID,
          message: 'Invalid or expired password reset token',
        });
      }

      await this.tokenService.revokeAllUserTokens(userId);

      await this.auditService.logEvent({
        actorUserId: userId,
        action: 'AUTH_PASSWORD_RESET_COMPLETED',
        resourceType: 'User',
        resourceId: userId,
        ipAddress,
        userAgent,
      });

      // Security alert: dispatch password changed confirmation email
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
        this.logger.warn(`Failed to dispatch password changed security email: ${(e as Error)?.message}`);
      }

      return {
        message: 'Password has been successfully reset. You may now log in with your new password.',
      };
    } catch {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid or expired password reset token',
      });
    }
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
    const rateLimitKey = `ratelimit:email-verify:${ipAddress || 'unknown'}:${normalizedEmail}`;
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
        const appUrl = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
  ): Promise<{ message: string }> {
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
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
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
      this.logger.warn(`Failed to dispatch password changed security email: ${(e as Error)?.message}`);
    }

    this.logger.log(`Password changed for user ${userId}`);
    return { message: 'Password changed successfully' };
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
