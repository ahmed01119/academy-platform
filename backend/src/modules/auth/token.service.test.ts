import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TokenService } from './token.service';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../database/prisma.service';
import type { AppConfigService } from '../../config/app-config.service';
import { UnauthorizedException } from '@nestjs/common';
import type { TenantRole } from '@academy/shared';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  $transaction: MockFn;
  $queryRaw: MockFn;
  user: { findUniqueOrThrow: MockFn; update: MockFn };
  refreshToken: {
    create: MockFn;
    findUnique: MockFn;
    findUniqueOrThrow: MockFn;
    update: MockFn;
    updateMany: MockFn;
  };
}

interface MockJwt {
  signAsync: MockFn;
}

/** The user row as returned by the FOR SHARE query in rotateRefreshToken. */
const lockedUser = (overrides: Partial<Record<string, unknown>> = {}) => [
  {
    email: 'coach@example.com',
    is_platform_super_admin: false,
    is_platform_owner: false,
    is_suspended: false,
    session_version: 3,
    ...overrides,
  },
];

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
      $queryRaw: vi.fn().mockResolvedValue(lockedUser()),
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ sessionVersion: 3 }),
        update: vi.fn().mockResolvedValue({ sessionVersion: 4 }),
      },
      refreshToken: {
        create: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ isRevoked: false, sessionVersion: 3 }),
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

  const activeToken = () => ({
    id: 'token-id-1',
    userId: 'user-123',
    familyId: 'family-1',
    expiresAt: new Date(Date.now() + 86_400_000),
  });

  it('hashes token with SHA-256 deterministically', () => {
    const hash1 = tokenService.hashToken('random-token-string');
    expect(hash1).toBe(tokenService.hashToken('random-token-string'));
    expect(hash1).toHaveLength(64);
  });

  it('issues an access/refresh pair stamped with the user session version', async () => {
    const result = await tokenService.generateTokens('user-123', 'coach@example.com', {
      tenantId: 'tenant-456',
      role: 'COACH' as TenantRole,
    });

    expect(result).toMatchObject({ accessToken: 'mock.jwt.token', expiresIn: 900 });
    expect(mockJwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-123', tenantId: 'tenant-456', sv: 3 }),
      expect.any(Object),
    );
    const created = mockPrisma.refreshToken.create.mock.calls[0]?.[0]?.data;
    expect(created).toMatchObject({ userId: 'user-123', sessionVersion: 3 });
    expect(created.tokenHash).toHaveLength(64);
    // The plain refresh token is never stored.
    expect(created.tokenHash).not.toBe(result.refreshToken);
  });

  it('uses an explicit session version and transaction client without an extra lookup', async () => {
    const tx = {
      user: { findUniqueOrThrow: vi.fn() },
      refreshToken: { create: vi.fn().mockResolvedValue({}) },
    };
    await tokenService.generateTokens(
      'user-123',
      'coach@example.com',
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      false,
      7,
      tx as never,
    );
    expect(tx.user.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.refreshToken.create.mock.calls[0]?.[0]?.data.sessionVersion).toBe(7);
    expect(mockJwt.signAsync.mock.calls[0]?.[0]?.sv).toBe(7);
  });

  it('rotates a refresh token within its family, under a row lock, carrying the current version', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(activeToken());

    const result = await tokenService.rotateRefreshToken('raw-old-token');

    expect(result.userId).toBe('user-123');
    // FOR SHARE on the user row serialises against password changes.
    const sql = (mockPrisma.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join('?');
    expect(sql).toMatch(/FOR SHARE/);
    // Consumed with a conditional update that also pins the session version.
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'token-id-1', isRevoked: false, sessionVersion: 3 },
      data: { isRevoked: true },
    });
    expect(mockPrisma.refreshToken.create.mock.calls[0]?.[0]?.data).toMatchObject({
      familyId: 'family-1',
      sessionVersion: 3,
    });
    expect(mockJwt.signAsync.mock.calls[0]?.[0]?.sv).toBe(3);
  });

  it('detects refresh token reuse and revokes the entire family', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(activeToken());
    mockPrisma.refreshToken.findUniqueOrThrow.mockResolvedValue({
      isRevoked: true,
      sessionVersion: 3,
    });

    await expect(tokenService.rotateRefreshToken('raw-reused-token')).rejects.toThrow(
      'Refresh token reuse detected',
    );
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-1' },
      data: { isRevoked: true },
    });
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('refuses a token from an older session version (password changed) without issuing anything', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(activeToken());
    mockPrisma.$queryRaw.mockResolvedValue(lockedUser({ session_version: 4 }));
    mockPrisma.refreshToken.findUniqueOrThrow.mockResolvedValue({
      isRevoked: false,
      sessionVersion: 3,
    });

    await expect(tokenService.rotateRefreshToken('raw-stale-token')).rejects.toThrow(
      'Session is no longer valid',
    );
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    expect(mockJwt.signAsync).not.toHaveBeenCalled();
  });

  it('treats a token revoked by a password change as a revoked session, not as reuse', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(activeToken());
    mockPrisma.$queryRaw.mockResolvedValue(lockedUser({ session_version: 4 }));
    mockPrisma.refreshToken.findUniqueOrThrow.mockResolvedValue({
      isRevoked: true,
      sessionVersion: 3,
    });

    await expect(tokenService.rotateRefreshToken('raw-token')).rejects.toThrow(
      'Session is no longer valid',
    );
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('refuses to rotate for a suspended user', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(activeToken());
    mockPrisma.$queryRaw.mockResolvedValue(lockedUser({ is_suspended: true }));

    await expect(tokenService.rotateRefreshToken('raw-token')).rejects.toThrow(
      'Session is no longer valid',
    );
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('detects a concurrent rotation race (conditional update loses) and revokes the family', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(activeToken());
    mockPrisma.refreshToken.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValue({ count: 2 });

    await expect(tokenService.rotateRefreshToken('raw-racing-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenLastCalledWith({
      where: { familyId: 'family-1' },
      data: { isRevoked: true },
    });
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects an expired refresh token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      ...activeToken(),
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(tokenService.rotateRefreshToken('raw-expired')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown refresh token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(tokenService.rotateRefreshToken('raw-unknown')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('revokes all user tokens', async () => {
    await tokenService.revokeAllUserTokens('user-reset-id');
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-reset-id' },
      data: { isRevoked: true },
    });
  });
});
