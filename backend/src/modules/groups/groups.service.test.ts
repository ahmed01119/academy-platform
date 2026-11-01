import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GroupsService } from './groups.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { TenantContext } from '@academy/shared';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  withTenantTransaction: MockFn;
  branch: {
    findUnique: MockFn;
  };
  trainingGroup: {
    create: MockFn;
    findUnique: MockFn;
    findMany: MockFn;
    update: MockFn;
    count: MockFn;
  };
  groupCoach: {
    create: MockFn;
    findUnique: MockFn;
    delete: MockFn;
  };
  groupMember: {
    create: MockFn;
    findUnique: MockFn;
    update: MockFn;
    count: MockFn;
  };
  trainingSchedule: {
    create: MockFn;
    findUnique: MockFn;
    delete: MockFn;
  };
  tenantMembership: {
    findUnique: MockFn;
  };
  player: {
    findUnique: MockFn;
  };
}

describe('GroupsService', () => {
  let service: GroupsService;
  let mockPrisma: MockPrisma;
  let mockAudit: { logEvent: MockFn };

  const mockTenantContext: TenantContext = {
    tenantId: '00000000-0000-4000-8000-000000000001',
    branchId: '00000000-0000-4000-8000-000000000011',
    actorUserId: '00000000-0000-4000-8000-000000000099',
    locale: 'ar',
  };

  beforeEach(() => {
    mockPrisma = {
      withTenantTransaction: vi.fn(async (_opts, fn) => fn(mockPrisma)),
      branch: {
        findUnique: vi.fn(),
      },
      trainingGroup: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      groupCoach: {
        create: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      groupMember: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      trainingSchedule: {
        create: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      tenantMembership: {
        findUnique: vi.fn(),
      },
      player: {
        findUnique: vi.fn(),
      },
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    service = new GroupsService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('createGroup', () => {
    it('creates training group atomically inside tenant transaction and logs audit event', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: mockTenantContext.branchId,
        status: 'ACTIVE',
      });
      mockPrisma.trainingGroup.create.mockResolvedValue({
        id: 'group-1',
        tenantId: mockTenantContext.tenantId,
        branchId: mockTenantContext.branchId,
        sport: 'FOOTBALL',
        name: 'فريق البراعم تحت 12',
        description: 'تدريب أساسيات كرة القدم',
        ageCategory: 'U-12',
        capacity: 25,
        status: 'ACTIVE',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        branch: { id: mockTenantContext.branchId, name: 'الفرع الرئيسي', code: 'MAIN' },
      });

      const res = await service.createGroup(mockTenantContext, {
        branchId: mockTenantContext.branchId!,
        sport: 'FOOTBALL',
        name: 'فريق البراعم تحت 12',
        description: 'تدريب أساسيات كرة القدم',
        ageCategory: 'U-12',
        capacity: 25,
      });

      expect(res.id).toBe('group-1');
      expect(res.name).toBe('فريق البراعم تحت 12');
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GROUP_CREATE',
          resourceType: 'TrainingGroup',
          resourceId: 'group-1',
        }),
        expect.anything(),
      );
    });

    it('rejects group creation in another branch if actor is branch-scoped', async () => {
      await expect(
        service.createGroup(mockTenantContext, {
          branchId: '00000000-0000-4000-8000-000000000099', // Other branch
          sport: 'FOOTBALL',
          name: 'فريق',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assignPlayer', () => {
    it('assigns player if active and enrolled in the branch', async () => {
      mockPrisma.trainingGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        tenantId: mockTenantContext.tenantId,
        branchId: mockTenantContext.branchId,
        capacity: 20,
        status: 'ACTIVE',
      });
      mockPrisma.groupMember.count.mockResolvedValue(5);
      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        firstName: 'Tsubasa',
        lastName: 'Ozora',
        status: 'ACTIVE',
        enrollments: [{ branchId: mockTenantContext.branchId, status: 'ACTIVE' }],
      });
      mockPrisma.groupMember.findUnique.mockResolvedValue(null);
      mockPrisma.groupMember.create.mockResolvedValue({
        id: 'gm-1',
        groupId: 'group-1',
        playerId: 'player-1',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        player: {
          firstName: 'Tsubasa',
          lastName: 'Ozora',
          gender: 'MALE',
          dateOfBirth: new Date('2014-05-10'),
          photoUrl: null,
        },
        createdAt: new Date('2026-01-01'),
      });

      const res = await service.assignPlayer(mockTenantContext, 'group-1', {
        playerId: 'player-1',
      });

      expect(res.playerId).toBe('player-1');
      expect(res.status).toBe('ACTIVE');
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GROUP_PLAYER_ASSIGN',
        }),
        expect.anything(),
      );
    });

    it('rejects assignment if group capacity is reached', async () => {
      mockPrisma.trainingGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        branchId: mockTenantContext.branchId,
        capacity: 10,
        status: 'ACTIVE',
      });
      mockPrisma.groupMember.count.mockResolvedValue(10);

      await expect(
        service.assignPlayer(mockTenantContext, 'group-1', { playerId: 'player-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects assignment if player is not enrolled in the same branch', async () => {
      mockPrisma.trainingGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        branchId: mockTenantContext.branchId,
        capacity: 20,
        status: 'ACTIVE',
      });
      mockPrisma.groupMember.count.mockResolvedValue(5);
      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        status: 'ACTIVE',
        enrollments: [], // Not enrolled in this branch
      });

      await expect(
        service.assignPlayer(mockTenantContext, 'group-1', { playerId: 'player-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('assignCoach', () => {
    it('assigns coach to group and logs audit event', async () => {
      mockPrisma.trainingGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        branchId: mockTenantContext.branchId,
      });
      mockPrisma.tenantMembership.findUnique.mockResolvedValue({
        userId: 'coach-1',
        status: 'ACTIVE',
        branchId: mockTenantContext.branchId,
        user: { id: 'coach-1', name: 'الكابتن ماجد', email: 'coach@example.com', phone: null },
      });
      mockPrisma.groupCoach.findUnique.mockResolvedValue(null);
      mockPrisma.groupCoach.create.mockResolvedValue({
        id: 'gc-1',
        groupId: 'group-1',
        coachUserId: 'coach-1',
        isHeadCoach: true,
        coachUser: { id: 'coach-1', name: 'الكابتن ماجد', email: 'coach@example.com', phone: null },
        createdAt: new Date('2026-01-01'),
      });

      const res = await service.assignCoach(mockTenantContext, 'group-1', {
        coachUserId: 'coach-1',
        isHeadCoach: true,
      });

      expect(res.coachUserId).toBe('coach-1');
      expect(res.isHeadCoach).toBe(true);
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GROUP_COACH_ASSIGN',
        }),
        expect.anything(),
      );
    });
  });

  describe('createSchedule', () => {
    it('creates weekly schedule for group', async () => {
      mockPrisma.trainingGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        branchId: mockTenantContext.branchId,
      });
      mockPrisma.trainingSchedule.create.mockResolvedValue({
        id: 'sched-1',
        dayOfWeek: 1, // Monday
        startTime: '16:00',
        endTime: '17:30',
        location: 'الملعب الرئيسي',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-01'),
      });

      const res = await service.createSchedule(mockTenantContext, 'group-1', {
        dayOfWeek: 1,
        startTime: '16:00',
        endTime: '17:30',
        location: 'الملعب الرئيسي',
      });

      expect(res.dayOfWeek).toBe(1);
      expect(res.startTime).toBe('16:00');
    });

    it('rejects schedule if startTime >= endTime', async () => {
      await expect(
        service.createSchedule(mockTenantContext, 'group-1', {
          dayOfWeek: 1,
          startTime: '18:00',
          endTime: '17:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
