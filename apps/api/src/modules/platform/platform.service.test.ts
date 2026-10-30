import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlatformService } from './platform.service';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPlatformTx {
  tenant: {
    count: MockFn;
    findMany: MockFn;
    findUnique: MockFn;
    update: MockFn;
  };
  player: { count: MockFn };
  user: { count: MockFn; findMany: MockFn };
  branch: { count: MockFn };
  attendanceSession: { count: MockFn };
  tenantMembership: { count: MockFn };
  auditLog: { findMany: MockFn; create: MockFn };
}

describe('PlatformService', () => {
  let service: PlatformService;
  let mockTx: MockPlatformTx;
  let mockPrisma: { withPlatformAdminTransaction: MockFn };
  let mockAudit: { logEvent: MockFn };

  const actorUserId = '00000000-0000-4000-8000-000000000001';
  const academyId = '00000000-0000-4000-8000-000000000101';

  beforeEach(() => {
    mockTx = {
      tenant: {
        count: vi.fn().mockResolvedValue(5),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      player: { count: vi.fn().mockResolvedValue(120) },
      user: { count: vi.fn().mockResolvedValue(40), findMany: vi.fn().mockResolvedValue([]) },
      branch: { count: vi.fn().mockResolvedValue(8) },
      attendanceSession: { count: vi.fn().mockResolvedValue(350) },
      tenantMembership: { count: vi.fn().mockResolvedValue(15) },
      auditLog: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000999' }),
      },
    };

    mockPrisma = {
      withPlatformAdminTransaction: vi.fn(async (_opts, fn) => fn(mockTx)),
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    service = new PlatformService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('getOverviewMetrics', () => {
    it('aggregates platform-wide metrics with system health status', async () => {
      const metrics = await service.getOverviewMetrics(actorUserId);
      expect(metrics.totalAcademies).toBe(5);
      expect(metrics.totalPlayers).toBe(120);
      expect(metrics.totalBranches).toBe(8);
      expect(metrics.systemHealth).toBe('HEALTHY');
    });
  });

  describe('requestSupportAccess', () => {
    it('grants time-limited support session and creates audited event', async () => {
      mockTx.tenant.findUnique.mockResolvedValue({
        id: academyId,
        name: 'Al-Ahly Academy',
        status: 'ACTIVE',
      });

      const res = await service.requestSupportAccess(actorUserId, academyId, {
        reason: 'Investigating billing discrepancy for October invoices',
      });

      expect(res.authorized).toBe(true);
      expect(res.tenantId).toBe(academyId);
      expect(res.tenantName).toBe('Al-Ahly Academy');
      expect(res.reason).toContain('Investigating billing discrepancy');
      expect(res.auditLogId).toBe('00000000-0000-4000-8000-000000000999');

      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: academyId,
            actorUserId,
            action: 'PLATFORM_SUPPORT_SESSION_STARTED',
            resourceType: 'Tenant',
            resourceId: academyId,
            metadata: expect.objectContaining({
              scope: 'READ_ONLY_SUPPORT',
            }),
          }),
        }),
      );
    });

    it('rejects support access request if academy is not found', async () => {
      mockTx.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.requestSupportAccess(actorUserId, academyId, {
          reason: 'Valid reason exceeding ten characters',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateAcademyStatus', () => {
    it('updates tenant status and records audit event', async () => {
      mockTx.tenant.findUnique.mockResolvedValue({
        id: academyId,
        status: 'ACTIVE',
        _count: { branches: 2, players: 40, memberships: 4 },
      });
      mockTx.tenant.update.mockResolvedValue({
        id: academyId,
        name: 'Zamalek Club',
        slug: 'zamalek',
        status: 'SUSPENDED',
        currency: 'EGP',
        timezone: 'Africa/Cairo',
        phone: null,
        email: null,
        createdAt: new Date(),
      });

      const res = await service.updateAcademyStatus(actorUserId, academyId, {
        status: 'SUSPENDED',
        reason: 'Overdue SaaS subscription invoice',
      });

      expect(res.status).toBe('SUSPENDED');
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLATFORM_ACADEMY_STATUS_UPDATE',
          resourceType: 'Tenant',
          resourceId: academyId,
        }),
      );
    });
  });
});
