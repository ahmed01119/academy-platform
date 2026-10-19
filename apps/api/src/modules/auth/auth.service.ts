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
import {
  ErrorCode,
  TenantRole,
  type AuthResponse,
  type ForgotPasswordRequest,
  type LoginRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
  type TenantMembershipSummary,
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
  ) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Registers a new User, and provisions their initial Academy Tenant + Branch + OWNER Membership.
   */
  async register(
    dto: RegisterRequest,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ response: AuthResponse; rawTokens: GeneratedTokens }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
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

    while (await this.prisma.tenant.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slugBase}-${counter++}`;
    }

    // Atomically create User, Tenant, Branch, Sport, and Membership
    // Uses the scoped database onboarding boundary when running against PostgreSQL with restricted runtime role
    const result = await this.prisma.$transaction(async (tx) => {
      const onboardingToken = this.tokenService.generateSecureRandomString(32);
      const onboardingTokenHash = this.tokenService.hashToken(onboardingToken);

      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          name: dto.name.trim(),
          phone: dto.phone?.trim(),
          isEmailVerified: false,
          onboardingToken: onboardingTokenHash,
          onboardingExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      try {
        const provisionedRows = await tx.$queryRaw<
          Array<{
            tenant_id: string;
            tenant_name: string;
            tenant_slug: string;
            branch_id: string;
            branch_name: string;
            membership_id: string;
          }>
        >`SELECT * FROM public.provision_tenant_onboarding(
          ${user.id}::uuid,
          ${dto.academyName.trim()},
          ${finalSlug},
          ${'الفرع الرئيسي'},
          ${'MAIN'},
          ${dto.sport || 'FOOTBALL'},
          ${onboardingToken}
        )`;

        const provisioned = provisionedRows[0];
        if (!provisioned) {
          throw new InternalServerErrorException({
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Tenant onboarding failed to return provisioned entity identifiers',
          });
        }

        return {
          user,
          tenant: {
            id: provisioned.tenant_id,
            name: provisioned.tenant_name,
            slug: provisioned.tenant_slug,
          },
          branch: {
            id: provisioned.branch_id,
            name: provisioned.branch_name,
          },
          membership: {
            id: provisioned.membership_id,
            role: TenantRole.OWNER,
            status: 'ACTIVE' as const,
          },
        };
      } catch (err: unknown) {
        const pgErr = err as { code?: string; message?: string };
        if (pgErr.code === '23505' || pgErr.message?.includes('tenants_slug_key')) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'An academy with this slug already exists',
          });
        }
        if (pgErr.code === '23505' || pgErr.message?.includes('users_email_key')) {
          throw new ConflictException({
            code: ErrorCode.EMAIL_ALREADY_EXISTS,
            message: 'An account with this email address already exists',
          });
        }
        if (pgErr.code === '42501' || pgErr.message?.includes('ONBOARDING_NOT_AUTHORIZED')) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Unauthorized tenant onboarding attempt',
          });
        }
        throw err;
      }
    });

    const activeTenant: TenantMembershipSummary = {
      id: result.membership.id,
      tenantId: result.tenant.id,
      tenantName: result.tenant.name,
      tenantSlug: result.tenant.slug,
      role: result.membership.role as TenantRole,
      status: result.membership.status,
      branchId: result.branch.id,
      branchName: result.branch.name,
    };

    const tokens = await this.tokenService.generateTokens(
      result.user.id,
      result.user.email,
      {
        tenantId: result.tenant.id,
        role: result.membership.role as TenantRole,
        branchId: result.branch.id,
      },
      userAgent,
      ipAddress,
    );

    await this.auditService.logEvent({
      tenantId: result.tenant.id,
      actorUserId: result.user.id,
      action: 'AUTH_REGISTER',
      resourceType: 'User',
      resourceId: result.user.id,
      metadata: { academyName: result.tenant.name, slug: result.tenant.slug },
      ipAddress,
      userAgent,
    });

    const userSummary: UserSummary = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      phone: result.user.phone,
      isEmailVerified: result.user.isEmailVerified,
      createdAt: result.user.createdAt.toISOString(),
    };

    return {
      response: {
        accessToken: tokens.accessToken,
        user: userSummary,
        activeTenant,
        memberships: [activeTenant],
      },
      rawTokens: tokens,
    };
  }

  /**
   * Logs in a user with brute-force rate limiting and timing-attack protection.
   */
  async login(
    dto: LoginRequest,
    ipAddress?: string,
    userAgent?: string,
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
      }));

    // Choose first active membership as default active tenant
    const activeTenant = memberships[0] ?? null;

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
  ): Promise<{ response: AuthResponse; rawTokens: GeneratedTokens }> {
    const { tokens, userId, email } = await this.tokenService.rotateRefreshToken(
      refreshToken,
      userAgent,
      ipAddress,
    );

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
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
      }));

    const activeTenant = memberships[0] ?? null;

    const userSummary: UserSummary = {
      id: user.id,
      email,
      name: user.name,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
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
  ): Promise<{ message: string; debugToken?: string }> {
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

    let debugToken: string | undefined;

    if (user) {
      const rawToken = this.tokenService.generateSecureRandomString(32);
      const tokenHash = this.tokenService.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
      });

      await this.auditService.logEvent({
        actorUserId: user.id,
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        resourceType: 'User',
        resourceId: user.id,
        ipAddress,
        userAgent,
      });

      // Expose debugToken ONLY in non-production environments
      if (this.config.nodeEnv !== 'production' && process.env.NODE_ENV !== 'production') {
        debugToken = rawToken;
      }
    }

    return {
      message:
        'If that email address is registered, instructions have been sent to reset your password.',
      debugToken,
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

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid or expired password reset token',
      });
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);

    // Update password, clear token, and revoke all existing sessions
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    await this.tokenService.revokeAllUserTokens(user.id);

    await this.auditService.logEvent({
      actorUserId: user.id,
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      resourceType: 'User',
      resourceId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      message: 'Password has been successfully reset. You may now log in with your new password.',
    };
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
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationToken: tokenHash,
        emailVerificationExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid or expired email verification token',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });

    await this.auditService.logEvent({
      actorUserId: user.id,
      action: 'AUTH_EMAIL_VERIFIED',
      resourceType: 'User',
      resourceId: user.id,
      ipAddress,
      userAgent,
    });

    return { message: 'Email address verified successfully' };
  }

  /**
   * Resends email verification link with rate limiting.
   */
  async resendVerificationEmail(
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string; debugToken?: string }> {
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

    let debugToken: string | undefined;

    if (user && !user.isEmailVerified) {
      const rawToken = this.tokenService.generateSecureRandomString(32);
      const tokenHash = this.tokenService.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: tokenHash,
          emailVerificationExpiresAt: expiresAt,
        },
      });

      await this.auditService.logEvent({
        actorUserId: user.id,
        action: 'AUTH_EMAIL_VERIFICATION_RESENT',
        resourceType: 'User',
        resourceId: user.id,
        ipAddress,
        userAgent,
      });

      if (this.config.nodeEnv !== 'production' && process.env.NODE_ENV !== 'production') {
        debugToken = rawToken;
      }
    }

    return {
      message:
        'If that email address is registered and unverified, verification instructions have been sent.',
      debugToken,
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
        createdAt: user.createdAt.toISOString(),
      };

      return {
        user: userSummary,
        activeTenant,
        memberships,
      };
    });
  }
}
