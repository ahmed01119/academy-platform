import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
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
    findMany: MockFn;
    create: MockFn;
    update: MockFn;
  };
  tenant: {
    findUnique: MockFn;
  };
  academyApplication: {
    findFirst: MockFn;
    create: MockFn;
  };
  tenantMembership: {
    findMany: MockFn;
  };
  player: { count: MockFn };
  guardian: { count: MockFn };
  playerRegistrationRequest: { findFirst: MockFn };
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
  peekRateLimit: MockFn;
}

interface MockAudit {
  logEvent: MockFn;
}

/** The SQL text of a tagged-template $queryRaw / $executeRaw mock call, for asserting which function was called. */
function sqlText(call: unknown[] | undefined): string {
  return ((call?.[0] ?? []) as string[]).join('?');
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
        findMany: vi.fn().mockResolvedValue([]),
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      academyApplication: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'app-1',
          academyName: 'Nankatsu SC',
          academySlug: 'nankatsu-sc',
          status: 'PENDING_REVIEW',
        }),
      },
      tenantMembership: {
        findMany: vi.fn(),
      },
      player: { count: vi.fn().mockResolvedValue(0) },
      guardian: { count: vi.fn().mockResolvedValue(0) },
      playerRegistrationRequest: { findFirst: vi.fn().mockResolvedValue(null) },
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
      peekRateLimit: vi.fn().mockResolvedValue(0),
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue({}),
    };

    mockConfig = {
      nodeEnv: 'test',
    };

    const mockEmail = {
      sendAcademyApplicationReceived: vi.fn().mockResolvedValue(true),
      sendAcademyApproved: vi.fn().mockResolvedValue(true),
      sendPasswordReset: vi.fn().mockResolvedValue(true),
      sendEmailVerification: vi.fn().mockResolvedValue(true),
      sendEmail: vi.fn().mockResolvedValue(true),
    };

    const mockNotifications = {
      createNotification: vi.fn().mockResolvedValue({}),
    };

    authService = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockPassword as unknown as PasswordService,
      mockToken as unknown as TokenService,
      mockRedis as unknown as RedisService,
      mockAudit as unknown as AuditService,
      mockConfig as unknown as AppConfigService,
      mockEmail as any,
      mockNotifications as any,
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

    /** Routes the register flow's raw queries by their SQL text. */
    const routeRegisterQueries = (slugTaken: boolean[] = []) => {
      mockPrisma.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
        const sql = strings.join('?');
        if (sql.includes('academy_slug_in_use'))
          return Promise.resolve([{ in_use: slugTaken.shift() ?? false }]);
        if (sql.includes('INSERT INTO public.users')) return Promise.resolve([{ id: 'user-1' }]);
        if (sql.includes('INSERT INTO public.academy_applications'))
          return Promise.resolve([{ id: 'app-1' }]);
        return Promise.resolve([]);
      });
    };
    const callsMatching = (text: string) =>
      mockPrisma.$queryRaw.mock.calls.filter((c: unknown[]) => sqlText(c).includes(text));

    it('registers new user, creates academy application in PENDING_REVIEW, and dispatches confirmation email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      routeRegisterQueries();

      const result = await authService.register({
        name: 'Captain Tsubasa',
        email: 'Captain@Example.com',
        password: 'Password123!',
        academyName: 'Nankatsu SC',
        sport: 'FOOTBALL',
      });

      expect(result.response.status).toBe('PENDING_REVIEW');
      expect(result.response.applicationId).toBe('app-1');
      expect(result.response.academyName).toBe('Nankatsu SC');

      // Phase 3A.2: both inserts name only the columns the runtime role may write; status and is_email_verified come
      // from the database defaults (Prisma's create() would send them and be refused).
      const [userInsert] = callsMatching('INSERT INTO public.users');
      expect(sqlText(userInsert)).toContain(
        '(id, email, password_hash, name, phone, created_at, updated_at)',
      );
      expect(sqlText(userInsert)).not.toContain('is_email_verified');
      expect(userInsert?.slice(1, 4)).toEqual([
        'captain@example.com',
        'argon2id$mock$hash',
        'Captain Tsubasa',
      ]);
      const [applicationInsert] = callsMatching('INSERT INTO public.academy_applications');
      expect(sqlText(applicationInsert)).not.toMatch(/\bstatus\b/);
      expect(applicationInsert?.slice(1, 4)).toEqual(['user-1', 'Nankatsu SC', 'nankatsu-sc']);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.academyApplication.create).not.toHaveBeenCalled();

      // The applicant is the transaction's actor before the application insert (RLS academy_applications_insert).
      const actorCall = mockPrisma.$executeRaw.mock.calls.find((c: unknown[]) =>
        sqlText(c).includes("set_config('app.actor_user_id'"),
      );
      expect(actorCall?.[1]).toBe('user-1');
      const applicationInsertIndex = applicationInsert
        ? mockPrisma.$queryRaw.mock.calls.indexOf(applicationInsert)
        : -1;
      expect(mockPrisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mockPrisma.$queryRaw.mock.invocationCallOrder[applicationInsertIndex] ?? 0,
      );

      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ACADEMY_APPLICATION_SUBMITTED',
          resourceType: 'AcademyApplication',
        }),
      );
    });

    it('resolves slug collision by appending numeric suffix', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      routeRegisterQueries([true, false]); // the first candidate is taken, the suffixed one is free

      const result = await authService.register({
        name: 'Captain Tsubasa',
        email: 'captain@example.com',
        password: 'Password123!',
        academyName: 'Nankatsu SC',
        sport: 'FOOTBALL',
      });

      expect(result.response.status).toBe('PENDING_REVIEW');
      expect(callsMatching('academy_slug_in_use').map((c: unknown[]) => c[1])).toEqual([
        'nankatsu-sc',
        'nankatsu-sc-1',
      ]);
      expect(callsMatching('INSERT INTO public.academy_applications')[0]?.[3]).toBe(
        'nankatsu-sc-1',
      );
    });

    it('maps a concurrent duplicate e-mail to 409', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      routeRegisterQueries();
      mockPrisma.$transaction.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint "users_email_key"'),
      );
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

  describe('login gating for applicants (K6)', () => {
    const applicant = {
      id: 'user-9',
      email: 'parent@example.com',
      passwordHash: 'stored-hash',
      name: 'Parent',
      phone: null,
      isEmailVerified: false,
      isPlatformSuperAdmin: false,
      isPlatformOwner: false,
      isSuspended: false,
      createdAt: new Date(),
    };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(applicant);
      mockPassword.verify.mockResolvedValue(true);
      mockPrisma.tenantMembership.findMany.mockResolvedValue([]);
    });

    it('refuses a PLAYER applicant whose join request is pending', async () => {
      mockPrisma.playerRegistrationRequest.findFirst.mockResolvedValue({
        status: 'PENDING_REVIEW',
        requesterType: 'PLAYER',
      });
      await expect(
        authService.login({ email: applicant.email, password: 'x' }),
      ).rejects.toMatchObject({ response: { code: 'PLAYER_PENDING_APPROVAL' } });
    });

    it('refuses a GUARDIAN applicant whose join request is pending, with its own code', async () => {
      mockPrisma.playerRegistrationRequest.findFirst.mockResolvedValue({
        status: 'PENDING_REVIEW',
        requesterType: 'GUARDIAN',
      });
      await expect(
        authService.login({ email: applicant.email, password: 'x' }),
      ).rejects.toMatchObject({ response: { code: 'GUARDIAN_PENDING_APPROVAL' } });
    });

    it('refuses an applicant while more information is requested', async () => {
      mockPrisma.playerRegistrationRequest.findFirst.mockResolvedValue({
        status: 'MORE_INFO_REQUESTED',
        requesterType: 'GUARDIAN',
      });
      await expect(
        authService.login({ email: applicant.email, password: 'x' }),
      ).rejects.toMatchObject({ response: { code: 'JOIN_MORE_INFO_REQUESTED' } });
    });

    it('lets a guardian who already uses the portal sign in while a new request is pending', async () => {
      mockPrisma.guardian.count.mockResolvedValue(1);
      mockPrisma.playerRegistrationRequest.findFirst.mockResolvedValue({
        status: 'PENDING_REVIEW',
        requesterType: 'GUARDIAN',
      });

      const result = await authService.login({ email: applicant.email, password: 'x' });

      expect(result.response.user.hasGuardianProfile).toBe(true);
      expect(result.response.user.hasPlayerProfile).toBe(false);
      // the pending request is not even read: the account already has access
      expect(mockPrisma.playerRegistrationRequest.findFirst).not.toHaveBeenCalled();
    });

    it("reads the portal links under the user's own actor context", async () => {
      mockPrisma.player.count.mockResolvedValue(1);

      const result = await authService.login({ email: applicant.email, password: 'x' });

      expect(result.response.user.hasPlayerProfile).toBe(true);
      expect(mockPrisma.player.count).toHaveBeenCalledWith({ where: { userId: 'user-9' } });
      expect(mockPrisma.withAuthLookupTransaction).toHaveBeenCalledWith(
        { actorUserId: 'user-9' },
        expect.any(Function),
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

  describe('K1 password reset', () => {
    /** In-memory counters behaving like RedisService (no expiry; `expire` simulates a window passing). */
    let counters: Map<string, number>;
    const expire = (fragment: string) => {
      for (const key of [...counters.keys()]) if (key.includes(fragment)) counters.delete(key);
    };
    const emailService = () =>
      (authService as unknown as { emailService: { sendPasswordReset: MockFn } }).emailService;
    const LINK = 'a'.repeat(64);
    const user = { id: 'u-1', name: 'Test User', email: 'user@example.com' };
    const invalidToken = () => new Error('db error: INVALID_OR_EXPIRED_TOKEN');

    beforeEach(() => {
      counters = new Map();
      mockRedis.incrementRateLimit.mockImplementation(async (key: string) => {
        const count = (counters.get(key) ?? 0) + 1;
        counters.set(key, count);
        return { count, remainingTime: 300 };
      });
      mockRedis.resetRateLimit.mockImplementation(async (key: string) => {
        counters.delete(key);
      });
      mockRedis.peekRateLimit.mockImplementation(async (key: string) => counters.get(key) ?? 0);
      mockToken.hashToken.mockImplementation((value: string) => `sha256(${value})`);
      mockToken.generateSecureRandomString.mockReturnValue(LINK);
    });

    describe('forgotPassword', () => {
      it('issues a code and a 256-bit link, stores only their hashes, and e-mails the link in the URL fragment', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(user);

        const result = await authService.forgotPassword(
          { email: 'User@Example.com ' },
          '203.0.113.7',
        );

        expect(result.message).toContain('instructions have been sent');
        expect(mockToken.generateSecureRandomString).toHaveBeenCalledWith(32); // 32 bytes = 256 bits
        const [sql, ...values] = mockPrisma.$queryRaw.mock.calls[0] as [
          TemplateStringsArray,
          ...unknown[],
        ];
        expect(sql.join('?')).toContain('request_password_reset_with_link');
        const [email, codeHash, linkHash, expiresAt] = values as [string, string, string, Date];
        expect(email).toBe('user@example.com');
        expect(codeHash).toMatch(/^sha256\(\d{6}\)$/);
        expect(linkHash).toBe(`sha256(${LINK})`);
        expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);

        const [, , resetUrl, , code] = emailService().sendPasswordReset.mock.calls[0] as string[];
        expect(resetUrl).toContain(`/reset-password#token=${LINK}&email=user%40example.com`);
        expect(resetUrl).not.toContain('?token=');
        expect(codeHash).toBe(`sha256(${code})`);
      });

      it('responds identically for an unknown e-mail and never touches the database or sends mail', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        const result = await authService.forgotPassword(
          { email: 'unknown@example.com' },
          '203.0.113.7',
        );
        expect(result.message).toContain('instructions have been sent');
        expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
        expect(emailService().sendPasswordReset).not.toHaveBeenCalled();
      });

      it('never resets the 24 h code-failure counter when a new code is issued', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(user);
        counters.set('ratelimit:reset-code-failures-daily:user@example.com', 7);
        await authService.forgotPassword({ email: 'user@example.com' }, '203.0.113.7');
        expect(counters.get('ratelimit:reset-code-failures-daily:user@example.com')).toBe(7);
      });

      it('allows one request per minute per e-mail, for known and unknown accounts alike', async () => {
        for (const found of [user, null]) {
          counters.clear();
          mockPrisma.user.findUnique.mockResolvedValue(found);
          await authService.forgotPassword({ email: 'user@example.com' }, '203.0.113.7');
          await expect(
            authService.forgotPassword({ email: 'user@example.com' }, '203.0.113.7'),
          ).rejects.toMatchObject({ response: { code: 'RATE_LIMIT_EXCEEDED' } });
        }
      });

      it('after 3 requests in an hour, requires 5 minutes (the code lifetime) between requests', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(user);
        for (let i = 0; i < 3; i++) {
          await authService.forgotPassword({ email: 'user@example.com' }, `203.0.113.${i}`);
          expire('cooldown:60:'); // a minute passes
        }
        await authService.forgotPassword({ email: 'user@example.com' }, '203.0.113.9'); // 4th: allowed
        expire('cooldown:60:');
        await expect(
          authService.forgotPassword({ email: 'user@example.com' }, '203.0.113.10'),
        ).rejects.toMatchObject({ response: { code: 'RATE_LIMIT_EXCEEDED' } });
      });

      it('limits one IP to 10 reset requests per hour across all e-mails (anti-flooding)', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        for (let i = 0; i < 10; i++) {
          await authService.forgotPassword({ email: `victim${i}@example.com` }, '198.51.100.1');
        }
        await expect(
          authService.forgotPassword({ email: 'victim10@example.com' }, '198.51.100.1'),
        ).rejects.toMatchObject({ response: { code: 'RATE_LIMIT_EXCEEDED' } });
      });
    });

    describe('resetPassword', () => {
      const withCode = (code = '123456', email = 'user@example.com') => ({
        token: code,
        email,
        newPassword: 'NewPassword123!',
      });

      it('completes with the code only for the e-mail it was sent to, in one atomic function call', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([{ complete_password_reset_for_email: 'u-1' }]);

        const result = await authService.resetPassword(
          withCode('123456', 'User@Example.com'),
          '203.0.113.7',
        );

        expect(result.message).toContain('successfully reset');
        const [sql, ...values] = mockPrisma.$queryRaw.mock.calls[0] as [
          TemplateStringsArray,
          ...unknown[],
        ];
        expect(sql.join('?')).toContain('complete_password_reset_for_email');
        expect(values).toEqual(['user@example.com', 'sha256(123456)', 'argon2id$mock$hash']);
        expect(mockAudit.logEvent).toHaveBeenCalledWith(
          expect.objectContaining({ actorUserId: 'u-1', action: 'AUTH_PASSWORD_RESET_COMPLETED' }),
        );
      });

      it('rejects a correct code with another e-mail (the database binds code to e-mail) with the generic error', async () => {
        mockPrisma.$queryRaw.mockRejectedValue(invalidToken());
        await expect(
          authService.resetPassword(withCode('123456', 'other@example.com'), '203.0.113.7'),
        ).rejects.toMatchObject({ response: { code: 'TOKEN_INVALID' } });
      });

      it('cancels the code after 5 wrong attempts', async () => {
        mockPrisma.$queryRaw.mockRejectedValue(invalidToken());
        for (let i = 0; i < 5; i++) {
          await expect(
            authService.resetPassword(withCode(`00000${i}`), '203.0.113.7'),
          ).rejects.toThrow();
        }
        const invalidations = mockPrisma.$executeRaw.mock.calls.filter((c) =>
          (c[0] as TemplateStringsArray)
            .join('?')
            .includes('invalidate_password_reset_code_for_email'),
        );
        expect(invalidations).toHaveLength(1); // on the 5th failure
        expect(invalidations[0]?.[1]).toBe('user@example.com');
      });

      it('after 10 failed code attempts in 24 h refuses code entry - even the correct code - without a DB call', async () => {
        counters.set('ratelimit:reset-code-failures-daily:user@example.com', 10);
        mockPrisma.$queryRaw.mockResolvedValue([{ complete_password_reset_for_email: 'u-1' }]);

        await expect(authService.resetPassword(withCode(), '203.0.113.7')).rejects.toMatchObject({
          response: { code: 'TOKEN_INVALID' },
        });
        expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      });

      it('keeps the e-mailed link working while code entry is suspended (no account-denial)', async () => {
        counters.set('ratelimit:reset-code-failures-daily:user@example.com', 10);
        mockPrisma.$queryRaw.mockResolvedValue([{ complete_password_reset_by_link: 'u-1' }]);

        const result = await authService.resetPassword(
          { token: LINK, newPassword: 'NewPassword123!' },
          '203.0.113.7',
        );
        expect(result.message).toContain('successfully reset');
        const [sql, ...values] = mockPrisma.$queryRaw.mock.calls[0] as [
          TemplateStringsArray,
          ...unknown[],
        ];
        expect(sql.join('?')).toContain('complete_password_reset_by_link');
        expect(values[0]).toBe(`sha256(${LINK})`);
      });

      it('does not count link failures against the account', async () => {
        mockPrisma.$queryRaw.mockRejectedValue(invalidToken());
        await expect(
          authService.resetPassword({ token: LINK, newPassword: 'NewPassword123!' }, '203.0.113.7'),
        ).rejects.toMatchObject({ response: { code: 'TOKEN_INVALID' } });
        expect([...counters.keys()].some((k) => k.includes('reset-code'))).toBe(false);
      });

      it('falls back to the legacy function for platform activation links', async () => {
        mockPrisma.$queryRaw
          .mockRejectedValueOnce(invalidToken())
          .mockResolvedValueOnce([{ complete_password_reset: 'u-staff' }]);

        await authService.resetPassword(
          { token: 'b'.repeat(64), newPassword: 'NewPassword123!' },
          '203.0.113.7',
        );

        const sql = (mockPrisma.$queryRaw.mock.calls[1]?.[0] as TemplateStringsArray).join('?');
        expect(sql).toContain('public.complete_password_reset(');
      });

      it('refuses malformed tokens and codes without an e-mail before touching the database', async () => {
        for (const token of ['abc123xyz', '12345', '1234567', 'g'.repeat(64)]) {
          await expect(
            authService.resetPassword({ token, newPassword: 'NewPassword123!' }, '203.0.113.7'),
          ).rejects.toMatchObject({ response: { code: 'TOKEN_INVALID' } });
        }
        await expect(
          authService.resetPassword(
            { token: '123456', newPassword: 'NewPassword123!' },
            '203.0.113.7',
          ),
        ).rejects.toMatchObject({ response: { code: 'TOKEN_INVALID' } });
        expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      });

      it('limits one IP to 30 reset attempts per 15 minutes across accounts', async () => {
        mockPrisma.$queryRaw.mockRejectedValue(invalidToken());
        for (let i = 0; i < 30; i++) {
          await expect(
            authService.resetPassword(withCode('123456', `user${i}@example.com`), '198.51.100.1'),
          ).rejects.toMatchObject({ response: { code: 'TOKEN_INVALID' } });
        }
        await expect(
          authService.resetPassword(withCode('123456', 'user30@example.com'), '198.51.100.1'),
        ).rejects.toMatchObject({ response: { code: 'RATE_LIMIT_EXCEEDED' } });
      });

      it('returns the same message for every failure, so responses reveal nothing about the account', async () => {
        const messages = new Set<string>();
        const capture = async (dto: { token: string; email?: string; newPassword: string }) => {
          try {
            await authService.resetPassword(dto, '203.0.113.7');
          } catch (e) {
            messages.add((e as { response: { message: string } }).response.message);
          }
        };
        mockPrisma.$queryRaw.mockRejectedValue(invalidToken());
        await capture(withCode('111111', 'unknown@example.com')); // unknown e-mail
        await capture(withCode('222222')); // wrong code
        await capture({ token: LINK, newPassword: 'NewPassword123!' }); // wrong / expired link
        counters.set('ratelimit:reset-code-failures-daily:user@example.com', 10);
        await capture(withCode('333333')); // code entry suspended
        expect(messages.size).toBe(1);
      });

      it('surfaces unexpected database errors instead of counting them as wrong codes', async () => {
        mockPrisma.$queryRaw.mockRejectedValue(new Error('connection reset'));
        await expect(authService.resetPassword(withCode(), '203.0.113.7')).rejects.toThrow(
          'connection reset',
        );
        expect(
          counters.get('ratelimit:reset-code-failures-daily:user@example.com'),
        ).toBeUndefined();
      });
    });
  });

  describe('changePassword (K13)', () => {
    it('invalidates every other session and issues fresh tokens for this device at the new version', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'u-1',
        email: 'user@example.com',
        name: 'U',
        passwordHash: 'old-hash',
        isPlatformSuperAdmin: false,
        isPlatformOwner: false,
      });
      mockPassword.verify.mockResolvedValue(true);
      mockPassword.hash.mockResolvedValue('$argon2id$new-hash');
      mockPrisma.$queryRaw.mockResolvedValue([{ version: 6 }]);

      const result = await authService.changePassword(
        'u-1',
        { currentPassword: 'Old-Password-1!', newPassword: 'New-Password-2!' },
        '203.0.113.7',
        'agent',
      );

      // change_own_password runs with this user as the transaction's actor and receives only the new hash.
      const actorCall = mockPrisma.$executeRaw.mock.calls.find((c: unknown[]) =>
        sqlText(c).includes("set_config('app.actor_user_id'"),
      );
      expect(actorCall?.[1]).toBe('u-1');
      const changeCall = mockPrisma.$queryRaw.mock.calls.find((c: unknown[]) =>
        sqlText(c).includes('public.change_own_password'),
      );
      expect(changeCall?.slice(1)).toEqual(['$argon2id$new-hash']);
      const call = mockToken.generateTokens.mock.calls[0] as unknown[];
      expect(call[0]).toBe('u-1');
      expect(call[8]).toBe(6); // the new session version
      expect(call[9]).toBeDefined(); // issued inside the same transaction
      expect(result.rawTokens.accessToken).toBe('mock.access.token');
    });

    it('changes nothing when the current password is wrong', async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u-1', passwordHash: 'old-hash' });
      mockPassword.verify.mockResolvedValue(false);
      await expect(
        authService.changePassword('u-1', {
          currentPassword: 'Wrong-Password-1!',
          newPassword: 'New-Password-2!',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(
        mockPrisma.$queryRaw.mock.calls.some((c: unknown[]) =>
          sqlText(c).includes('public.change_own_password'),
        ),
      ).toBe(false);
      expect(mockToken.generateTokens).not.toHaveBeenCalled();
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
    it('generates new verification token for unverified user and dispatches email without debugToken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-resend',
        name: 'Unverified User',
        email: 'unverified@example.com',
        isEmailVerified: false,
      });

      const result = await authService.resendVerificationEmail('unverified@example.com');
      expect((result as any).debugToken).toBeUndefined();
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
      // The response carries a generic message only: no token or code is ever returned.
      expect(result).toEqual({ message: expect.any(String) });
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
