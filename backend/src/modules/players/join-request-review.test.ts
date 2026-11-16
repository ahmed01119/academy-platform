import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { PlayersService } from './players.service';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { TenantContext } from '@academy/shared';

/**
 * K6: approving a join request links the applicant's account to the right record.
 *  - PLAYER requester   -> players.user_id
 *  - GUARDIAN requester -> a guardian record with user_id (the child's player record has no account)
 *  - no applicant       -> nothing linked (requests made before K6)
 */
type MockFn = ReturnType<typeof vi.fn>;

const TENANT = '00000000-0000-4000-8000-000000000001';
const STAFF = '00000000-0000-4000-8000-000000000099';
const APPLICANT = '00000000-0000-4000-8000-000000000042';
const REQUEST_ID = '00000000-0000-4000-8000-0000000000aa';

const ctx: TenantContext = {
  tenantId: TENANT,
  actorUserId: STAFF,
  role: 'OWNER',
  locale: 'ar',
  permissions: [],
};

/** The transaction client models the review touches. */
interface TxMock {
  tenantSubscription: { findUnique: MockFn };
  playerRegistrationRequest: { findFirst: MockFn; update: MockFn };
  player: { findFirst: MockFn; count: MockFn; create: MockFn };
  branch: { findFirst: MockFn };
  guardian: { findFirst: MockFn; count: MockFn; create: MockFn };
  playerEnrollment: { findFirst: MockFn; create: MockFn };
  tenant: { findUnique: MockFn };
  $executeRaw: MockFn;
}

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    tenantId: TENANT,
    applicantUserId: APPLICANT,
    requesterType: 'PLAYER',
    playerName: 'Youssef Sharif',
    contactEmail: 'applicant@example.test',
    contactPhone: '+201000000000',
    dateOfBirth: null,
    guardianName: null,
    status: 'PENDING_REVIEW',
    reviewNotes: null,
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Arguments of the link_join_request_account call, if any (tagged-template $executeRaw). */
const linkCall = (tx: { $executeRaw: MockFn }) => {
  const call = tx.$executeRaw.mock.calls.find((c) =>
    ((c[0] ?? []) as string[]).join('?').includes('link_join_request_account'),
  );
  return call ? call.slice(1) : null;
};

