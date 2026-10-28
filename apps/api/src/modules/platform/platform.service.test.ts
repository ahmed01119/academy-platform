import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlatformService } from './platform.service';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { HealthService } from '../health/health.service';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPlatformTx {
  tenant: {
    count: MockFn;
    findMany: MockFn;
    findUnique: MockFn;
    update: MockFn;
  };
  player: { count: MockFn };
  user: { count: MockFn; findMany: MockFn; findUnique: MockFn; update: MockFn };
  branch: { count: MockFn };
  attendanceSession: { count: MockFn };
  tenantMembership: { count: MockFn };
  guardian: { count: MockFn };
  tenantSubscription: {
    count: MockFn;
    findMany: MockFn;
    update: MockFn;
    upsert: MockFn;
  };
  saaSInvoice: {
    aggregate: MockFn;
    count: MockFn;
  };
  refreshToken: { updateMany: MockFn };
  saaSPlan: { findMany: MockFn; findUnique: MockFn; update: MockFn };
  platformAnnouncement: { findMany: MockFn; create: MockFn };
  auditLog: { findMany: MockFn; create: MockFn };
}

describe('PlatformService', () => {
  let service: PlatformService;
  let mockTx: MockPlatformTx;
  let mockPrisma: { withPlatformAdminTransaction: MockFn };
  let mockAudit: { logEvent: MockFn };
  let mockHealth: { getPlatformHealth: MockFn };
  let mockNotifications: { createNotification: MockFn };
  let mockEmail: {
    sendPlatformAdminInvite: MockFn;
    sendAcademyApproved: MockFn;
    sendAcademyRejected: MockFn;
  };


  const actorUserId = '00000000-0000-4000-8000-000000000001';
  const academyId = '00000000-0000-4000-8000-000000000101';
  const targetUserId = '00000000-0000-4000-8000-000000000002';

  beforeEach(() => {
    mockTx = {
      tenant: {
        count: vi.fn().mockResolvedValue(5),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      player: { count: vi.fn().mockResolvedValue(120) },
      user: {
        count: vi.fn().mockResolvedValue(40),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      branch: { count: vi.fn().mockResolvedValue(8) },
      attendanceSession: { count: vi.fn().mockResolvedValue(350) },
      tenantMembership: { count: vi.fn().mockResolvedValue(15) },
      guardian: { count: vi.fn().mockResolvedValue(85) },
      tenantSubscription: {
        count: vi.fn().mockResolvedValue(5),
        findMany: vi.fn().mockResolvedValue([
          {
            negotiatedPrice: 1299,
            plan: { priceMonthly: 1299 },
          },
        ]),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      saaSInvoice: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 6495 } }),
        count: vi.fn().mockResolvedValue(2),
      },
      refreshToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
      saaSPlan: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      platformAnnouncement: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
      auditLog: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000999' }),
      },
    };

    mockPrisma = {
      withPlatformAdminTransaction: vi.fn(async (_opts, fn) => fn(mockTx)),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };
    mockHealth = {
      getPlatformHealth: vi.fn().mockResolvedValue('HEALTHY'),
    };
    mockNotifications = {
      createNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
    };
    mockEmail = {
      sendPlatformAdminInvite: vi.fn().mockResolvedValue(true),
      sendAcademyApproved: vi.fn().mockResolvedValue(true),
      sendAcademyRejected: vi.fn().mockResolvedValue(true),
    };


    service = new PlatformService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
      mockHealth as unknown as HealthService,
      mockNotifications as any,
      mockEmail as any,
    );
  });

  describe('getOverviewMetrics', () => {
    it('aggregates platform-wide metrics with MRR and real database counts', async () => {
      const metrics = await service.getOverviewMetrics(actorUserId);
      expect(metrics.totalAcademies).toBe(5);
      expect(metrics.totalPlayers).toBe(120);
      expect(metrics.totalBranches).toBe(8);
      expect(metrics.totalGuardians).toBe(85);
      expect(metrics.mrr).toBe(1299);
      expect(metrics.collectedRevenue).toBe(6495);
      expect(metrics.systemHealth).toBe('HEALTHY');
    });
  });

  describe('revokeUserSessions', () => {
    it('revokes all refresh tokens and logs forced logout event', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        id: targetUserId,
        email: 'user@example.com',
      });

      const res = await service.revokeUserSessions(actorUserId, targetUserId);
      expect(res.success).toBe(true);
      expect(res.revokedCount).toBe(3);
      expect(mockTx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: targetUserId, isRevoked: false },
        data: { isRevoked: true },
      });
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLATFORM_USER_FORCE_LOGOUT',
          resourceType: 'User',
          resourceId: targetUserId,
        }),
      );
    });
  });

  describe('updateUserSecurityPolicy', () => {
    it('forces password reset and suspends account with session termination', async () => {
      mockTx.user.findUnique.mockResolvedValue({ id: targetUserId });
      mockTx.user.update.mockResolvedValue({
        id: targetUserId,
        email: 'bad.actor@example.com',
        name: 'Bad Actor',
        phone: null,
        isPlatformSuperAdmin: false,
        mustResetPassword: true,
        isSuspended: true,
        suspendedReason: 'Suspicious credential activity',
        createdAt: new Date(),
        memberships: [],
        _count: { refreshTokens: 0 },
      });

      const res = await service.updateUserSecurityPolicy(actorUserId, targetUserId, {
        mustResetPassword: true,
        isSuspended: true,
        reason: 'Suspicious credential activity',
      });

      expect(res.mustResetPassword).toBe(true);
      expect(res.isSuspended).toBe(true);
      expect(mockTx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: targetUserId, isRevoked: false },
        data: { isRevoked: true },
      });
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLATFORM_USER_SECURITY_POLICY_UPDATE',
          resourceType: 'User',
        }),
      );
    });
  });

  describe('requestSupportAccess', () => {
    it('grants time-limited support session and creates audited event', async () => {
      mockTx.tenant.findUnique.mockResolvedValue({
        id: academyId,
        name: 'Stars Academy',
        status: 'ACTIVE',
      });

      const res = await service.requestSupportAccess(actorUserId, academyId, {
        reason: 'Investigating billing discrepancy for October invoices',
      });

      expect(res.authorized).toBe(true);
      expect(res.tenantId).toBe(academyId);
      expect(res.tenantName).toBe('Stars Academy');
      expect(res.reason).toContain('Investigating billing discrepancy');
      expect(res.auditLogId).toBe('00000000-0000-4000-8000-000000000999');

      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: academyId,
            actorUserId,
            action: 'PLATFORM_SUPPORT_SESSION_STARTED',
            resourceType: 'Tenant',
          }),
        }),
      );
    });

    it('throws NotFoundException when academy does not exist', async () => {
      mockTx.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.requestSupportAccess(actorUserId, academyId, {
          reason: 'Valid justification with at least 10 characters',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('invitePlatformSuperAdmin', () => {
    it('creates new platform co-owner and dispatches activation email', async () => {
      mockTx.user.findUnique
        .mockResolvedValueOnce({ id: actorUserId, isPlatformOwner: true }) // actor check
        .mockResolvedValueOnce(null); // existing user check

      mockTx.user.create = vi.fn().mockResolvedValue({
        id: 'new-owner-id',
        email: 'coowner@platform.sa',
        name: 'Co Owner',
        isPlatformSuperAdmin: true,
        isPlatformOwner: true,
        mustResetPassword: true,
      });

      const res = await service.invitePlatformSuperAdmin(actorUserId, {
        email: 'coowner@platform.sa',
        name: 'Co Owner',
        role: 'PLATFORM_CO_OWNER',
      });

      expect(res.success).toBe(true);
      expect(res.userId).toBe('new-owner-id');
      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isPlatformOwner: true,
            isPlatformSuperAdmin: true,
            mustResetPassword: true,
          }),
        }),
      );
    });
  });

  describe('updatePlatformAdminRole', () => {
    it('prevents removing the last active platform owner', async () => {
      mockTx.user.findUnique
        .mockResolvedValueOnce({ id: actorUserId, isPlatformOwner: true }) // actor
        .mockResolvedValueOnce({
          id: targetUserId,
          email: 'lastowner@platform.sa',
          isPlatformOwner: true,
          isPlatformSuperAdmin: true,
        }); // target

      mockTx.user.count = vi.fn().mockResolvedValue(0); // 0 remaining owners

      await expect(
        service.updatePlatformAdminRole(actorUserId, targetUserId, {
          role: 'SUPER_ADMIN',
        }),
      ).rejects.toThrow('Cannot remove the last active platform owner');
    });
  });

  describe('getStorageMetrics', () => {
    it('retrieves live database size, table count, and operational metrics', async () => {
      (mockTx as any).$queryRaw = vi
        .fn()
        .mockResolvedValueOnce([{ db_size: 13596351 }]) // db size
        .mockResolvedValueOnce([{ count: 34 }]) // total tables
        .mockResolvedValueOnce([
          {
            table_name: 'audit_logs',
            row_count: 376,
            total_bytes: 237568,
            table_bytes: 106496,
            index_bytes: 98304,
          },
          {
            table_name: 'refresh_tokens',
            row_count: 150,
            total_bytes: 188416,
            table_bytes: 57344,
            index_bytes: 98304,
          },
        ]);
      mockTx.auditLog.count = vi.fn().mockResolvedValue(376);

      const metrics = await service.getStorageMetrics(actorUserId);

      expect(metrics.databaseSizeBytes).toBe(13596351);
      expect(metrics.totalTables).toBe(34);
      expect(metrics.tables.length).toBe(2);
      expect(metrics.tables[0].tableName).toBe('audit_logs');
      expect(metrics.tables[0].tableBytes).toBe(106496);
      expect(metrics.auditLogsCount).toBe(376);
      expect(metrics.cacheStatus).toBe('IN_MEMORY');
      expect(metrics.redisAvailable).toBe(false);
    });

    it('reports connected Redis status when RedisService is provided', async () => {
      (mockTx as any).$queryRaw = vi
        .fn()
        .mockResolvedValueOnce([{ db_size: 20000000 }])
        .mockResolvedValueOnce([{ count: 34 }])
        .mockResolvedValueOnce([]);
      mockTx.auditLog.count = vi.fn().mockResolvedValue(100);

      const mockRedisService = {
        getCacheMetrics: vi.fn().mockResolvedValue({
          isAvailable: true,
          status: 'CONNECTED',
          keyCount: 42,
        }),
      };

      const customService = new PlatformService(
        mockPrisma as any,
        mockAudit as any,
        mockHealth as any,
        mockNotifications as any,
        mockEmail as any,
        mockRedisService as any,
      );

      const metrics = await customService.getStorageMetrics(actorUserId);
      expect(metrics.cacheStatus).toBe('CONNECTED');
      expect(metrics.cacheKeysCount).toBe(42);
      expect(metrics.redisAvailable).toBe(true);
    });
  });
});


