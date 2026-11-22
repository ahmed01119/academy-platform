import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';
import { ErrorCode } from '@academy/shared';
import { EmailCodeService, EMAIL_CODE_MAX_ATTEMPTS } from './email-code.service';
import { checkEmailDomain, type DnsResolver } from './email-domain';
import { RedisService } from '../redis/redis.service';
import type { PrismaService } from '../database/prisma.service';
import type { EmailService } from '../email/email.service';
import type { AppConfigService } from '../../config/app-config.service';

type MockFn = ReturnType<typeof vi.fn>;

const notFound = () => Object.assign(new Error('not found'), { code: 'ENOTFOUND' });
const noData = () => Object.assign(new Error('no data'), { code: 'ENODATA' });

/** A resolver where `mail.test` has MX records, `nomail.test` a null MX, and everything else does not exist. */
const resolver: DnsResolver = {
  resolveMx: async (host) => {
    if (host === 'mail.test') return [{ exchange: 'mx.mail.test', priority: 10 }];
    if (host === 'nomail.test') return [{ exchange: '', priority: 0 }];
    if (host === 'web-only.test') throw noData();
    throw notFound();
  },
  resolve4: async (host) => {
    if (host === 'web-only.test') return ['192.0.2.1'];
    throw notFound();
  },
  resolve6: async () => {
    throw notFound();
  },
};

describe('checkEmailDomain', () => {
  it('accepts domains with mail servers, or an address record (implicit MX)', async () => {
    await expect(checkEmailDomain('a@mail.test', resolver)).resolves.toBe('ok');
    await expect(checkEmailDomain('a@web-only.test', resolver)).resolves.toBe('ok');
  });

  it('refuses unknown domains, null MX and addresses without a domain', async () => {
    await expect(checkEmailDomain('a@gmial.test', resolver)).resolves.toBe('no-mail');
    await expect(checkEmailDomain('a@nomail.test', resolver)).resolves.toBe('no-mail');
    await expect(checkEmailDomain('a@localhost', resolver)).resolves.toBe('no-mail');
  });

  it('accepts the large providers without asking DNS', async () => {
    const broken: DnsResolver = {
      resolveMx: async () => {
        throw notFound();
      },
      resolve4: async () => {
        throw notFound();
      },
      resolve6: async () => {
        throw notFound();
      },
    };
    await expect(checkEmailDomain('someone@Gmail.com', broken)).resolves.toBe('ok');
  });

  it('a single wrong "not found" answer does not refuse a real domain', async () => {
    // First pass answers NXDOMAIN (resolver hiccup), the retry finds the mail servers.
    let calls = 0;
    const flaky: DnsResolver = {
      ...resolver,
      resolveMx: async (host) => {
        calls += 1;
        if (calls === 1) throw notFound();
        return resolver.resolveMx(host === 'real.test' ? 'mail.test' : host);
      },
    };
    await expect(checkEmailDomain('a@real.test', flaky)).resolves.toBe('ok');

    // DNS keeps saying "not found" but the operating system's resolver finds the domain.
    const osFinds: DnsResolver = { ...resolver, lookup: async () => ({ address: '192.0.2.1' }) };
    await expect(checkEmailDomain('a@gmial.test', osFinds)).resolves.toBe('ok');
  });

  it('lets the address through when DNS fails or is slow', async () => {
    const failing: DnsResolver = {
      ...resolver,
      resolveMx: async () => {
        throw Object.assign(new Error('timeout'), { code: 'ETIMEOUT' });
      },
    };
    await expect(checkEmailDomain('a@mail.test', failing)).resolves.toBe('unknown');
    const slow: DnsResolver = { ...resolver, resolveMx: () => new Promise(() => undefined) };
    await expect(checkEmailDomain('a@mail.test', slow, 20)).resolves.toBe('unknown');
  });
});

