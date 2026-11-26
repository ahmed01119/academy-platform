import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@academy/shared';
import {
  GuardianLinkService,
  GUARDIAN_LINK_REQUESTS_PER_HOUR,
  phoneTail,
} from './guardian-link.service';
import { RedisService } from '../redis/redis.service';
import type { PrismaService } from '../database/prisma.service';
import type { EmailService } from '../email/email.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { AppConfigService } from '../../config/app-config.service';

const GUARDIAN = '11111111-1111-4111-8111-111111111111';
const REQUESTER = '22222222-2222-4222-8222-222222222222';
const config = { nodeEnv: 'test', jwtSecret: 'unit-test-secret', redisUrl: undefined };

const candidate = {
  guardian_id: GUARDIAN,
  tenant_name: 'Stars Academy',
  player_first_name: 'Omar',
  child_email: 'omar@mail.test',
};
const viewRow = {
  tenant_name: 'Stars Academy',
  player_first_name: 'Omar',
  guardian_first_name: 'Ali',
  guardian_last_name: 'Hassan',
  requester_name: 'Ali Hassan',
};

/** The SQL of the n-th raw query. */
const sqlOf = (mock: ReturnType<typeof vi.fn>, n: number) =>
  (mock.mock.calls[n]?.[0] as string[]).join('?');

describe('phoneTail', () => {
  it('compares the last 10 digits, whatever the format', () => {
    expect(phoneTail('01001234567')).toBe('1001234567');
    expect(phoneTail('+20 100 123 4567')).toBe('1001234567');
    expect(phoneTail('0020-100-123-4567')).toBe('1001234567');
    expect(phoneTail('12345')).toBeNull();
  });
});

describe('GuardianLinkService', () => {
  let prisma: {
    $queryRaw: ReturnType<typeof vi.fn>;
    user: { findUnique: ReturnType<typeof vi.fn> };
  };
  let email: { sendGuardianLinkRequest: ReturnType<typeof vi.fn> };
  let notifications: { createNotification: ReturnType<typeof vi.fn> };
  let service: GuardianLinkService;

  beforeEach(() => {
    prisma = {
      $queryRaw: vi.fn(),
      user: {
        findUnique: vi.fn().mockResolvedValue({ name: 'Ali Hassan', email: 'ali@mail.test' }),
      },
    };
    email = { sendGuardianLinkRequest: vi.fn().mockResolvedValue({ status: 'SENT' }) };
    notifications = { createNotification: vi.fn().mockResolvedValue({ id: 'n' }) };
    service = new GuardianLinkService(
      prisma as unknown as PrismaService,
      new RedisService(config as unknown as AppConfigService),
      email as unknown as EmailService,
      notifications as unknown as NotificationsService,
      config as unknown as AppConfigService,
    );
  });

  it("asks the child by e-mail when the phone matches the academy's guardian record", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([candidate]).mockResolvedValueOnce([viewRow]);
    await expect(
      service.requestLink(REQUESTER, { childEmail: 'omar@mail.test', phone: '+20 100 123 4567' }),
    ).resolves.toEqual({ success: true });
    await vi.waitFor(() => expect(email.sendGuardianLinkRequest).toHaveBeenCalledTimes(1));

    expect(sqlOf(prisma.$queryRaw, 0)).toContain('find_guardian_link_candidates');
    expect(prisma.$queryRaw.mock.calls[0]?.slice(1)).toEqual(['omar@mail.test', '1001234567']);
    const mail = email.sendGuardianLinkRequest.mock.calls[0]?.[0];
    expect(mail).toMatchObject({
      to: 'omar@mail.test',
      requesterName: 'Ali Hassan',
      guardianName: 'Ali Hassan',
    });
    const token = decodeURIComponent(String(mail.approvalUrl).split('token=')[1] ?? '');
    expect(service.parseToken(token)).toEqual({ guardianId: GUARDIAN, requesterUserId: REQUESTER });
  });

  it('answers the same when nothing matches, and sends nothing', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expect(
      service.requestLink(REQUESTER, { childEmail: 'nobody@mail.test', phone: '01001234567' }),
    ).resolves.toEqual({ success: true });
    expect(email.sendGuardianLinkRequest).not.toHaveBeenCalled();
  });

  it("never asks for one's own e-mail", async () => {
    await service.requestLink(REQUESTER, { childEmail: 'ali@mail.test', phone: '01001234567' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('limits requests per account', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    for (let i = 0; i < GUARDIAN_LINK_REQUESTS_PER_HOUR; i++) {
      await service.requestLink(REQUESTER, { childEmail: 'x@mail.test', phone: '01001234567' });
    }
    await expect(
      service.requestLink(REQUESTER, { childEmail: 'x@mail.test', phone: '01001234567' }),
    ).rejects.toMatchObject({ response: { code: ErrorCode.RATE_LIMIT_EXCEEDED } });
  });

  it('refuses forged, altered and expired links', () => {
    const token = service.createToken(GUARDIAN, REQUESTER);
    const swapped = token.replace(REQUESTER, '33333333-3333-4333-8333-333333333333');
    for (const bad of ['', 'g1.a.b.c.d', swapped, `${token}x`]) {
      expect(() => service.parseToken(bad)).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: ErrorCode.TOKEN_INVALID }),
        }),
      );
    }
    const old = service.createToken(GUARDIAN, REQUESTER, Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(() => service.parseToken(old)).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: ErrorCode.TOKEN_EXPIRED }),
      }),
    );
  });

  it('approving links the record through the definer function and tells the guardian', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([viewRow]).mockResolvedValueOnce([{ player_id: 'p1' }]);
    await expect(
      service.decide({ token: service.createToken(GUARDIAN, REQUESTER), decision: 'APPROVE' }),
    ).resolves.toEqual({ linked: true });
    expect(sqlOf(prisma.$queryRaw, 1)).toContain('approve_guardian_link');
    expect(prisma.$queryRaw.mock.calls[1]?.slice(1)).toEqual([GUARDIAN, REQUESTER]);
    expect(notifications.createNotification.mock.calls[0]?.[0]).toMatchObject({
      userId: REQUESTER,
      title: 'Guardian link approved',
    });
  });

  it('declining links nothing', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([viewRow]);
    await expect(
      service.decide({ token: service.createToken(GUARDIAN, REQUESTER), decision: 'DECLINE' }),
    ).resolves.toEqual({ linked: false });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(notifications.createNotification.mock.calls[0]?.[0]).toMatchObject({
      title: 'Guardian link declined',
    });
  });

  it('a link to a record that is already linked is refused', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expect(
      service.getRequest(service.createToken(GUARDIAN, REQUESTER)),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.TOKEN_EXPIRED },
    });
  });
});