describe('PlayersService.reviewPlayerJoinRequest (K6 account linking)', () => {
  let tx: TxMock;
  let prisma: Record<string, MockFn>;
  let notifications: { createNotification: MockFn };
  let service: PlayersService;

  const useRequest = (request: ReturnType<typeof makeRequest>) => {
    tx.playerRegistrationRequest.findFirst.mockResolvedValue(request);
    tx.playerRegistrationRequest.update.mockResolvedValue({
      ...request,
      status: 'APPROVED',
      reviewedByUserId: STAFF,
      reviewedAt: new Date(),
    });
  };

  beforeEach(() => {
    tx = {
      tenantSubscription: { findUnique: vi.fn().mockResolvedValue(null) },
      playerRegistrationRequest: { findFirst: vi.fn(), update: vi.fn() },
      player: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'player-new' }),
      },
      branch: { findFirst: vi.fn().mockResolvedValue({ id: 'branch-1' }) },
      guardian: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'guardian-new' }),
      },
      playerEnrollment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      tenant: { findUnique: vi.fn().mockResolvedValue({ name: 'Academy' }) },
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    prisma = {
      withTenantTransaction: vi.fn().mockImplementation((_c, fn) => fn(tx)),
      withAuthLookupTransaction: vi.fn().mockImplementation((_c, fn) => fn(tx)),
    };
    notifications = { createNotification: vi.fn().mockResolvedValue({ id: 'n-1' }) };
    service = new PlayersService(
      prisma as unknown as PrismaService,
      { logEvent: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      notifications as unknown as NotificationsService,
    );
  });

  it('PLAYER request: the new player record is linked to the applicant account', async () => {
    useRequest(makeRequest());

    const result = await service.reviewPlayerJoinRequest(ctx, REQUEST_ID, { status: 'APPROVED' });

    expect(tx.player.findFirst).toHaveBeenCalledWith({
      where: { tenantId: TENANT, userId: APPLICANT },
    });
    // the runtime role cannot write players.user_id: the record is created unlinked, then linked by the definer
    expect(tx.player.create.mock.calls[0]?.[0].data).not.toHaveProperty('userId');
    expect(linkCall(tx)).toEqual([REQUEST_ID, 'player-new']);
    expect(tx.guardian.create).not.toHaveBeenCalled();
    expect(result.requesterType).toBe('PLAYER');
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: APPLICANT, href: '/player' }),
    );
  });

  it('PLAYER request: refused when the account already holds a player profile elsewhere', async () => {
    useRequest(makeRequest());
    tx.player.count.mockResolvedValue(1);

    await expect(
      service.reviewPlayerJoinRequest(ctx, REQUEST_ID, { status: 'APPROVED' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.player.create).not.toHaveBeenCalled();
  });

  it('GUARDIAN request: the child gets no account, the guardian record is linked to the applicant', async () => {
    useRequest(makeRequest({ requesterType: 'GUARDIAN', guardianName: 'Ahmed Sharif' }));

    const result = await service.reviewPlayerJoinRequest(ctx, REQUEST_ID, { status: 'APPROVED' });

    // only a child this guardian is already linked to may be reused (never a name-only match)
    expect(tx.player.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT,
        firstName: 'Youssef',
        lastName: 'Sharif',
        guardians: { some: { userId: APPLICANT } },
      },
    });
    expect(tx.player.create.mock.calls[0]?.[0].data).not.toHaveProperty('userId');
    expect(linkCall(tx)).toEqual([REQUEST_ID, 'guardian-new']);
    expect(tx.guardian.create.mock.calls[0]?.[0].data).not.toHaveProperty('userId');
    expect(tx.guardian.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        playerId: 'player-new',
        firstName: 'Ahmed',
        lastName: 'Sharif',
        isPrimary: true,
      }),
    });
    expect(result.requesterType).toBe('GUARDIAN');
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: APPLICANT, href: '/guardian' }),
    );
  });

  it('GUARDIAN request: an existing guardian link for the same child is reused, not duplicated', async () => {
    useRequest(makeRequest({ requesterType: 'GUARDIAN', guardianName: 'Ahmed Sharif' }));
    tx.player.findFirst.mockResolvedValue({ id: 'player-existing' });
    tx.guardian.findFirst.mockResolvedValue({ id: 'guardian-existing' });

    await service.reviewPlayerJoinRequest(ctx, REQUEST_ID, { status: 'APPROVED' });

    expect(tx.player.create).not.toHaveBeenCalled();
    expect(tx.guardian.create).not.toHaveBeenCalled();
    expect(linkCall(tx)).toBeNull(); // already linked
  });

  it('maps a refused link (account already has a profile) to 409', async () => {
    useRequest(makeRequest());
    tx.$executeRaw.mockRejectedValue(new Error('ERROR: PLAYER_PROFILE_EXISTS'));

    await expect(
      service.reviewPlayerJoinRequest(ctx, REQUEST_ID, { status: 'APPROVED' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('request without an applicant (before K6): nothing is linked', async () => {
    useRequest(makeRequest({ applicantUserId: null, guardianName: 'Ahmed Sharif' }));

    await service.reviewPlayerJoinRequest(ctx, REQUEST_ID, { status: 'APPROVED' });

    expect(tx.player.create.mock.calls[0]?.[0].data).not.toHaveProperty('userId');
    expect(tx.guardian.create.mock.calls[0]?.[0].data.userId).toBeUndefined();
    expect(linkCall(tx)).toBeNull();
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('K9: never merges into an existing player of the same name (a different child)', async () => {
    useRequest(makeRequest({ applicantUserId: null }));
    tx.player.findFirst.mockResolvedValue({ id: 'same-name-other-child' });

    await service.reviewPlayerJoinRequest(ctx, REQUEST_ID, { status: 'APPROVED' });

    expect(tx.player.findFirst).not.toHaveBeenCalled();
    expect(tx.player.create).toHaveBeenCalledTimes(1);
  });

  it('notification failure after the commit does not fail the review', async () => {
    useRequest(makeRequest());
    notifications.createNotification.mockRejectedValue(
      new Error('NOTIFICATION_RECIPIENT_NOT_IN_TENANT'),
    );

    await expect(
      service.reviewPlayerJoinRequest(ctx, REQUEST_ID, { status: 'APPROVED' }),
    ).resolves.toMatchObject({ id: REQUEST_ID });
  });
});
