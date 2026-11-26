import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@academy/shared';
import { APPLICATION_REPLY_TTL_MS, ApplicationReplyService } from './application-reply.service';
import type { PrismaService } from '../database/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { AppConfigService } from '../../config/app-config.service';

const APP_ID = '11111111-1111-4111-8111-111111111111';
const REVIEWED_AT = new Date('2026-11-24T10:00:00.123Z');

const openRow = {
  academy_name: 'Stars Academy',
  sport: 'FOOTBALL',
  city: 'Cairo',
  contact_phone: '0100',
  review_notes: 'Please send the commercial register.',
  applicant_user_id: '22222222-2222-4222-8222-222222222222',
};

describe('ApplicationReplyService', () => {
  let prisma: { $queryRaw: ReturnType<typeof vi.fn>; user: { findMany: ReturnType<typeof vi.fn> } };
  let notifications: { createNotification: ReturnType<typeof vi.fn> };
  let service: ApplicationReplyService;

  beforeEach(() => {
    prisma = {
      $queryRaw: vi.fn(),
      user: { findMany: vi.fn().mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]) },
    };
    notifications = { createNotification: vi.fn().mockResolvedValue({ id: 'n' }) };
    service = new ApplicationReplyService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      { jwtSecret: 'unit-test-secret' } as AppConfigService,
    );
  });

  it('a link names the application and the request it was made for', () => {
    const token = service.createToken(APP_ID, REVIEWED_AT);
    expect(service.parseToken(token)).toEqual({ applicationId: APP_ID, reviewedAt: REVIEWED_AT });
  });

  it('refuses forged, altered and malformed links', () => {
    const token = service.createToken(APP_ID, REVIEWED_AT);
    const other = token.replace(APP_ID, '33333333-3333-4333-8333-333333333333');
    for (const bad of ['', 'r1.x', other, `${token}x`, token.replace('r1.', 'r2.')]) {
      expect(() => service.parseToken(bad)).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: ErrorCode.TOKEN_INVALID }),
        }),
      );
    }
  });

  it('a link expires after 14 days', () => {
    const issuedAt = Date.now();
    const token = service.createToken(APP_ID, REVIEWED_AT, issuedAt);
    expect(() => service.parseToken(token, issuedAt + APPLICATION_REPLY_TTL_MS + 1)).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: ErrorCode.TOKEN_EXPIRED }),
      }),
    );
  });

  it('shows the open request', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([openRow]);
    await expect(service.getView(service.createToken(APP_ID, REVIEWED_AT))).resolves.toEqual({
      academyName: 'Stars Academy',
      sport: 'FOOTBALL',
      city: 'Cairo',
      contactPhone: '0100',
      reviewNotes: 'Please send the commercial register.',
    });
  });

  it('an answered or replaced request is refused', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expect(service.getView(service.createToken(APP_ID, REVIEWED_AT))).rejects.toMatchObject({
      response: { code: ErrorCode.TOKEN_EXPIRED },
    });
  });

  it('stores the answer through the definer function and notifies every platform admin', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([openRow]).mockResolvedValueOnce([{ ok: true }]);
    await service.submit({
      token: service.createToken(APP_ID, REVIEWED_AT),
      reply: 'Attached.',
      city: 'Giza',
    });
    const sql = (prisma.$queryRaw.mock.calls[1]?.[0] as string[]).join('?');
    expect(sql).toContain('submit_academy_application_reply');
    expect(prisma.$queryRaw.mock.calls[1]?.slice(1)).toEqual([
      APP_ID,
      REVIEWED_AT,
      'Attached.',
      'Giza',
      null,
    ]);
    expect(notifications.createNotification).toHaveBeenCalledTimes(2);
    expect(notifications.createNotification.mock.calls[0]?.[0]).toMatchObject({
      userId: 'admin-1',
      type: 'ACADEMY_APPLICATION',
      href: '/platform?tab=applications',
    });
  });

  it('a second answer with the same link is refused', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([openRow]).mockResolvedValueOnce([{ ok: false }]);
    await expect(
      service.submit({ token: service.createToken(APP_ID, REVIEWED_AT), reply: 'Again.' }),
    ).rejects.toMatchObject({ response: { code: ErrorCode.TOKEN_EXPIRED } });
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });
});
