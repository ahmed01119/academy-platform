import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EnrollmentsService } from './enrollments.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { TenantContext } from '@academy/shared';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  playerEnrollment: {
    findMany: MockFn;
    findUnique: MockFn;
    findFirst: MockFn;
    count: MockFn;
    create: MockFn;
    update: MockFn;
  };
  player: {
    findUnique: MockFn;
  };
  branch: {
    findUnique: MockFn;
  };
  trainingGroup: {
    findMany: MockFn;
  };
  groupMember: {
    updateMany: MockFn;
  };
  attendanceSession: {
    findMany: MockFn;
  };
  attendanceRecord: {
    deleteMany: MockFn;
  };
  withTenantTransaction: MockFn;
}

interface MockAudit {
  logEvent: MockFn;
}

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  let mockPrisma: MockPrisma;
  let mockAudit: MockAudit;

  const mockTenantContext: TenantContext = {
    tenantId: '00000000-0000-4000-8000-000000000001',
    actorUserId: '00000000-0000-4000-8000-000000000099',
    locale: 'ar',
  };

  beforeEach(() => {
    mockPrisma = {
      playerEnrollment: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
      },
      player: {
        findUnique: vi.fn(),
      },
      branch: {
        findUnique: vi.fn(),
      },
      trainingGroup: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      groupMember: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      attendanceSession: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      attendanceRecord: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      withTenantTransaction: vi.fn().mockImplementation((_opts, fn) => fn(mockPrisma)),
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    service = new EnrollmentsService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('createEnrollment', () => {
    it('creates enrollment and logs audit event', async () => {
      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        firstName: 'Tsubasa',
        lastName: 'Ozora',
        status: 'ACTIVE',
      });
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-1',
        name: 'الفرع الرئيسي',
        status: 'ACTIVE',
        capacity: 50,
      });
      mockPrisma.playerEnrollment.create.mockResolvedValue({
        id: 'enrollment-1',
        tenantId: mockTenantContext.tenantId,
        playerId: 'player-1',
        branchId: 'branch-1',
        sport: 'FOOTBALL',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01T00:00:00Z'),
        notes: null,
        branch: {
          id: 'branch-1',
          name: 'الفرع الرئيسي',
          code: 'MAIN',
        },
        player: {
          id: 'player-1',
          firstName: 'Tsubasa',
          lastName: 'Ozora',
          photoUrl: null,
        },
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });

      const res = await service.createEnrollment(mockTenantContext, {
        playerId: 'player-1',
        branchId: 'branch-1',
        sport: 'FOOTBALL',
      });

      expect(res.id).toBe('enrollment-1');
      expect(res.status).toBe('ACTIVE');
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ENROLLMENT_CREATE',
          resourceType: 'PlayerEnrollment',
          resourceId: 'enrollment-1',
        }),
        expect.anything(),
      );
    });

    it('rejects enrollment if player is inactive or suspended', async () => {
      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        status: 'SUSPENDED',
      });

      await expect(
        service.createEnrollment(mockTenantContext, {
          playerId: 'player-1',
          branchId: 'branch-1',
          sport: 'FOOTBALL',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects enrollment if player already has an active enrollment', async () => {
      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        status: 'ACTIVE',
      });
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-1',
        status: 'ACTIVE',
      });
      mockPrisma.playerEnrollment.findFirst.mockResolvedValue({
        id: 'existing-active-enrollment',
      });

      await expect(
        service.createEnrollment(mockTenantContext, {
          playerId: 'player-1',
          branchId: 'branch-1',
          sport: 'FOOTBALL',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects enrollment if branch has reached capacity', async () => {
      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        status: 'ACTIVE',
      });
      mockPrisma.playerEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-1',
        status: 'ACTIVE',
        capacity: 10,
      });
      mockPrisma.playerEnrollment.count.mockResolvedValue(10);

      await expect(
        service.createEnrollment(mockTenantContext, {
          playerId: 'player-1',
          branchId: 'branch-1',
          sport: 'FOOTBALL',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('transferBranch', () => {
    it('closes current enrollment and creates new branch enrollment preserving history', async () => {
      mockPrisma.playerEnrollment.findUnique.mockResolvedValue({
        id: 'enrollment-source-1',
        tenantId: mockTenantContext.tenantId,
        playerId: 'player-1',
        branchId: 'branch-source-1',
        sport: 'FOOTBALL',
        status: 'ACTIVE',
        notes: 'Initial enrollment',
        branch: { id: 'branch-source-1', name: 'الفرع القديم' },
        player: { firstName: 'Tsubasa', lastName: 'Ozora', status: 'ACTIVE' },
      });

      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-target-2',
        name: 'فرع المعادي',
        status: 'ACTIVE',
        capacity: 100,
      });
      mockPrisma.playerEnrollment.count.mockResolvedValue(20);

      mockPrisma.playerEnrollment.update.mockResolvedValue({});
      mockPrisma.playerEnrollment.create.mockResolvedValue({
        id: 'enrollment-new-2',
        tenantId: mockTenantContext.tenantId,
        playerId: 'player-1',
        branchId: 'branch-target-2',
        sport: 'FOOTBALL',
        status: 'ACTIVE',
        startDate: new Date('2026-11-01T00:00:00Z'),
        notes: 'نقل الفرع',
        branch: { id: 'branch-target-2', name: 'فرع المعادي', code: 'MAADI' },
        player: { id: 'player-1', firstName: 'Tsubasa', lastName: 'Ozora', photoUrl: null },
        createdAt: new Date('2026-11-01T00:00:00Z'),
        updatedAt: new Date('2026-11-01T00:00:00Z'),
      });

      const res = await service.transferBranch(mockTenantContext, 'enrollment-source-1', {
        targetBranchId: 'branch-target-2',
        effectiveDate: '2026-11-01',
        notes: 'نقل الفرع',
      });

      // Assert old enrollment was closed as COMPLETED
      expect(mockPrisma.playerEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_id: {
              tenantId: mockTenantContext.tenantId,
              id: 'enrollment-source-1',
            },
          },
          data: expect.objectContaining({
            status: 'COMPLETED',
          }),
        }),
      );

      // Assert new enrollment was created for target branch
      expect(res.branchId).toBe('branch-target-2');
      expect(res.status).toBe('ACTIVE');

      // Assert audit log was recorded
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLAYER_BRANCH_TRANSFER',
          resourceType: 'PlayerEnrollment',
          resourceId: 'enrollment-new-2',
          metadata: expect.objectContaining({
            fromBranchId: 'branch-source-1',
            toBranchId: 'branch-target-2',
          }),
        }),
        expect.anything(),
      );
    });

    it('rejects transfer if target branch is at full capacity', async () => {
      mockPrisma.playerEnrollment.findUnique.mockResolvedValue({
        id: 'enrollment-source-1',
        tenantId: mockTenantContext.tenantId,
        playerId: 'player-1',
        branchId: 'branch-source-1',
        sport: 'FOOTBALL',
        status: 'ACTIVE',
        branch: { id: 'branch-source-1', name: 'الفرع القديم' },
        player: { firstName: 'Tsubasa', lastName: 'Ozora', status: 'ACTIVE' },
      });

      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-target-2',
        name: 'فرع المعادي',
        status: 'ACTIVE',
        capacity: 15,
      });
      mockPrisma.playerEnrollment.count.mockResolvedValue(15);

      await expect(
        service.transferBranch(mockTenantContext, 'enrollment-source-1', {
          targetBranchId: 'branch-target-2',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects transfer if source enrollment is not active', async () => {
      mockPrisma.playerEnrollment.findUnique.mockResolvedValue({
        id: 'enrollment-source-1',
        status: 'COMPLETED',
        branchId: 'branch-1',
      });

      await expect(
        service.transferBranch(mockTenantContext, 'enrollment-source-1', {
          targetBranchId: 'branch-2',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects transfer if target branch is identical to source branch', async () => {
      mockPrisma.playerEnrollment.findUnique.mockResolvedValue({
        id: 'enrollment-source-1',
        status: 'ACTIVE',
        branchId: 'same-branch-id',
      });

      await expect(
        service.transferBranch(mockTenantContext, 'enrollment-source-1', {
          targetBranchId: 'same-branch-id',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deactivates active source branch group memberships and cleans up unmarked future sessions', async () => {
      mockPrisma.playerEnrollment.findUnique.mockResolvedValue({
        id: 'enrollment-source-1',
        tenantId: mockTenantContext.tenantId,
        playerId: 'player-1',
        branchId: 'branch-source-1',
        sport: 'FOOTBALL',
        status: 'ACTIVE',
        notes: 'Initial enrollment',
        branch: { id: 'branch-source-1', name: 'الفرع القديم' },
        player: { firstName: 'Tsubasa', lastName: 'Ozora', status: 'ACTIVE' },
      });

      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-target-2',
        name: 'فرع المعادي',
        status: 'ACTIVE',
        capacity: 100,
      });
      mockPrisma.playerEnrollment.count.mockResolvedValue(20);

      mockPrisma.trainingGroup.findMany.mockResolvedValue([{ id: 'group-source-1' }]);
      mockPrisma.attendanceSession.findMany.mockResolvedValue([{ id: 'session-future-1' }]);
      mockPrisma.playerEnrollment.update.mockResolvedValue({});
      mockPrisma.playerEnrollment.create.mockResolvedValue({
        id: 'enrollment-new-2',
        tenantId: mockTenantContext.tenantId,
        playerId: 'player-1',
        branchId: 'branch-target-2',
        sport: 'FOOTBALL',
        status: 'ACTIVE',
        startDate: new Date('2026-11-01T00:00:00Z'),
        notes: 'نقل الفرع',
        branch: { id: 'branch-target-2', name: 'فرع المعادي', code: 'MAADI' },
        player: { id: 'player-1', firstName: 'Tsubasa', lastName: 'Ozora', photoUrl: null },
        createdAt: new Date('2026-11-01T00:00:00Z'),
        updatedAt: new Date('2026-11-01T00:00:00Z'),
      });

      await service.transferBranch(mockTenantContext, 'enrollment-source-1', {
        targetBranchId: 'branch-target-2',
        effectiveDate: '2026-11-01',
      });

      expect(mockPrisma.groupMember.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            playerId: 'player-1',
            groupId: { in: ['group-source-1'] },
            status: 'ACTIVE',
          }),
          data: expect.objectContaining({
            status: 'INACTIVE',
          }),
        }),
      );

      expect(mockPrisma.attendanceRecord.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            playerId: 'player-1',
            sessionId: { in: ['session-future-1'] },
            status: 'UNMARKED',
          }),
        }),
      );
    });
  });
});