describe('EmailCodeService', () => {
  let prisma: { user: { findUnique: MockFn } };
  let email: { sendEmailConfirmationCode: MockFn };
  let redis: RedisService;
  let service: EmailCodeService;
  const config = { nodeEnv: 'test', jwtSecret: 'unit-test-secret', redisUrl: undefined };

  /** The code inside the last e-mail sent. */
  const lastCode = (): string => email.sendEmailConfirmationCode.mock.calls.at(-1)?.[0].code;

  beforeEach(() => {
    prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    email = {
      sendEmailConfirmationCode: vi.fn().mockResolvedValue({ status: 'SENT', delivered: true }),
    };
    redis = new RedisService(config as unknown as AppConfigService);
    service = new EmailCodeService(
      prisma as unknown as PrismaService,
      redis,
      email as unknown as EmailService,
      config as unknown as AppConfigService,
    );
    service.dnsResolver = resolver;
  });

  it('sends a 6-digit code and turns the right code into a proof for that address only', async () => {
    const sent = await service.sendCode('player@mail.test', '203.0.113.7');
    expect(sent.expiresInSeconds).toBe(600);
    expect(lastCode()).toMatch(/^\d{6}$/);

    const { proof } = await service.verifyCode('player@mail.test', lastCode());
    expect(service.isValidProof('player@mail.test', proof)).toBe(true);
    expect(service.isValidProof('PLAYER@mail.test ', proof)).toBe(true);
    expect(service.isValidProof('other@mail.test', proof)).toBe(false);
    expect(() => service.assertProof('other@mail.test', proof)).toThrow(BadRequestException);
  });

  it('a code works once', async () => {
    await service.sendCode('player@mail.test');
    const code = lastCode();
    await service.verifyCode('player@mail.test', code);
    await expect(service.verifyCode('player@mail.test', code)).rejects.toMatchObject({
      response: { code: ErrorCode.TOKEN_EXPIRED },
    });
  });

  it('a wrong code is refused, and too many wrong codes discard the code', async () => {
    await service.sendCode('player@mail.test');
    const wrong = lastCode() === '000000' ? '111111' : '000000';
    for (let i = 0; i < EMAIL_CODE_MAX_ATTEMPTS; i++) {
      await expect(service.verifyCode('player@mail.test', wrong)).rejects.toMatchObject({
        response: { code: ErrorCode.TOKEN_INVALID },
      });
    }
    await expect(service.verifyCode('player@mail.test', lastCode())).rejects.toBeInstanceOf(
      HttpException,
    );
    // The right code no longer works either: a new one must be requested.
    await expect(service.verifyCode('player@mail.test', lastCode())).rejects.toMatchObject({
      response: { code: ErrorCode.TOKEN_EXPIRED },
    });
  });

  it('a second code within a minute is refused', async () => {
    await service.sendCode('player@mail.test');
    await expect(service.sendCode('player@mail.test')).rejects.toMatchObject({
      response: { code: ErrorCode.RATE_LIMIT_EXCEEDED },
    });
    expect(email.sendEmailConfirmationCode).toHaveBeenCalledTimes(1);
  });

  it('refuses a domain that cannot receive mail, before sending anything', async () => {
    await expect(service.sendCode('player@gmial.test')).rejects.toMatchObject({
      response: { code: ErrorCode.EMAIL_DOMAIN_INVALID },
    });
    expect(email.sendEmailConfirmationCode).not.toHaveBeenCalled();
  });

  it('refuses an address that already has an account', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.sendCode('player@mail.test')).rejects.toBeInstanceOf(ConflictException);
    expect(email.sendEmailConfirmationCode).not.toHaveBeenCalled();
  });

  it('a failed send is reported and can be retried at once', async () => {
    email.sendEmailConfirmationCode.mockResolvedValueOnce({ status: 'FAILED', delivered: false });
    await expect(service.sendCode('player@mail.test')).rejects.toMatchObject({
      response: { code: ErrorCode.EMAIL_DELIVERY_FAILED },
    });
    await expect(service.sendCode('player@mail.test')).resolves.toBeDefined();
  });

  it('refuses forged, malformed and expired proofs', async () => {
    expect(service.isValidProof('player@mail.test', undefined)).toBe(false);
    expect(service.isValidProof('player@mail.test', 'v1.abc.def')).toBe(false);
    expect(service.isValidProof('player@mail.test', `v1.${Date.now() + 60_000}.forged`)).toBe(
      false,
    );

    vi.useFakeTimers();
    try {
      await service.sendCode('player@mail.test');
      const { proof } = await service.verifyCode('player@mail.test', lastCode());
      vi.advanceTimersByTime(31 * 60 * 1000);
      expect(service.isValidProof('player@mail.test', proof)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks the new account verified through the definer functions, with one token', async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{}]) };
    await service.markVerifiedInTx(tx as never, 'player@mail.test');
    const sql = tx.$queryRaw.mock.calls.map((c) => (c[0] as string[]).join('?'));
    expect(sql[0]).toContain('request_email_verification');
    expect(sql[1]).toContain('verify_user_email');
    // the same token hash is issued and redeemed
    expect(tx.$queryRaw.mock.calls[0]?.[2]).toBe(tx.$queryRaw.mock.calls[1]?.[1]);
  });
});
