import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '@academy/shared';
import { PlayersService } from './players.service';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { NotificationsService } from '../notifications/notifications.service';

/**
 * F22 — national ID must not leave the server (response or search) without
 *       `players.sensitive.read`.
 * F21 — the initial enrollment uses the requested start date (default: today).
 */
type MockFn = ReturnType<typeof vi.fn>;

const TENANT = '00000000-0000-4000-8000-000000000001';
const ACTOR = '00000000-0000-4000-8000-000000000099';
const NATIONAL_ID = '29901011234567';

const restricted: TenantContext = {
  tenantId: TENANT,
  actorUserId: ACTOR,
  locale: 'ar',
  role: 'RECEPTIONIST',
  permissions: [],
};
const accountant: TenantContext = { ...restricted, role: 'ACCOUNTANT' };
const privileged: TenantContext = { ...restricted, role: 'MANAGER' };

const listedPlayer = {
  id: 'player-1',
  tenantId: TENANT,
  firstName: 'Tsubasa',
  lastName: 'Ozora',
  gender: 'MALE',
  dateOfBirth: new Date('2014-05-10T00:00:00Z'),
  nationalId: NATIONAL_ID,
  photoUrl: null,
  emergencyContactName: 'Contact',
  emergencyContactPhone: '+201000000000',
  medicalNotes: 'Asthma',
  status: 'ACTIVE',
  guardians: [],
  enrollments: [],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('PlayersService — F21/F22', () => {
  let service: PlayersService;
  let prisma: Record<string, Record<string, MockFn> | MockFn>;
  let player: Record<string, MockFn>;
  let enrollment: Record<string, MockFn>;

  beforeEach(() => {
    player = {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn(),
      create: vi.fn().mockResolvedValue({ ...listedPlayer }),
    };
    enrollment = {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(async ({ data }: { data: { startDate: Date } }) => ({
        id: 'enrollment-1',
        branchId: 'branch-1',
        sport: 'FOOTBALL',
        status: 'ACTIVE',
        startDate: data.startDate,
        notes: null,
        createdAt: new Date(),
        branch: { id: 'branch-1', name: 'Main', code: 'MAIN' },
      })),
    };
    prisma = {
      player,
      playerEnrollment: enrollment,
      guardian: {
        create: vi.fn().mockResolvedValue({
          id: 'guardian-1',
          firstName: 'Natsuko',
          lastName: 'Ozora',
          relationship: 'MOTHER',
          phone: '+201000000001',
          email: null,
          isPrimary: true,
        }),
      },
      branch: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'branch-1',
          name: 'Main',
          code: 'MAIN',
          status: 'ACTIVE',
          capacity: 100,
        }),
      },
    };
    prisma.withTenantTransaction = vi.fn().mockImplementation((_opts, fn) => fn(prisma));

    service = new PlayersService(
      prisma as unknown as PrismaService,
      { logEvent: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      { createNotification: vi.fn() } as unknown as NotificationsService,
    );
  });

  // ─── F22: list response ─────────────────────────────────────────────────────
  it.each([
    ['RECEPTIONIST', restricted],
    ['ACCOUNTANT', accountant],
  ])('list: %s never receives the national ID', async (_role, ctx) => {
    player.count.mockResolvedValue(1);
    player.findMany.mockResolvedValue([listedPlayer]);
    const res = await service.listPlayers(ctx, { page: 1, limit: 10 });
    expect(res.items[0]?.nationalId).toBeNull();
    expect(JSON.stringify(res)).not.toContain(NATIONAL_ID);
  });

  it('list: MANAGER (players.sensitive.read) still receives the national ID', async () => {
    player.count.mockResolvedValue(1);
    player.findMany.mockResolvedValue([listedPlayer]);
    const res = await service.listPlayers(privileged, { page: 1, limit: 10 });
    expect(res.items[0]?.nationalId).toBe(NATIONAL_ID);
  });

  // ─── F22: search oracle ─────────────────────────────────────────────────────
  it('list search: restricted roles cannot match on national ID (count + findMany)', async () => {
    player.count.mockResolvedValue(0);
    player.findMany.mockResolvedValue([]);
    await service.listPlayers(restricted, { search: '2990101', page: 1, limit: 10 });
    const findWhere = JSON.stringify(player.findMany.mock.calls[0]?.[0]?.where);
    const countWhere = JSON.stringify(player.count.mock.calls[0]?.[0]?.where);
    expect(findWhere).not.toContain('nationalId');
    expect(countWhere).not.toContain('nationalId');
    expect(findWhere).toContain('firstName'); // other keys still searched
  });

  it('list search: privileged roles keep national ID as a search key', async () => {
    player.count.mockResolvedValue(0);
    player.findMany.mockResolvedValue([]);
    await service.listPlayers(privileged, { search: '2990101', page: 1, limit: 10 });
    expect(JSON.stringify(player.findMany.mock.calls[0]?.[0]?.where)).toContain('nationalId');
  });

  // ─── F22: create response ───────────────────────────────────────────────────
  const dto = (extra: Record<string, unknown> = {}) => ({
    firstName: 'Tsubasa',
    lastName: 'Ozora',
    gender: 'MALE' as const,
    dateOfBirth: '2014-05-10',
    nationalId: NATIONAL_ID,
    emergencyContactName: 'Natsuko Ozora',
    emergencyContactPhone: '+201000000001',
    primaryGuardian: {
      firstName: 'Natsuko',
      lastName: 'Ozora',
      relationship: 'MOTHER' as const,
      phone: '+201000000001',
      isPrimary: true,
    },
    initialBranchId: 'branch-1',
    sport: 'FOOTBALL' as const,
    ...extra,
  });

  it('create: a RECEPTIONIST can still record the national ID, but it is not echoed back', async () => {
    const res = await service.createPlayer(restricted, dto());
    expect(player.create.mock.calls[0]?.[0]?.data?.nationalId).toBe(NATIONAL_ID); // stored
    expect(res.nationalId).toBeNull(); // not returned
    expect(res.medicalNotes).toBeNull();
    expect(JSON.stringify(res)).not.toContain(NATIONAL_ID);
  });

  it('create: privileged roles get the stored national ID back', async () => {
    const res = await service.createPlayer(privileged, dto());
    expect(res.nationalId).toBe(NATIONAL_ID);
  });

  // ─── F21: initial enrollment start date ─────────────────────────────────────
  it('create: stores the requested initial enrollment start date', async () => {
    await service.createPlayer(privileged, dto({ initialEnrollmentStartDate: '2026-09-01' }));
    const startDate = enrollment.create.mock.calls[0]?.[0]?.data?.startDate as Date;
    expect(startDate.toISOString().slice(0, 10)).toBe('2026-09-01');
  });

  it('create: defaults to today when no start date is sent (previous behaviour)', async () => {
    const before = Date.now();
    await service.createPlayer(privileged, dto());
    const startDate = enrollment.create.mock.calls[0]?.[0]?.data?.startDate as Date;
    expect(startDate.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(startDate.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
