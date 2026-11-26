import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../../../config/app-config.service';
import type { PrismaService } from '../../database/prisma.service';
import { JwtStrategy } from './jwt.strategy';

function strategyFor(user: Record<string, unknown> | null) {
  const prisma = {
    withAuthLookupTransaction: vi.fn(async (_opts: unknown, fn: (tx: unknown) => unknown) =>
      fn({ user: { findUnique: vi.fn().mockResolvedValue(user) } }),
    ),
  };
  const config = { jwtSecret: 'test-secret-at-least-32-chars-long-12345' } as AppConfigService;
  return new JwtStrategy(config, prisma as unknown as PrismaService);
}

const user = (sessionVersion: number) => ({
  id: 'user-1',
  email: 'a@example.com',
  name: 'A',
  phone: null,
  isEmailVerified: true,
  isPlatformSuperAdmin: false,
  isPlatformOwner: false,
  sessionVersion,
  memberships: [],
});

describe('JwtStrategy session version (K13b)', () => {
  it('accepts a token whose version matches the user', async () => {
    const result = await strategyFor(user(4)).validate({
      sub: 'user-1',
      email: 'a@example.com',
      sv: 4,
    });
    expect(result.id).toBe('user-1');
  });

  it('rejects a token issued before a password change, reset, suspension or revocation', async () => {
    await expect(
      strategyFor(user(5)).validate({ sub: 'user-1', email: 'a@example.com', sv: 4 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token claiming a newer version than the user has', async () => {
    await expect(
      strategyFor(user(1)).validate({ sub: 'user-1', email: 'a@example.com', sv: 2 }),
    ).rejects.toThrow('Session is no longer valid');
  });

  it('treats pre-K13b tokens (no sv) as version 0: valid until the first bump', async () => {
    await expect(
      strategyFor(user(0)).validate({ sub: 'user-1', email: 'a@example.com' }),
    ).resolves.toMatchObject({ id: 'user-1' });
    await expect(
      strategyFor(user(1)).validate({ sub: 'user-1', email: 'a@example.com' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token for a user that no longer exists', async () => {
    await expect(
      strategyFor(null).validate({ sub: 'gone', email: 'x@example.com', sv: 0 }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
