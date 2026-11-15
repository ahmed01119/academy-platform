/**
 * Real-PostgreSQL integration tests for K1 (reset SQL functions) and K13b (session versions under concurrency).
 *
 * Skipped unless INTEGRATION_DATABASE_URL points at a disposable database with all migrations applied (CI's
 * PostgreSQL service, or a local throwaway instance). Uses only synthetic data, created and removed per test.
 * Never point this at a shared or production database.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@academy/database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppConfigService } from '../../config/app-config.service';
import type { PrismaService } from '../database/prisma.service';
import { invalidateUserSessions } from './session-invalidation';
import { TokenService } from './token.service';

const url = process.env.INTEGRATION_DATABASE_URL;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

describe.skipIf(!url)('K13b session versions on real PostgreSQL', () => {
  let prisma: PrismaClient;
  let other: PrismaClient; // second connection pool, to run truly concurrent transactions
  let tokens: TokenService;
  let userId: string;
  let email: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url } } });
    other = new PrismaClient({ datasources: { db: { url } } });
    const config = {
      jwtSecret: 'integration-test-secret-0123456789abcdef',
      jwtExpiresIn: '15m',
      refreshTokenExpiresDays: 7,
    } as AppConfigService;
    tokens = new TokenService(new JwtService({}), config, prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await other.$disconnect();
  });

  beforeEach(async () => {
    userId = randomUUID();
    email = `k13b-${userId}@example.test`;
    await prisma.user.create({
      data: { id: userId, email, name: 'Synthetic', passwordHash: 'synthetic-hash' },
    });
    return async () => {
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    };
  });

  /** Resolves when `promise` settles, or returns 'pending' after `ms`. */
  const settledWithin = async <T>(promise: Promise<T>, ms: number) =>
    Promise.race([
      promise.then(
        () => 'fulfilled' as const,
        () => 'rejected' as const,
      ),
      new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), ms)),
    ]);

  it('deterministic: a refresh that starts while a password change holds the lock is refused', async () => {
    const issued = await tokens.generateTokens(userId, email);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));

    // A: password change - bumps the version (row lock) and revokes tokens, then waits before committing.
    const change = other.$transaction(
      async (tx) => {
        await invalidateUserSessions(tx, userId, { passwordHash: 'new-synthetic-hash' });
        locked();
        await held;
      },
      { timeout: 20_000 },
    );
    await lockTaken;

    // B: refresh with the old token - must block on FOR SHARE while A is uncommitted.
    const refresh = tokens.rotateRefreshToken(issued.refreshToken);
    expect(await settledWithin(refresh, 750)).toBe('pending');

    release();
    await change;
    // With FOR SHARE the refresh waits and is refused cleanly as a revoked session (not as token reuse).
    await expect(refresh).rejects.toThrow(/no longer valid/);

    const live = await prisma.refreshToken.count({ where: { userId, isRevoked: false } });
    expect(live).toBe(0);
  });

  it('deterministic: a refresh that won the lock first still cannot outlive the password change', async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { sessionVersion: true },
    });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const raced = `raced-${randomBytes(8).toString('hex')}`;

    // B: what a rotation does once it holds FOR SHARE - insert its new token with the version it read.
    const rotation = other.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT session_version FROM public.users WHERE id = ${userId}::uuid FOR SHARE`;
        locked();
        await held;
        await tx.refreshToken.create({
          data: {
            userId,
            tokenHash: sha256(raced),
            familyId: randomUUID(),
            expiresAt: new Date(Date.now() + 86_400_000),
            sessionVersion: before.sessionVersion,
          },
        });
      },
      { timeout: 20_000 },
    );
    await lockTaken;

    // A: password change - must wait for B, then revoke B's freshly committed token too.
    const change = prisma.$transaction((tx) => invalidateUserSessions(tx, userId), {
      timeout: 20_000,
    });
    expect(await settledWithin(change, 750)).toBe('pending');

    release();
    await rotation;
    const { sessionVersion } = await change;

    expect(sessionVersion).toBe(before.sessionVersion + 1);
    const racedRow = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: sha256(raced) },
    });
    expect(racedRow.isRevoked).toBe(true);
    expect(racedRow.sessionVersion).toBe(before.sessionVersion);
    await expect(tokens.rotateRefreshToken(raced)).rejects.toThrow();
  });

  it('stress: 50 parallel refreshes racing a password change never leave a usable old session', async () => {
    const devices = await Promise.all(
      Array.from({ length: 50 }, () => tokens.generateTokens(userId, email)),
    );

    const results = await Promise.allSettled([
      ...devices.map((d) => tokens.rotateRefreshToken(d.refreshToken)),
      prisma.$transaction((tx) => invalidateUserSessions(tx, userId), { timeout: 30_000 }),
    ]);
    const changed = results.at(-1);
    expect(changed?.status).toBe('fulfilled');

    const { sessionVersion } = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { sessionVersion: true },
    });
    // No live refresh token may exist after the change...
    expect(await prisma.refreshToken.count({ where: { userId, isRevoked: false } })).toBe(0);
    // ...and every access token minted during the race carries an older version.
    for (const r of results.slice(0, -1)) {
      if (r.status === 'fulfilled' && 'tokens' in r.value) {
        const claims = new JwtService({}).decode(r.value.tokens.accessToken) as { sv: number };
        expect(claims.sv).toBeLessThan(sessionVersion);
      }
    }
  });

  it('pre-K13b refresh tokens (version 0) keep working until the first bump', async () => {
    const issued = await tokens.generateTokens(userId, email);
    await expect(tokens.rotateRefreshToken(issued.refreshToken)).resolves.toMatchObject({ userId });
  });
});

describe.skipIf(!url)('K1 reset functions on real PostgreSQL', () => {
  let prisma: PrismaClient;
  let userId: string;
  let email: string;

  beforeAll(() => {
    prisma = new PrismaClient({ datasources: { db: { url } } });
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    userId = randomUUID();
    email = `k1-${userId}@example.test`;
    await prisma.user.create({
      data: { id: userId, email, name: 'Synthetic', passwordHash: 'old' },
    });
    return async () => {
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    };
  });

  const issue = async (code: string, link: string, minutes = 5) =>
    prisma.$queryRaw`SELECT public.request_password_reset_with_link(${email}, ${sha256(code)}, ${sha256(link)}, ${new Date(Date.now() + minutes * 60_000)})`;
  const byCode = (mail: string, code: string) =>
    prisma.$queryRaw<
      Array<{ id: string }>
    >`SELECT public.complete_password_reset_for_email(${mail}, ${sha256(code)}, 'new') AS id`;
  const byLink = (link: string) =>
    prisma.$queryRaw<
      Array<{ id: string }>
    >`SELECT public.complete_password_reset_by_link(${sha256(link)}, 'new') AS id`;
  const row = () =>
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        passwordHash: true,
        passwordResetToken: true,
        passwordResetLinkToken: true,
        sessionVersion: true,
      },
    });

  it('stores only hashes and caps expiry at 5 minutes', async () => {
    await issue('123456', 'L'.repeat(64), 60);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        passwordResetToken: true,
        passwordResetLinkToken: true,
        passwordResetExpiresAt: true,
      },
    });
    expect(stored.passwordResetToken).toBe(sha256('123456'));
    expect(stored.passwordResetLinkToken).toBe(sha256('L'.repeat(64)));
    expect(stored.passwordResetExpiresAt!.getTime() - Date.now()).toBeLessThanOrEqual(
      5 * 60_000 + 2_000,
    );
  });

  it('binds the code to its e-mail; success is single-use, bumps the version and revokes sessions atomically', async () => {
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(randomUUID()),
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await issue('123456', 'L'.repeat(64));
    await expect(byCode('someone-else@example.test', '123456')).rejects.toThrow(
      /INVALID_OR_EXPIRED_TOKEN/,
    );

    await byCode(email.toUpperCase(), '123456');
    const after = await row();
    expect(after).toMatchObject({
      passwordHash: 'new',
      passwordResetToken: null,
      passwordResetLinkToken: null,
      sessionVersion: 1,
    });
    expect(await prisma.refreshToken.count({ where: { userId, isRevoked: false } })).toBe(0);

    // Single use: neither the code nor the link works a second time.
    await expect(byCode(email, '123456')).rejects.toThrow(/INVALID_OR_EXPIRED_TOKEN/);
    await expect(byLink('L'.repeat(64))).rejects.toThrow(/INVALID_OR_EXPIRED_TOKEN/);
  });

  it('cancelling the code after failed attempts leaves the link valid', async () => {
    await issue('123456', 'L'.repeat(64));
    await prisma.$executeRaw`SELECT public.invalidate_password_reset_code_for_email(${email})`;
    await expect(byCode(email, '123456')).rejects.toThrow(/INVALID_OR_EXPIRED_TOKEN/);
    await byLink('L'.repeat(64));
    expect((await row()).passwordHash).toBe('new');
  });

  it('refuses expired codes and links', async () => {
    await issue('123456', 'L'.repeat(64));
    await prisma.$executeRaw`UPDATE public.users SET password_reset_expires_at = now() - interval '1 second' WHERE id = ${userId}::uuid`;
    await expect(byCode(email, '123456')).rejects.toThrow(/INVALID_OR_EXPIRED_TOKEN/);
    await expect(byLink('L'.repeat(64))).rejects.toThrow(/INVALID_OR_EXPIRED_TOKEN/);
    expect((await row()).passwordHash).toBe('old');
  });
});
