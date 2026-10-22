import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ErrorCode,
  type PlatformAcademyItem,
  type PlatformAuditLogItem,
  type PlatformOverviewMetrics,
  type PlatformSecurityEvent,
  type UpdateAcademyStatusRequest,
} from '@academy/shared';

@Injectable()
export class PlatformService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /**
   * Retrieves high-level SaaS platform metrics for Super Administrators.
   */
  async getOverviewMetrics(actorUserId: string): Promise<PlatformOverviewMetrics> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const [
        totalAcademies,
        activeAcademies,
        suspendedAcademies,
        provisioningAcademies,
        totalPlayers,
        totalUsers,
        totalBranches,
        totalSessionsCompleted,
        totalCoaches,
      ] = await Promise.all([
        tx.tenant.count(),
        tx.tenant.count({ where: { status: 'ACTIVE' } }),
        tx.tenant.count({ where: { status: 'SUSPENDED' } }),
        tx.tenant.count({ where: { status: 'PROVISIONING' } }),
        tx.player.count(),
        tx.user.count(),
        tx.branch.count(),
        tx.attendanceSession.count({ where: { status: 'CLOSED' } }),
        tx.tenantMembership.count({ where: { role: 'COACH', status: 'ACTIVE' } }),
      ]);

      return {
        totalAcademies,
        activeAcademies,
        suspendedAcademies,
        provisioningAcademies,
        totalPlayers,
        totalCoaches,
        totalUsers,
        totalBranches,
        totalSessionsCompleted,
        systemHealth: 'HEALTHY',
      };
    });
  }

  /**
   * Lists all registered academies across the SaaS platform with operational metadata.
   */
  async listAcademies(
    actorUserId: string,
    query?: { status?: string; search?: string },
  ): Promise<PlatformAcademyItem[]> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const where: {
        status?: 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING';
        OR?: Array<{
          name?: { contains: string; mode: 'insensitive' };
          slug?: { contains: string; mode: 'insensitive' };
        }>;
      } = {};
      if (query?.status) {
        where.status = query.status as 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING';
      }
      if (query?.search?.trim()) {
        const s = query.search.trim();
        where.OR = [
          { name: { contains: s, mode: 'insensitive' } },
          { slug: { contains: s, mode: 'insensitive' } },
        ];
      }

      const tenants = await tx.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              branches: true,
              players: true,
              memberships: {
                where: { role: 'COACH' },
              },
            },
          },
        },
      });

      return tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status as 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING',
        currency: t.currency,
        timezone: t.timezone,
        phone: t.phone,
        email: t.email,
        branchesCount: t._count.branches,
        playersCount: t._count.players,
        coachesCount: t._count.memberships,
        createdAt: t.createdAt.toISOString(),
      }));
    });
  }

  /**
   * Updates academy status (e.g. suspend or reactivate).
   */
  async updateAcademyStatus(
    actorUserId: string,
    academyId: string,
    dto: UpdateAcademyStatusRequest,
  ): Promise<PlatformAcademyItem> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: academyId },
        include: {
          _count: {
            select: {
              branches: true,
              players: true,
              memberships: { where: { role: 'COACH' } },
            },
          },
        },
      });

      if (!tenant) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Academy not found',
        });
      }

      const updated = await tx.tenant.update({
        where: { id: academyId },
        data: { status: dto.status },
      });

      await this.auditService.logEvent({
        tenantId: academyId,
        actorUserId,
        action: 'PLATFORM_ACADEMY_STATUS_UPDATE',
        resourceType: 'Tenant',
        resourceId: academyId,
        metadata: {
          previousStatus: tenant.status,
          newStatus: dto.status,
          reason: dto.reason,
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        status: updated.status as 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING',
        currency: updated.currency,
        timezone: updated.timezone,
        phone: updated.phone,
        email: updated.email,
        branchesCount: tenant._count.branches,
        playersCount: tenant._count.players,
        coachesCount: tenant._count.memberships,
        createdAt: updated.createdAt.toISOString(),
      };
    });
  }

  /**
   * Retrieves cross-tenant audit trail for platform compliance.
   */
  async listAuditLogs(
    actorUserId: string,
    query?: { limit?: number; offset?: number },
  ): Promise<PlatformAuditLogItem[]> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const take = Math.min(query?.limit ?? 50, 100);
      const skip = query?.offset ?? 0;

      const logs = await tx.auditLog.findMany({
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { name: true } },
        },
      });

      const actorUserIds = Array.from(
        new Set(logs.map((l) => l.actorUserId).filter((id): id is string => Boolean(id))),
      );
      const users = await tx.user.findMany({
        where: { id: { in: actorUserIds } },
        select: { id: true, email: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u.email]));

      return logs.map((log) => ({
        id: log.id,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        actorEmail: log.actorUserId ? userMap.get(log.actorUserId) ?? null : null,
        tenantName: log.tenant?.name ?? null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      }));
    });
  }

  /**
   * Retrieves security events and threat signals for platform monitoring.
   */
  async getSecurityEvents(actorUserId: string): Promise<PlatformSecurityEvent[]> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const logs = await tx.auditLog.findMany({
        where: {
          action: {
            in: [
              'AUTH_LOGIN_FAILURE',
              'AUTH_TOKEN_REUSED_COMPROMISE',
              'RATE_LIMIT_EXCEEDED',
              'FORBIDDEN_ATTEMPT',
            ],
          },
        },
        take: 30,
        orderBy: { createdAt: 'desc' },
      });

      const actorUserIds = Array.from(
        new Set(logs.map((l) => l.actorUserId).filter((id): id is string => Boolean(id))),
      );
      const users = await tx.user.findMany({
        where: { id: { in: actorUserIds } },
        select: { id: true, email: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u.email]));

      return logs.map((log) => {
        let type: PlatformSecurityEvent['type'] = 'FAILED_LOGIN';
        let severity: PlatformSecurityEvent['severity'] = 'LOW';
        let description = 'Security event recorded';
        const actorEmail = log.actorUserId ? userMap.get(log.actorUserId) ?? null : null;

        if (log.action === 'AUTH_LOGIN_FAILURE') {
          type = 'FAILED_LOGIN';
          severity = 'MEDIUM';
          const emailMeta = (log.metadata as Record<string, unknown>)?.email as string | undefined;
          description = `Failed login attempt for user/email: ${actorEmail || emailMeta || 'unknown'}`;
        } else if (log.action === 'AUTH_TOKEN_REUSED_COMPROMISE') {
          type = 'SUSPICIOUS_TOKEN_REUSE';
          severity = 'CRITICAL';
          description = 'Compromised refresh token reuse detected. Family revoked.';
        } else if (log.action === 'RATE_LIMIT_EXCEEDED') {
          type = 'RATE_LIMIT_TRIGGERED';
          severity = 'HIGH';
          description = 'Brute-force protection rate limit threshold triggered.';
        } else {
          type = 'PERMISSION_DENIED';
          severity = 'MEDIUM';
          description = `Unauthorized resource access attempt: ${log.resourceType}`;
        }

        return {
          id: log.id,
          type,
          severity,
          description,
          ipAddress: log.ipAddress,
          actorEmail,
          timestamp: log.createdAt.toISOString(),
        };
      });
    });
  }
}

