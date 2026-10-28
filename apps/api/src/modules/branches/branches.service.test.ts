import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BranchesService } from './branches.service';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { TenantContext } from '@academy/shared';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  branch: {
    findMany: MockFn;
    findUnique: MockFn;
    create: MockFn;
    update: MockFn;
  };
  tenantMembership: {
    findUnique: MockFn;
  };
  withTenantTransaction: MockFn;
}

interface MockAudit {
  logEvent: MockFn;
}

describe('BranchesService', () => {
  let service: BranchesService;
  let mockPrisma: MockPrisma;
  let mockAudit: MockAudit;

  const mockTenantContext: TenantContext = {
    tenantId: '00000000-0000-4000-8000-000000000001',
    actorUserId: '00000000-0000-4000-8000-000000000099',
    locale: 'ar',
  };

  beforeEach(() => {
    mockPrisma = {
      branch: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      tenantMembership: {
        findUnique: vi.fn(),
      },
      withTenantTransaction: vi.fn().mockImplementation((_opts, fn) => fn(mockPrisma)),
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    service = new BranchesService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('listBranches', () => {
    it('returns all branches for tenant with mapped player/staff counts', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([
        {
          id: 'branch-1',
          tenantId: mockTenantContext.tenantId,
          name: 'الفرع الرئيسي',
          code: 'MAIN',
          status: 'ACTIVE',
          city: 'القاهرة',
          country: 'EG',
          address: 'المعادي',
          phone: '+201000000000',
          capacity: 100,
          managerUserId: null,
          managerUser: null,
          _count: {
            playerEnrollments: 45,
            memberships: 5,
          },
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);

      const result = await service.listBranches(mockTenantContext);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('الفرع الرئيسي');
      expect(result[0]?.activePlayersCount).toBe(45);
      expect(result[0]?.activeStaffCount).toBe(5);
    });

    it('filters by assigned branch if actor is branch-scoped', async () => {
      const branchScopedContext: TenantContext = {
        ...mockTenantContext,
        branchId: 'branch-assigned-1',
      };

      mockPrisma.branch.findMany.mockResolvedValue([]);

      await service.listBranches(branchScopedContext);

      expect(mockPrisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'branch-assigned-1',
          }),
        }),
      );
    });
  });

  describe('createBranch', () => {
    it('creates branch and logs audit event', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue(null);
      mockPrisma.branch.create.mockResolvedValue({
        id: 'branch-new-1',
        tenantId: mockTenantContext.tenantId,
        name: 'فرع مدينة نصر',
        code: 'NASR',
        status: 'ACTIVE',
        city: 'القاهرة',
        country: 'EG',
        address: 'شارع عباس العقاد',
        phone: '+201011112222',
        capacity: 120,
        managerUserId: null,
        managerUser: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });

      const res = await service.createBranch(mockTenantContext, {
        name: 'فرع مدينة نصر',
        code: 'nasr',
        city: 'القاهرة',
        address: 'شارع عباس العقاد',
        phone: '+201011112222',
        capacity: 120,
        country: 'EG',
      });

      expect(res.code).toBe('NASR');
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BRANCH_CREATE',
          resourceType: 'Branch',
          resourceId: 'branch-new-1',
        }),
        expect.anything(),
      );
    });

    it('throws ConflictException on duplicate branch code', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createBranch(mockTenantContext, {
          name: 'Duplicate',
          code: 'MAIN',
          country: 'EG',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateBranch', () => {
    it('updates branch and logs audit event', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-1',
        tenantId: mockTenantContext.tenantId,
        code: 'MAIN',
      });

      mockPrisma.branch.update.mockResolvedValue({
        id: 'branch-1',
        tenantId: mockTenantContext.tenantId,
        name: 'الفرع الرئيسي المطور',
        code: 'MAIN',
        status: 'ACTIVE',
        city: 'القاهرة',
        country: 'EG',
        address: null,
        phone: null,
        capacity: 200,
        managerUserId: null,
        managerUser: null,
        _count: { playerEnrollments: 50, memberships: 6 },
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });

      const res = await service.updateBranch(mockTenantContext, 'branch-1', {
        name: 'الفرع الرئيسي المطور',
        capacity: 200,
      });

      expect(res.name).toBe('الفرع الرئيسي المطور');
      expect(res.capacity).toBe(200);
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BRANCH_UPDATE',
          resourceId: 'branch-1',
        }),
        expect.anything(),
      );
    });

    it('throws ForbiddenException if branch-scoped actor attempts to update another branch', async () => {
      const branchScopedContext: TenantContext = {
        ...mockTenantContext,
        branchId: 'my-branch-id',
      };

      await expect(
        service.updateBranch(branchScopedContext, 'other-branch-id', { name: 'Hack' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getBranchDeletionImpact', () => {
    it('returns impact metrics and recommends ARCHIVE when active dependencies exist', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-1',
        name: 'فرع المعادي',
        _count: {
          playerEnrollments: 30,
          trainingGroups: 3,
          attendanceSessions: 5,
          memberships: 4,
          financialTransactions: 120,
        },
      });

      const impact = await service.getBranchDeletionImpact(mockTenantContext, 'branch-1');
      expect(impact.branchName).toBe('فرع المعادي');
      expect(impact.activeEnrollmentsCount).toBe(30);
      expect(impact.hasBlockingDependencies).toBe(true);
      expect(impact.recommendation).toBe('ARCHIVE');
    });

    it('recommends SAFE_DELETE when no active dependencies exist', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-empty',
        name: 'فرع تجريبي فارغ',
        _count: {
          playerEnrollments: 0,
          trainingGroups: 0,
          attendanceSessions: 0,
          memberships: 0,
          financialTransactions: 0,
        },
      });

      const impact = await service.getBranchDeletionImpact(mockTenantContext, 'branch-empty');
      expect(impact.hasBlockingDependencies).toBe(false);
      expect(impact.recommendation).toBe('SAFE_DELETE');
    });
  });

  describe('archiveBranch', () => {
    it('soft-archives branch and audits BRANCH_ARCHIVED event', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-1',
        name: 'فرع المعادي',
        code: 'MAADI',
      });
      mockPrisma.branch.update.mockResolvedValue({
        id: 'branch-1',
        name: 'فرع المعادي',
        status: 'INACTIVE',
      });

      const result = await service.archiveBranch(mockTenantContext, 'branch-1');
      expect(result.success).toBe(true);
      expect(result.branch.status).toBe('INACTIVE');
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BRANCH_ARCHIVED',
          resourceId: 'branch-1',
        }),
        expect.anything(),
      );
    });
  });
});
