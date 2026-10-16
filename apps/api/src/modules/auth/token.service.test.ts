import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TokenService } from './token.service';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../database/prisma.service';
import type { AppConfigService } from '../../config/app-config.service';
import { UnauthorizedException } from '@nestjs/common';
import { TenantRole } from '@academy/shared';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  $transaction: MockFn;
  refreshToken: {
    create: MockFn;
    findUnique: MockFn;
    update: MockFn;
    updateMany: MockFn;
  };
}

interface MockJwt {
  signAsync: MockFn;
}

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockPrisma: MockPrisma;
  let mockJwt: MockJwt;
  let mockConfig: AppConfigService;

  beforeEach(() => {
    mockConfig = {
      jwtSecret: 'test-secret-at-least-32-chars-long-12345',
      jwtExpiresIn: '15m',
      refreshTokenExpiresDays: 30,
    } as AppConfigService;

    mockJwt = {
      signAsync: vi.fn().mockResolvedValue('mock.jwt.token'),
    };

    mockPrisma = {
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
      refreshToken: {
        create: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    tokenService = new TokenService(
      mockJwt as unknown as JwtService,
      mockConfig,
      mockPrisma as unknown as PrismaService,
    );
  });

  it('hashes token with SHA-256 deterministically', () => {
    const raw = 'random-token-string';
    const hash1 = tokenService.hashToken(raw);
    const hash2 = tokenService.hashToken(raw);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('generates access and refresh tokens pair', async () => {
    const result = await tokenService.generateTokens('user-123', 'coach@example.com', {
      tenantId: 'tenant-456',
      role: TenantRole.COACH,
      branchId: 'branch-789',
    });

    expect(result.accessToken).toBe('mock.jwt.token');
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBe(900);
    expect(mockJwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-123',
        email: 'coach@example.com',
        tenantId: 'tenant-456',
        role: TenantRole.COACH,
        branchId: 'branch-789',
      }),
      expect.objectContaining({
        secret: mockConfig.jwtSecret,
        expiresIn: '15m',
      }),
    );
  });

  it('rotates refresh token and replaces old token with new one in same family', async () => {
    const rawOldToken = 'old-raw-token';
    const oldHash = tokenService.hashToken(rawOldToken);

    const existingSession = {
      id: 'session-1',
      tokenHash: oldHash,
      familyId: 'family-abc',
      userId: 'user-123',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 1000000),
      user: {
        email: 'coach@example.com',
      },
    };

    mockPrisma.refreshToken.findUnique.mockResolvedValue(existingSession);
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await tokenService.rotateRefreshToken(rawOldToken);

    expect(result.userId).toBe('user-123');
    expect(result.email).toBe('coach@example.com');
    expect(result.tokens.accessToken).toBe('mock.jwt.token');
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', isRevoked: false },
      data: { isRevoked: true },
    });
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          familyId: 'family-abc',
          userId: 'user-123',
        }),
      }),
    );
  });

  it('detects refresh token reuse and revokes entire family', async () => {
    const rawReusedToken = 'already-revoked-token';
    const reusedHash = tokenService.hashToken(rawReusedToken);

    const revokedSession = {
      id: 'session-compromised',
      tokenHash: reusedHash,
      familyId: 'family-compromised',
      userId: 'user-victim',
      isRevoked: true, // ALREADY REVOKED! Token reuse detected
      expiresAt: new Date(Date.now() + 1000000),
      user: {
        email: 'victim@example.com',
      },
    };

    mockPrisma.refreshToken.findUnique.mockResolvedValue(revokedSession);
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 5 });

    await expect(tokenService.rotateRefreshToken(rawReusedToken)).rejects.toThrow(
      UnauthorizedException,
    );

    // Verify all tokens in the compromised family were invalidated
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-compromised' },
      data: { isRevoked: true },
    });
  });

  it('detects concurrent rotation race condition and invalidates family', async () => {
    const rawToken = 'racing-token';
    const tokenHash = tokenService.hashToken(rawToken);

    const session = {
      id: 'session-racing',
      tokenHash,
      familyId: 'family-racing',
      userId: 'user-race',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 1000000),
      user: {
        email: 'race@example.com',
      },
    };

    mockPrisma.refreshToken.findUnique.mockResolvedValue(session);
    // Simulate losing the race: updateMany conditional update returned count 0
    mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(tokenService.rotateRefreshToken(rawToken)).rejects.toThrow(UnauthorizedException);

    // Verify family was revoked due to race condition / suspected replay
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-racing' },
      data: { isRevoked: true },
    });
  });

  it('rejects expired refresh token', async () => {
    const rawToken = 'expired-token';
    const tokenHash = tokenService.hashToken(rawToken);

    const expiredSession = {
      id: 'session-expired',
      tokenHash,
      familyId: 'family-expired',
      userId: 'user-expired',
      isRevoked: false,
      expiresAt: new Date(Date.now() - 10000), // in the past
      user: { email: 'expired@example.com' },
    };

    mockPrisma.refreshToken.findUnique.mockResolvedValue(expiredSession);

    await expect(tokenService.rotateRefreshToken(rawToken)).rejects.toThrow(UnauthorizedException);
  });

  it('revokes entire family on logout when token is found', async () => {
    const rawToken = 'logout-token';
    const tokenHash = tokenService.hashToken(rawToken);

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'session-logout',
      tokenHash,
      familyId: 'family-logout',
    });

    await tokenService.revokeRefreshToken(rawToken);

    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-logout' },
      data: { isRevoked: true },
    });
  });

  it('revokes all sessions on password reset', async () => {
    await tokenService.revokeAllUserTokens('user-reset-id');

    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-reset-id' },
      data: { isRevoked: true },
    });
  });
});
