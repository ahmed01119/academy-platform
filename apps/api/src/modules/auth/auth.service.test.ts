import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
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
    create: MockFn;
    update: MockFn;
  };
  tenant: {
    findUnique: MockFn;
    create: MockFn;
  };
  branch: {
    create: MockFn;
  };
  tenantSport: {
    create: MockFn;
  };
  tenantMembership: {
    create: MockFn;
    findMany: MockFn;
  };
  $transaction: MockFn;
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
        create: vi.fn(),
        update: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      branch: {
        create: vi.fn().mockResolvedValue({
          id: 'branch-1',
          name: 'الفرع الرئيسي',
        }),
      },
      tenantSport: {
        create: vi.fn().mockResolvedValue({}),
      },
      tenantMembership: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation((fn) => fn(mockPrisma)),
    };

    mockPassword = {
      hash: vi.fn().mockResolvedValue('argon2id$mock$hash'),
      verify: vi.fn().mockResolvedValue(false),
    };

    mockToken = {
      generateSecureRandomString: vi.fn().mockReturnValue('mock-reset-token-12345'),
      generateTokens: vi.fn().mockResolvedValue({
        accessToken: 'mock.access.token',
        refreshToken: 'mock.refresh.token',
        expiresIn: 900,
      }),
      hashToken: vi.fn().mockReturnValue('hashed-token-value'),
      createRefreshTokenSession: vi.fn().mockResolvedValue({}),
      rotateRefreshToken: vi.fn(),
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

  it('registers new user, creates academy and owner membership', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.tenant.create.mockResolvedValue({
      id: 'tenant-1',
      name: 'Nankatsu SC',
      slug: 'nankatsu-sc',
    });
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'captain@example.com',
      name: 'Captain Tsubasa',
      isEmailVerified: true,
      createdAt: new Date(),
    });
    mockPrisma.tenantMembership.create.mockResolvedValue({
      id: 'membership-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: 'OWNER',
      status: 'ACTIVE',
      tenant: { id: 'tenant-1', name: 'Nankatsu SC', slug: 'nankatsu-sc' },
      branch: { id: 'branch-1', name: 'الفرع الرئيسي' },
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
    expect(mockAudit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUTH_REGISTER',
      }),
    );
  });

  it('fails login on invalid credentials with constant-time dummy verification', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null); // User not found
    mockPassword.verify.mockResolvedValue(false);

    await expect(
      authService.login({
        email: 'nonexistent@example.com',
        password: 'Password123!',
      }),
    ).rejects.toThrow(UnauthorizedException);

    // Verify constant-time dummy verify was called to protect against timing attacks
    expect(mockPassword.verify).toHaveBeenCalled();
  });

  it('blocks login when rate limit is exceeded', async () => {
    mockRedis.incrementRateLimit.mockResolvedValue({
      count: 10, // Exceeded max 5
      remainingTime: 900,
    });

    await expect(
      authService.login({
        email: 'victim@example.com',
        password: 'Password123!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('omits debugToken in production for forgotPassword', async () => {
    mockConfig.nodeEnv = 'production';
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

  it('verifies email with valid token', async () => {
    mockPrisma.user.findFirst = vi.fn().mockResolvedValue({
      id: 'u-verify',
      email: 'unverified@example.com',
      emailVerificationToken: 'hashed-token-value',
      emailVerificationExpiresAt: new Date(Date.now() + 100000),
    });

    const result = await authService.verifyEmail('valid-raw-token');
    expect(result.message).toBe('Email address verified successfully');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-verify' },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });
  });
});
