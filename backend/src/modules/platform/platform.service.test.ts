import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlatformService } from './platform.service';
import { PlatformMetricsService } from './platform-metrics.service';
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
  user: {
    count: MockFn;
    findMany: MockFn;
    findUnique: MockFn;
    findUniqueOrThrow: MockFn;
    update: MockFn;
    create: MockFn;
  };
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
  auditLog: { findMany: MockFn; create: MockFn; count: MockFn };
  academyApplication: { findUnique: MockFn; findUniqueOrThrow: MockFn; update: MockFn };
  $queryRaw: MockFn;
  $executeRaw: MockFn;
}

/** SQL text of a tagged-template raw-query mock call. */
const sqlText = (call: unknown[] | undefined): string => ((call?.[0] ?? []) as string[]).join('?');

describe('PlatformService', () => {
  let service: PlatformService;
  let mockTx: MockPlatformTx;
  let mockPrisma: { withPlatformAdminTransaction: MockFn; $executeRaw: MockFn };
  let mockAudit: { logEvent: MockFn; recordEvent: MockFn };
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
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
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
        count: vi.fn().mockResolvedValue(0),
      },
      academyApplication: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };

    mockPrisma = {
      withPlatformAdminTransaction: vi.fn(async (_opts, fn) => fn(mockTx)),
      $executeRaw: vi.fn().mockResolvedValue(1),
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue(undefined),
      recordEvent: vi.fn().mockResolvedValue('00000000-0000-4000-8000-000000000999'),
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
      new PlatformMetricsService(
        mockPrisma as unknown as PrismaService,
        mockHealth as unknown as HealthService,
      ),
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
    it('ends the sessions through platform_revoke_user_sessions and logs the forced logout', async () => {
      mockTx.user.findUnique.mockResolvedValue({ id: targetUserId, email: 'user@example.com' });
      mockTx.$queryRaw.mockResolvedValue([{ count: 3 }]);

      const res = await service.revokeUserSessions(actorUserId, targetUserId);

      expect(res).toEqual({ success: true, revokedCount: 3 });
      // K13b ordering (version bump, then revocation) and the platform rules live in the database function (S6):
      // the service never writes users.session_version or refresh tokens itself.
      expect(sqlText(mockTx.$queryRaw.mock.calls[0])).toContain(
        'public.platform_revoke_user_sessions',
      );
      expect(mockTx.$queryRaw.mock.calls[0]?.slice(1)).toEqual([targetUserId]);
      expect(mockTx.user.update).not.toHaveBeenCalled();
      expect(mockTx.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PLATFORM_USER_FORCE_LOGOUT', resourceId: targetUserId }),
      );
    });

    it('maps the database owner rule to 403', async () => {
      mockTx.user.findUnique.mockResolvedValue({ id: targetUserId, email: 'u@example.com' });
      mockTx.$queryRaw.mockRejectedValue(
        new Error('Raw query failed. Message: `ERROR: PLATFORM_OWNER_REQUIRED`'),
      );
      await expect(service.revokeUserSessions(actorUserId, targetUserId)).rejects.toThrow(
        'Only a Platform Owner can perform this action',
      );
    });
  });

  describe('updateUserSecurityPolicy', () => {
    const updatedUser = {
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
    };

    it('suspends and forces a reset through platform_update_user_security', async () => {
      mockTx.user.findUnique.mockResolvedValue({ id: targetUserId });
      mockTx.$queryRaw.mockResolvedValue([
        { must_reset_password: true, is_suspended: true, session_version: 1 },
      ]);
      mockTx.user.findUniqueOrThrow.mockResolvedValue(updatedUser);

      const res = await service.updateUserSecurityPolicy(actorUserId, targetUserId, {
        mustResetPassword: true,
        isSuspended: true,
        reason: 'Suspicious credential activity',
      });

      expect(res.mustResetPassword).toBe(true);
      expect(res.isSuspended).toBe(true);
      expect(sqlText(mockTx.$queryRaw.mock.calls[0])).toContain(
        'public.platform_update_user_security',
      );
      expect(mockTx.$queryRaw.mock.calls[0]?.slice(1)).toEqual([
        targetUserId,
        true,
        true,
        'Suspicious credential activity',
      ]);
      expect(mockTx.user.update).not.toHaveBeenCalled();
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLATFORM_USER_SECURITY_POLICY_UPDATE',
          resourceType: 'User',
        }),
      );
    });

    it('passes NULL for the fields that are not being changed', async () => {
      mockTx.user.findUnique.mockResolvedValue({ id: targetUserId });
      mockTx.$queryRaw.mockResolvedValue([{}]);
      mockTx.user.findUniqueOrThrow.mockResolvedValue({ ...updatedUser, isSuspended: false });
      await service.updateUserSecurityPolicy(actorUserId, targetUserId, {
        mustResetPassword: true,
      });
      expect(mockTx.$queryRaw.mock.calls[0]?.slice(1)).toEqual([targetUserId, true, null, null]);
    });
  });

  describe('requestSupportAccess', () => {
    it('grants time-limited support session and records the audited grant', async () => {
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
      // Written through append_audit_log (recordEvent throws if it cannot be written); no direct insert.
      expect(mockAudit.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: academyId,
          actorUserId,
          action: 'PLATFORM_SUPPORT_SESSION_STARTED',
          resourceType: 'Tenant',
        }),
      );
      expect(mockTx.auditLog.create).not.toHaveBeenCalled();
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
    it('creates a new platform co-owner through platform_create_user and dispatches the activation email', async () => {
      mockTx.user.findUnique
        .mockResolvedValueOnce({ id: actorUserId, isPlatformOwner: true }) // actor check
        .mockResolvedValueOnce(null); // existing user check
      mockTx.$queryRaw.mockResolvedValue([{ id: 'new-owner-id' }]);
      mockTx.user.findUniqueOrThrow.mockResolvedValue({
        id: 'new-owner-id',
        email: 'coowner@platform.sa',
        name: 'Co Owner',
      });

      const res = await service.invitePlatformSuperAdmin(actorUserId, {
        email: 'coowner@platform.sa',
        name: 'Co Owner',
        role: 'PLATFORM_CO_OWNER',
      });

      expect(res.success).toBe(true);
      expect(res.userId).toBe('new-owner-id');
      expect(sqlText(mockTx.$queryRaw.mock.calls[0])).toContain('public.platform_create_user');
      // e-mail, name, co-owner flag (the function always sets must_reset_password and the super-admin flag).
      expect(mockTx.$queryRaw.mock.calls[0]?.slice(1)).toEqual([
        'coowner@platform.sa',
        'Co Owner',
        true,
      ]);
      expect(mockTx.user.create).not.toHaveBeenCalled();
      expect(mockEmail.sendPlatformAdminInvite).toHaveBeenCalled();
    });

    it('promotes an existing user through platform_set_user_platform_role, keeping an owner an owner', async () => {
      mockTx.user.findUnique
        .mockResolvedValueOnce({ id: actorUserId, isPlatformOwner: true })
        .mockResolvedValueOnce({ id: targetUserId, isPlatformOwner: true });
      mockTx.$queryRaw.mockResolvedValue([{}]);
      mockTx.user.findUniqueOrThrow.mockResolvedValue({
        id: targetUserId,
        email: 'o@platform.sa',
        name: 'O',
      });

      await service.invitePlatformSuperAdmin(actorUserId, {
        email: 'o@platform.sa',
        name: 'O',
        role: 'SUPER_ADMIN',
      });

      expect(sqlText(mockTx.$queryRaw.mock.calls[0])).toContain(
        'public.platform_set_user_platform_role',
      );
      expect(mockTx.$queryRaw.mock.calls[0]?.slice(1)).toEqual([targetUserId, 'PLATFORM_OWNER']);
      expect(mockTx.user.update).not.toHaveBeenCalled();
    });
  });

  describe('reviewAcademyApplication', () => {
    const applicationId = '00000000-0000-4000-8000-0000000000aa';
    const application = (status: string) => ({
      id: applicationId,
      status,
      applicantUserId: targetUserId,
      academyName: 'Stars',
      academySlug: 'stars',
      provisionedTenantId: null,
      applicant: { name: 'A' },
    });

    it('refuses to approve a REJECTED application (decision B7)', async () => {
      mockTx.academyApplication.findUnique.mockResolvedValue(application('REJECTED'));
      await expect(
        service.reviewAcademyApplication(actorUserId, applicationId, {
          status: 'APPROVED',
        } as never),
      ).rejects.toThrow('A rejected application cannot be approved');
      expect(mockTx.$queryRaw).not.toHaveBeenCalled();
    });

    it('provisions through platform_approve_academy_application', async () => {
      mockTx.academyApplication.findUnique.mockResolvedValue(application('PENDING_REVIEW'));
      mockTx.$queryRaw.mockResolvedValue([{ id: academyId }]);
      mockTx.academyApplication.findUniqueOrThrow.mockResolvedValue({
        ...application('APPROVED'),
        provisionedTenantId: academyId,
        sport: 'FOOTBALL',
        city: null,
        contactEmail: 'a@example.com',
        contactPhone: null,
        notes: null,
        reviewNotes: null,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.reviewAcademyApplication(actorUserId, applicationId, {
        status: 'APPROVED',
        initialPlanCode: 'PRO',
      } as never);

      expect(res.status).toBe('APPROVED');
      expect(sqlText(mockTx.$queryRaw.mock.calls[0])).toContain(
        'public.platform_approve_academy_application',
      );
      expect(mockTx.$queryRaw.mock.calls[0]?.slice(1)).toEqual([applicationId, 'PRO', null]);
      expect(mockTx.academyApplication.update).not.toHaveBeenCalled();
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: targetUserId,
          senderUserId: actorUserId,
          tenantId: academyId,
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
      expect(metrics.tables[0]?.tableName).toBe('audit_logs');
      expect(metrics.tables[0]?.tableBytes).toBe(106496);
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
        new PlatformMetricsService(mockPrisma as any, mockHealth as any),
        mockRedisService as any,
      );

      const metrics = await customService.getStorageMetrics(actorUserId);
      expect(metrics.cacheStatus).toBe('CONNECTED');
      expect(metrics.cacheKeysCount).toBe(42);
      expect(metrics.redisAvailable).toBe(true);
    });
  });

  describe('executeStorageMaintenance (K5)', () => {
    it('purges expired tokens and retains append-only audit logs instead of aborting', async () => {
      const deleteTokens = vi.fn().mockResolvedValue({ count: 4 });
      (mockTx.refreshToken as unknown as { deleteMany: MockFn }).deleteMany = deleteTokens;
      const deleteLogs = vi.fn();
      (mockTx.auditLog as unknown as { deleteMany: MockFn }).deleteMany = deleteLogs;
      mockTx.auditLog.count.mockResolvedValue(12);

      const res = await service.executeStorageMaintenance(actorUserId, {
        purgeExpiredTokens: true,
        archiveOperationalLogsOlderThanDays: 90,
      } as never);

      expect(res).toMatchObject({ success: true, purgedTokensCount: 4, purgedLogsCount: 0 });
      expect(res.message).toContain('12 aged operational logs were retained');
      expect(deleteTokens).toHaveBeenCalled();
      expect(deleteLogs).not.toHaveBeenCalled();
    });
  });
});
