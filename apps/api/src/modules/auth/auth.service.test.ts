import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { PasswordService } from './password.service';
import type { TokenService } from './token.service';
import type { RedisService } from '../redis/redis.service';
import type { AuditService } from '../audit/audit.service';
import type { AppConfigService } from '../../config/app-config.service';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  user: {
    findUnique: MockFn;
    findUniqueOrThrow: MockFn;
    findFirst: MockFn;
    create: MockFn;
    update: MockFn;
  };
  tenant: {
    findUnique: MockFn;
  };
  tenantMembership: {
    findMany: MockFn;
  };
  $queryRaw: MockFn;
  $executeRaw: MockFn;
  $transaction: MockFn;
  withAuthLookupTransaction: MockFn;
}

interface MockPassword {
  hash: MockFn;
  verify: MockFn;
}

interface MockToken {
  generateSecureRandomString: MockFn;
  generateTokens: MockFn;
  hashToken: MockFn;
  createRefreshTokenSession: MockFn;
  rotateRefreshToken: MockFn;
  revokeRefreshToken: MockFn;
  revokeFamily: MockFn;
  revokeAllUserTokens: MockFn;
}

interface MockRedis {
  incrementRateLimit: MockFn;
  resetRateLimit: MockFn;
}

interface MockAudit {
  logEvent: MockFn;
}

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: MockPrisma;
  let mockPassword: MockPassword;
  let mockToken: MockToken;
  let mockRedis: MockRedis;
  let mockAudit: MockAudit;
  let mockConfig: { nodeEnv: string };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      tenantMembership: {
        findMany: vi.fn(),
      },
      $queryRaw: vi.fn().mockResolvedValue([
        {
          tenant_id: 'tenant-1',
          tenant_name: 'Nankatsu SC',
          tenant_slug: 'nankatsu-sc',
          branch_id: 'branch-1',
          branch_name: 'الفرع الرئيسي',
          membership_id: 'membership-1',
        },
      ]),
      $executeRaw: vi.fn().mockResolvedValue(1),
      $transaction: vi.fn().mockImplementation((fn) => fn(mockPrisma)),
      withAuthLookupTransaction: vi.fn().mockImplementation((_opts, fn) => fn(mockPrisma)),
    };

    mockPassword = {
      hash: vi.fn().mockResolvedValue('argon2id$mock$hash'),
      verify: vi.fn().mockResolvedValue(false),
    };

    mockToken = {
      generateSecureRandomString: vi.fn().mockReturnValue('mock-secure-random-token-12345'),
      generateTokens: vi.fn().mockResolvedValue({
        accessToken: 'mock.access.token',
        refreshToken: 'mock.refresh.token',
        expiresIn: 900,
      }),
      hashToken: vi.fn().mockReturnValue('hashed-token-value'),
      createRefreshTokenSession: vi.fn().mockResolvedValue({}),
      rotateRefreshToken: vi.fn(),
      revokeRefreshToken: vi.fn(),
      revokeFamily: vi.fn(),
      revokeAllUserTokens: vi.fn(),
    };

    mockRedis = {
      incrementRateLimit: vi.fn().mockResolvedValue({ count: 1, remainingTime: 900 }),
      resetRateLimit: vi.fn().mockResolvedValue(undefined),
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue({}),
    };

    mockConfig = {
      nodeEnv: 'test',
    };

    authService = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockPassword as unknown as PasswordService,
      mockToken as unknown as TokenService,
      mockRedis as unknown as RedisService,
      mockAudit as unknown as AuditService,
      mockConfig as unknown as AppConfigService,
    );
  });

  describe('register', () => {
    it('rejects registration when email is already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user-id' });

      await expect(
        authService.register({
          name: 'Captain Tsubasa',
          email: 'captain@example.com',
          password: 'Password123!',
          academyName: 'Nankatsu SC',
          sport: 'FOOTBALL',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('registers new user, binds onboarding token challenge, and provisions tenant atomically', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'captain@example.com',
        name: 'Captain Tsubasa',
        phone: '+201000000001',
        isEmailVerified: false,
        createdAt: new Date(),
      });

      const result = await authService.register({
        name: 'Captain Tsubasa',
        email: 'captain@example.com',
        password: 'Password123!',
        academyName: 'Nankatsu SC',
        sport: 'FOOTBALL',
      });

      expect(result.response.user.email).toBe('captain@example.com');
      expect(result.response.activeTenant?.tenantId).toBe('tenant-1');
      expect(result.rawTokens.accessToken).toBe('mock.access.token');

      // Assert user was created without direct token assignment (handled by security definer)
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'captain@example.com',
            name: 'Captain Tsubasa',
          }),
        }),
      );

      // Assert security definer onboarding token issuance and boundary function were executed
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();

      // Assert audit log event
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUTH_REGISTER',
          resourceType: 'User',
          resourceId: 'user-1',
        }),
      );
    });

    it('resolves slug collision by appending numeric suffix', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      // First slug check finds existing tenant, second finds none
      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce({ id: 'existing-tenant', slug: 'nankatsu-sc' })
        .mockResolvedValueOnce(null);

      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'captain@example.com',
        name: 'Captain Tsubasa',
        phone: null,
        isEmailVerified: false,
        createdAt: new Date(),
      });

      mockPrisma.$queryRaw.mockResolvedValue([
        {
          tenant_id: 'tenant-2',
          tenant_name: 'Nankatsu SC',
          tenant_slug: 'nankatsu-sc-1',
          branch_id: 'branch-1',
          branch_name: 'الفرع الرئيسي',
          membership_id: 'membership-1',
        },
      ]);

      const result = await authService.register({
        name: 'Captain Tsubasa',
        email: 'captain@example.com',
        password: 'Password123!',
        academyName: 'Nankatsu SC',
        sport: 'FOOTBALL',
      });

      expect(result.response.activeTenant?.tenantSlug).toBe('nankatsu-sc-1');
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(2);
    });

    it('fails closed if onboarding database function fails', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'captain@example.com',
        name: 'Captain Tsubasa',
        isEmailVerified: false,
        createdAt: new Date(),
      });
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DATABASE_OUTAGE_ONBOARDING_FAILURE'));

      await expect(
        authService.register({
          name: 'Captain Tsubasa',
          email: 'captain@example.com',
          password: 'Password123!',
          academyName: 'Nankatsu SC',
          sport: 'FOOTBALL',
        }),
      ).rejects.toThrow('DATABASE_OUTAGE_ONBOARDING_FAILURE');
    });

    it('maps unauthorized onboarding error code (42501) to ForbiddenException', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'captain@example.com',
        name: 'Captain Tsubasa',
        isEmailVerified: false,
        createdAt: new Date(),
      });
      const pgErr = new Error('ONBOARDING_NOT_AUTHORIZED_OR_EXPIRED');
      (pgErr as unknown as { code: string }).code = '42501';
      mockPrisma.$queryRaw.mockRejectedValue(pgErr);

      await expect(
        authService.register({
          name: 'Captain Tsubasa',
          email: 'captain@example.com',
          password: 'Password123!',
          academyName: 'Nankatsu SC',
          sport: 'FOOTBALL',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('login', () => {
    it('fails login on invalid credentials with constant-time dummy verification', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPassword.verify.mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPassword.verify).toHaveBeenCalled();
    });

    it('blocks login when brute-force rate limit is exceeded', async () => {
      mockRedis.incrementRateLimit.mockResolvedValue({
        count: 6, // Exceeded max 5
        remainingTime: 900,
      });

      await expect(
        authService.login({
          email: 'victim@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('loads memberships only after valid credentials in actor-scoped discovery and resets rate limit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'coach@example.com',
        passwordHash: 'stored-hash',
        name: 'Coach',
        phone: null,
        isEmailVerified: true,
        createdAt: new Date(),
      });
      mockPassword.verify.mockResolvedValue(true);
      mockPrisma.tenantMembership.findMany.mockResolvedValue([
        {
          id: 'mem-1',
          tenantId: 'tenant-1',
          role: 'COACH',
          status: 'ACTIVE',
          branchId: 'branch-1',
          tenant: { id: 'tenant-1', name: 'Nankatsu SC', slug: 'nankatsu-sc' },
          branch: { id: 'branch-1', name: 'الفرع الرئيسي' },
        },
      ]);

      const result = await authService.login({
        email: 'coach@example.com',
        password: 'correct-password',
      });

      expect(result.response.activeTenant?.tenantId).toBe('tenant-1');
      expect(mockRedis.resetRateLimit).toHaveBeenCalledWith(
        expect.stringContaining('coach@example.com'),
      );
      expect(mockPrisma.withAuthLookupTransaction).toHaveBeenCalledWith(
        { actorUserId: 'user-1' },
        expect.any(Function),
      );
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AUTH_LOGIN_SUCCESS' }),
      );
    });
  });

  describe('refresh', () => {
    it('reloads active memberships in actor-scoped context on token refresh', async () => {
      mockToken.rotateRefreshToken.mockResolvedValue({
        tokens: { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 },
        userId: 'user-1',
        email: 'coach@example.com',
      });
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-1',
        email: 'coach@example.com',
        name: 'Coach',
        phone: null,
        isEmailVerified: true,
        createdAt: new Date(),
      });
      mockPrisma.tenantMembership.findMany.mockResolvedValue([]);

      const result = await authService.refresh('refresh-secret');

      expect(result.response.memberships).toEqual([]);
      expect(mockPrisma.withAuthLookupTransaction).toHaveBeenCalledWith(
        { actorUserId: 'user-1' },
        expect.any(Function),
      );
    });
  });

  describe('logout', () => {
    it('revokes refresh token and logs audit event', async () => {
      await authService.logout('raw-refresh-token', 'user-1');

      expect(mockToken.revokeRefreshToken).toHaveBeenCalledWith('raw-refresh-token');
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'user-1',
          action: 'AUTH_LOGOUT',
        }),
      );
    });

    it('handles logout when only refresh token or userId is provided', async () => {
      await authService.logout('raw-refresh-token', undefined);
      expect(mockToken.revokeRefreshToken).toHaveBeenCalledWith('raw-refresh-token');

      await authService.logout(undefined, 'user-2');
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ actorUserId: 'user-2' }),
      );
    });
  });

  describe('forgotPassword', () => {
    it('omits debugToken in production', async () => {
      mockConfig.nodeEnv = 'production';
      process.env.NODE_ENV = 'production';
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'prod-user@example.com',
      });

      const result = await authService.forgotPassword({
        email: 'prod-user@example.com',
      });

      expect(result.debugToken).toBeUndefined();
      expect(result.message).toContain('instructions have been sent');
    });

    it('returns debugToken in development and test environments', async () => {
      mockConfig.nodeEnv = 'development';
      process.env.NODE_ENV = 'development';
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-dev',
        email: 'dev-user@example.com',
      });

      const result = await authService.forgotPassword({
        email: 'dev-user@example.com',
      });

      expect(result.debugToken).toBe('mock-secure-random-token-12345');
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('blocks forgot-password when rate limit is exceeded', async () => {
      mockRedis.incrementRateLimit.mockResolvedValue({ count: 4, remainingTime: 600 });

      await expect(authService.forgotPassword({ email: 'spammer@example.com' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns generic message without updating tokens when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await authService.forgotPassword({ email: 'unknown@example.com' });
      expect(result.message).toContain('instructions have been sent');
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('resets password, clears reset token, revokes all user sessions, and logs audit event', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ complete_password_reset: 'u-reset' }]);

      const result = await authService.resetPassword({
        token: 'valid-reset-token',
        newPassword: 'NewPassword123!',
      });

      expect(result.message).toContain('Password has been successfully reset');
      expect(mockToken.revokeAllUserTokens).toHaveBeenCalledWith('u-reset');
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'u-reset',
          action: 'AUTH_PASSWORD_RESET_COMPLETED',
        }),
      );
    });

    it('rejects invalid or expired reset token', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await expect(
        authService.resetPassword({
          token: 'invalid-or-expired-token',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyEmail', () => {
    it('verifies email with valid token and clears verification token', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ verify_user_email: 'u-verify' }]);

      const result = await authService.verifyEmail('valid-raw-token');
      expect(result.message).toBe('Email address verified successfully');
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'u-verify',
          action: 'AUTH_EMAIL_VERIFIED',
        }),
      );
    });

    it('rejects invalid or expired verification token', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await expect(authService.verifyEmail('invalid-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendVerificationEmail', () => {
    it('generates new verification token for unverified user and logs audit event', async () => {
      mockConfig.nodeEnv = 'development';
      process.env.NODE_ENV = 'development';

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-resend',
        email: 'unverified@example.com',
        isEmailVerified: false,
      });

      const result = await authService.resendVerificationEmail('unverified@example.com');
      expect(result.debugToken).toBe('mock-secure-random-token-12345');
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'u-resend',
          action: 'AUTH_EMAIL_VERIFICATION_RESENT',
        }),
      );
    });

    it('does not send verification token if user is already verified or does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-already-verified',
        email: 'verified@example.com',
        isEmailVerified: true,
      });

      const result = await authService.resendVerificationEmail('verified@example.com');
      expect(result.debugToken).toBeUndefined();
      expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('blocks resend-verification when rate limit is exceeded', async () => {
      mockRedis.incrementRateLimit.mockResolvedValue({ count: 4, remainingTime: 600 });

      await expect(authService.resendVerificationEmail('spammer@example.com')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getMe', () => {
    it('retrieves user profile and active tenant when matching activeTenantId is requested', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-1',
        email: 'coach@example.com',
        name: 'Coach',
        phone: '+201000000001',
        isEmailVerified: true,
        createdAt: new Date(),
        memberships: [
          {
            id: 'mem-1',
            tenantId: 'tenant-1',
            role: 'COACH',
            status: 'ACTIVE',
            branchId: 'branch-1',
            tenant: { id: 'tenant-1', name: 'Nankatsu SC', slug: 'nankatsu-sc' },
            branch: { id: 'branch-1', name: 'الفرع الرئيسي' },
          },
          {
            id: 'mem-2',
            tenantId: 'tenant-2',
            role: 'ADMIN',
            status: 'ACTIVE',
            branchId: null,
            tenant: { id: 'tenant-2', name: 'Toho Academy', slug: 'toho-academy' },
            branch: null,
          },
        ],
      });

      const result = await authService.getMe('user-1', 'tenant-2');
      expect(result.user.email).toBe('coach@example.com');
      expect(result.activeTenant?.tenantId).toBe('tenant-2');
      expect(result.memberships).toHaveLength(2);
    });

    it('falls back to first active membership when requested tenant is not an active membership', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-1',
        email: 'coach@example.com',
        name: 'Coach',
        phone: null,
        isEmailVerified: true,
        createdAt: new Date(),
        memberships: [
          {
            id: 'mem-1',
            tenantId: 'tenant-1',
            role: 'COACH',
            status: 'ACTIVE',
            branchId: null,
            tenant: { id: 'tenant-1', name: 'Nankatsu SC', slug: 'nankatsu-sc' },
            branch: null,
          },
          {
            id: 'mem-revoked',
            tenantId: 'tenant-revoked',
            role: 'COACH',
            status: 'REVOKED',
            branchId: null,
            tenant: { id: 'tenant-revoked', name: 'Revoked SC', slug: 'revoked-sc' },
            branch: null,
          },
        ],
      });

      // Requesting the revoked tenant must fall back to the first active membership
      const result = await authService.getMe('user-1', 'tenant-revoked');
      expect(result.activeTenant?.tenantId).toBe('tenant-1');
      expect(result.memberships).toHaveLength(1);
    });
  });
});
