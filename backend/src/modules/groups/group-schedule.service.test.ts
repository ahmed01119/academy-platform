import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { TenantContext } from '@academy/shared';
import { GroupScheduleService } from './group-schedule.service';
import { addDays, dayOfWeek, todayInCairo } from './group-calendar';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';

type MockFn = ReturnType<typeof vi.fn>;

const GROUP = '11111111-1111-4111-8111-111111111111';
const SLOT = '22222222-2222-4222-8222-222222222222';
const admin: TenantContext = {
  tenantId: 't1',
  actorUserId: 'admin-1',
  role: 'MANAGER',
  permissions: [],
} as unknown as TenantContext;

/** The next date (from tomorrow) that falls on `weekday`. */
function next(weekday: number): string {
  let d = addDays(todayInCairo(), 1);
  while (dayOfWeek(d) !== weekday) d = addDays(d, 1);
  return d;
}

describe('GroupScheduleService', () => {
  let tx: {
    trainingGroup: { findUnique: MockFn };
    trainingSchedule: { findFirst: MockFn; findMany: MockFn; update: MockFn };
    scheduleException: {
      create: MockFn;
      findFirst: MockFn;
      findMany: MockFn;
      delete: MockFn;
      deleteMany: MockFn;
    };
    groupCoach: { findMany: MockFn };
    groupMember: { findMany: MockFn };
    $queryRaw: MockFn;
  };
  let audit: { logEvent: MockFn };
  let service: GroupScheduleService;

  beforeEach(() => {
    tx = {
      trainingGroup: {
        findUnique: vi
          .fn()
          .mockResolvedValue({
            id: GROUP,
            name: 'U12',
            branchId: 'b1',
            coaches: [{ coachUserId: 'coach-1' }],
          }),
      },
      trainingSchedule: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: SLOT, dayOfWeek: 0, startTime: '17:00', endTime: '18:30' }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      scheduleException: {
        create: vi.fn().mockResolvedValue({ id: 'ex-1' }),
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        delete: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      groupCoach: { findMany: vi.fn().mockResolvedValue([{ coachUserId: 'coach-1' }]) },
      groupMember: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { player: { userId: 'player-1' } },
            { player: { userId: 'player-2' } },
          ]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{}]),
    };
    const prisma = { withTenantTransaction: vi.fn((_o, cb) => cb(tx)) };
    audit = { logEvent: vi.fn() };
    service = new GroupScheduleService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  /** Every user id passed to the notification statements (one statement per link target). */
  const notifiedUsers = () => tx.$queryRaw.mock.calls.flatMap((c) => c[5] as string[]);

  it('cancels one occurrence and tells the coach and every player', async () => {
    const date = next(0);
    await service.createException(admin, GROUP, {
      kind: 'CANCELLED',
      scheduleId: SLOT,
      originalDate: date,
      reason: 'Rain',
    });
    expect(tx.scheduleException.create.mock.calls[0]?.[0].data).toMatchObject({
      kind: 'CANCELLED',
      scheduleId: SLOT,
      reason: 'Rain',
      createdByUserId: 'admin-1',
    });
    expect(audit.logEvent.mock.calls[0]?.[0].action).toBe('GROUP_SCHEDULE_CANCELLED');
    expect(notifiedUsers().sort()).toEqual(['coach-1', 'player-1', 'player-2']);
    expect(tx.$queryRaw.mock.calls[0]?.[2]).toBe('Training cancelled');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2); // coaches and players, not one call per person
  });

  it('refuses a date the slot does not train on, or a past date', async () => {
    await expect(
      service.createException(admin, GROUP, {
        kind: 'CANCELLED',
        scheduleId: SLOT,
        originalDate: next(3),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createException(admin, GROUP, {
        kind: 'EXTRA',
        sessionDate: addDays(todayInCairo(), -1),
        startTime: '09:00',
        endTime: '10:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.scheduleException.create).not.toHaveBeenCalled();
  });

  it('one change per occurrence', async () => {
    tx.scheduleException.create.mockRejectedValueOnce(
      Object.assign(new Error('unique'), { code: 'P2002' }),
    );
    await expect(
      service.createException(admin, GROUP, {
        kind: 'CANCELLED',
        scheduleId: SLOT,
        originalDate: next(0),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('a coach cannot read the calendar of a group they do not coach', async () => {
    const coach = { ...admin, role: 'COACH', actorUserId: 'coach-9' } as TenantContext;
    await expect(service.getCalendar(coach, GROUP, { weeks: 4 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('changing the weekly slot removes its upcoming one-off changes and tells everyone the new time', async () => {
    tx.trainingSchedule.update.mockResolvedValue({
      id: SLOT,
      dayOfWeek: 2,
      startTime: '18:00',
      endTime: '19:30',
      location: null,
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    await service.updateSchedule(admin, GROUP, SLOT, {
      dayOfWeek: 2,
      startTime: '18:00',
      endTime: '19:30',
    });
    expect(tx.scheduleException.deleteMany.mock.calls[0]?.[0].where).toMatchObject({
      scheduleId: SLOT,
    });
    const body = String(tx.$queryRaw.mock.calls[0]?.[3]);
    expect(body).toContain('Sunday 17:00-18:30');
    expect(body).toContain('Tuesday 18:00-19:30');
  });

  it('a failed notification never undoes the change', async () => {
    tx.$queryRaw.mockRejectedValue(new Error('notification refused'));
    await expect(
      service.createException(admin, GROUP, {
        kind: 'EXTRA',
        sessionDate: next(4),
        startTime: '09:00',
        endTime: '10:00',
      }),
    ).resolves.toEqual({ id: 'ex-1' });
  });
});
