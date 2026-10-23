import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ErrorCode,
  type PlatformAcademyItem,
  type PlatformAuditLogItem,
  type PlatformOverviewMetrics,
  type PlatformSecurityEvent,
  type UpdateAcademyStatusRequest,
  type RequestSupportAccessRequest,
  type SupportAccessResponse,
  type PlatformUserItem,
  type UpdateUserSecurityPolicyRequest,
  type SaaSPlanItem,
  type UpdateSaaSPlanRequest,
  type TenantSubscriptionItem,
  type UpdateTenantSubscriptionRequest,
  type PlatformAnnouncementItem,
  type CreatePlatformAnnouncementRequest,
} from '@academy/shared';

@Injectable()
export class PlatformService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /**
   * Retrieves high-level SaaS platform metrics for Super Administrators.
   * Real database aggregations across tenants, subscriptions, users, and financials.
   */
  async getOverviewMetrics(actorUserId: string): Promise<PlatformOverviewMetrics> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const now = new Date();
      const in14Days = new Date(Date.now() + 14 * 86400000);

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
        totalGuardians,
        trialAcademies,
        expiredAcademies,
        activeSubscriptions,
        upcomingRenewals,
        expiredSubscriptions,
        activeSubs,
        paidInvoicesSum,
        pendingInvoicesCount,
        overdueInvoicesCount,
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
        tx.guardian.count(),
        tx.tenantSubscription.count({ where: { status: 'TRIAL' } }),
        tx.tenantSubscription.count({ where: { status: 'EXPIRED' } }),
        tx.tenantSubscription.count({ where: { status: 'ACTIVE' } }),
        tx.tenantSubscription.count({
          where: {
            status: 'ACTIVE',
            renewalDate: { lte: in14Days, gte: now },
          },
        }),
        tx.tenantSubscription.count({ where: { status: 'EXPIRED' } }),
        tx.tenantSubscription.findMany({
          where: { status: 'ACTIVE' },
          include: { plan: true },
        }),
        tx.saaSInvoice.aggregate({
          where: { status: 'PAID' },
          _sum: { amount: true },
        }),
        tx.saaSInvoice.count({ where: { status: 'PENDING' } }),
        tx.saaSInvoice.count({ where: { status: 'OVERDUE' } }),
      ]);

      // Calculate Monthly Recurring Revenue (MRR) based on active subscription prices
      const mrr = (activeSubs as Array<{ negotiatedPrice: number | null; plan: { priceMonthly: number | null } }>).reduce((acc: number, sub) => {
        const monthly = sub.negotiatedPrice ?? sub.plan.priceMonthly ?? 0;
        return acc + monthly;
      }, 0);

      return {
        totalAcademies,
        activeAcademies,
        suspendedAcademies,
        provisioningAcademies,
        trialAcademies,
        expiredAcademies,
        totalPlayers,
        totalCoaches,
        totalUsers,
        totalBranches,
        totalGuardians,
        totalSessionsCompleted,
        activeSubscriptions,
        upcomingRenewals,
        expiredSubscriptions,
        mrr,
        collectedRevenue: paidInvoicesSum._sum.amount ?? 0,
        outstandingInvoices: pendingInvoicesCount,
        failedPayments: overdueInvoicesCount,
        systemHealth: 'HEALTHY',
      };
    });
  }

  /**
   * Lists all registered academies across the SaaS platform with operational metadata and SaaS plan info.
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
          subscription: true,
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
        planCode: t.subscription?.planCode,
        subscriptionStatus: t.subscription?.status,
        renewalDate: t.subscription?.renewalDate ? t.subscription.renewalDate.toISOString() : null,
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
          subscription: true,
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
        include: { subscription: true },
      });

      // Synchronize subscription status if tenant is suspended
      if (dto.status === 'SUSPENDED' && updated.subscription) {
        await tx.tenantSubscription.update({
          where: { tenantId: academyId },
          data: { status: 'SUSPENDED' },
        });
      } else if (dto.status === 'ACTIVE' && updated.subscription?.status === 'SUSPENDED') {
        await tx.tenantSubscription.update({
          where: { tenantId: academyId },
          data: { status: 'ACTIVE' },
        });
      }

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
        planCode: updated.subscription?.planCode,
        subscriptionStatus: updated.subscription?.status,
        renewalDate: updated.subscription?.renewalDate ? updated.subscription.renewalDate.toISOString() : null,
        createdAt: updated.createdAt.toISOString(),
      };
    });
  }

  /**
   * Lists all users across the platform with roles, academies, and active sessions count.
   */
  async listUsers(
    actorUserId: string,
    query?: { search?: string; limit?: number; offset?: number },
  ): Promise<PlatformUserItem[]> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const take = Math.min(query?.limit ?? 50, 100);
      const skip = query?.offset ?? 0;
      const now = new Date();

      const where: {
        OR?: Array<{
          name?: { contains: string; mode: 'insensitive' };
          email?: { contains: string; mode: 'insensitive' };
        }>;
      } = {};

      if (query?.search?.trim()) {
        const s = query.search.trim();
        where.OR = [
          { name: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
        ];
      }

      const users = await tx.user.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          memberships: {
            include: {
              tenant: { select: { name: true } },
            },
          },
          _count: {
            select: {
              refreshTokens: {
                where: {
                  isRevoked: false,
                  expiresAt: { gt: now },
                },
              },
            },
          },
        },
      });

      return users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        isPlatformSuperAdmin: u.isPlatformSuperAdmin,
        mustResetPassword: u.mustResetPassword,
        isSuspended: u.isSuspended,
        suspendedReason: u.suspendedReason,
        activeSessionsCount: u._count.refreshTokens,
        createdAt: u.createdAt.toISOString(),
        memberships: u.memberships.map((m) => ({
          tenantId: m.tenantId,
          tenantName: m.tenant.name,
          role: m.role,
          status: m.status,
        })),
      }));
    });
  }

  /**
   * Revokes all active refresh tokens and server-side sessions for a target user.
   */
  async revokeUserSessions(actorUserId: string, targetUserId: string): Promise<{ success: boolean; revokedCount: number }> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, email: true },
      });

      if (!targetUser) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Target user not found',
        });
      }

      const res = await tx.refreshToken.updateMany({
        where: { userId: targetUserId, isRevoked: false },
        data: { isRevoked: true },
      });

      await this.auditService.logEvent({
        actorUserId,
        action: 'PLATFORM_USER_FORCE_LOGOUT',
        resourceType: 'User',
        resourceId: targetUserId,
        metadata: {
          targetEmail: targetUser.email,
          revokedCount: res.count,
        },
      });

      return { success: true, revokedCount: res.count };
    });
  }

  /**
   * Updates user security policy (force password reset on next login, suspend/reactivate account).
   */
  async updateUserSecurityPolicy(
    actorUserId: string,
    targetUserId: string,
    dto: UpdateUserSecurityPolicyRequest,
  ): Promise<PlatformUserItem> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Target user not found',
        });
      }

      const dataToUpdate: {
        mustResetPassword?: boolean;
        isSuspended?: boolean;
        suspendedReason?: string | null;
      } = {};

      if (typeof dto.mustResetPassword === 'boolean') {
        dataToUpdate.mustResetPassword = dto.mustResetPassword;
      }
      if (typeof dto.isSuspended === 'boolean') {
        dataToUpdate.isSuspended = dto.isSuspended;
        dataToUpdate.suspendedReason = dto.isSuspended ? (dto.reason ?? 'Suspended by Super Admin') : null;

        // If suspending account, immediately revoke all active sessions!
        if (dto.isSuspended) {
          await tx.refreshToken.updateMany({
            where: { userId: targetUserId, isRevoked: false },
            data: { isRevoked: true },
          });
        }
      }

      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: dataToUpdate,
        include: {
          memberships: {
            include: { tenant: { select: { name: true } } },
          },
          _count: {
            select: {
              refreshTokens: {
                where: {
                  isRevoked: false,
                  expiresAt: { gt: new Date() },
                },
              },
            },
          },
        },
      });

      await this.auditService.logEvent({
        actorUserId,
        action: 'PLATFORM_USER_SECURITY_POLICY_UPDATE',
        resourceType: 'User',
        resourceId: targetUserId,
        metadata: {
          targetEmail: updated.email,
          mustResetPassword: updated.mustResetPassword,
          isSuspended: updated.isSuspended,
          reason: dto.reason,
        },
      });

      return {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        phone: updated.phone,
        isPlatformSuperAdmin: updated.isPlatformSuperAdmin,
        mustResetPassword: updated.mustResetPassword,
        isSuspended: updated.isSuspended,
        suspendedReason: updated.suspendedReason,
        activeSessionsCount: updated._count.refreshTokens,
        createdAt: updated.createdAt.toISOString(),
        memberships: updated.memberships.map((m) => ({
          tenantId: m.tenantId,
          tenantName: m.tenant.name,
          role: m.role,
          status: m.status,
        })),
      };
    });
  }

  /**
   * Lists all available platform SaaS subscription tiers.
   */
  async listSaaSPlans(actorUserId: string): Promise<SaaSPlanItem[]> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const plans = await tx.saaSPlan.findMany({
        orderBy: { priceMonthly: 'asc' },
      });
      return plans.map((p) => ({
        id: p.id,
        code: p.code as SaaSPlanItem['code'],
        name: p.name,
        description: p.description,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        currency: p.currency,
        maxBranches: p.maxBranches,
        maxPlayers: p.maxPlayers,
        maxCoaches: p.maxCoaches,
        features: (p.features as Record<string, unknown>) ?? {},
        isActive: p.isActive,
      }));
    });
  }

  /**
   * Updates SaaS plan parameters (price, limits, features).
   */
  async updateSaaSPlan(
    actorUserId: string,
    planCode: string,
    dto: UpdateSaaSPlanRequest,
  ): Promise<SaaSPlanItem> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const plan = await tx.saaSPlan.findUnique({
        where: { code: planCode as any },
      });

      if (!plan) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: `Plan with code ${planCode} not found`,
        });
      }

      const updated = await tx.saaSPlan.update({
        where: { code: planCode as any },
        data: {
          name: dto.name,
          description: dto.description,
          priceMonthly: dto.priceMonthly,
          priceYearly: dto.priceYearly,
          maxBranches: dto.maxBranches,
          maxPlayers: dto.maxPlayers,
          maxCoaches: dto.maxCoaches,
          features: dto.features as any,
          isActive: dto.isActive,
        },
      });

      await this.auditService.logEvent({
        actorUserId,
        action: 'PLATFORM_SAAS_PLAN_UPDATE',
        resourceType: 'SaaSPlan',
        resourceId: updated.id,
        metadata: { planCode, updates: dto },
      });

      return {
        id: updated.id,
        code: updated.code as SaaSPlanItem['code'],
        name: updated.name,
        description: updated.description,
        priceMonthly: updated.priceMonthly,
        priceYearly: updated.priceYearly,
        currency: updated.currency,
        maxBranches: updated.maxBranches,
        maxPlayers: updated.maxPlayers,
        maxCoaches: updated.maxCoaches,
        features: (updated.features as Record<string, unknown>) ?? {},
        isActive: updated.isActive,
      };
    });
  }

  /**
   * Updates or overrides a specific tenant's commercial SaaS subscription.
   */
  async updateTenantSubscription(
    actorUserId: string,
    tenantId: string,
    dto: UpdateTenantSubscriptionRequest,
  ): Promise<TenantSubscriptionItem> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        include: { subscription: { include: { plan: true } } },
      });

      if (!tenant) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Academy not found',
        });
      }

      const updateData: Record<string, any> = {};
      if (dto.planCode) updateData.planCode = dto.planCode;
      if (dto.status) updateData.status = dto.status;
      if (dto.billingCycle) updateData.billingCycle = dto.billingCycle;
      if (typeof dto.negotiatedPrice === 'number') updateData.negotiatedPrice = dto.negotiatedPrice;
      if (dto.renewalDate) updateData.renewalDate = new Date(dto.renewalDate);
      if (dto.trialEndsAt !== undefined) {
        updateData.trialEndsAt = dto.trialEndsAt ? new Date(dto.trialEndsAt) : null;
      }
      if (dto.graceEndsAt !== undefined) {
        updateData.graceEndsAt = dto.graceEndsAt ? new Date(dto.graceEndsAt) : null;
      }
      if (typeof dto.autoRenew === 'boolean') updateData.autoRenew = dto.autoRenew;

      const updated = await tx.tenantSubscription.upsert({
        where: { tenantId },
        create: {
          tenantId,
          planCode: (dto.planCode as any) ?? 'STARTER',
          status: (dto.status as any) ?? 'ACTIVE',
          billingCycle: (dto.billingCycle as any) ?? 'MONTHLY',
          negotiatedPrice: dto.negotiatedPrice,
          renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : new Date(Date.now() + 30 * 86400000),
          autoRenew: dto.autoRenew ?? true,
        },
        update: updateData,
        include: { plan: true },
      });

      await this.auditService.logEvent({
        tenantId,
        actorUserId,
        action: 'PLATFORM_TENANT_SUBSCRIPTION_UPDATE',
        resourceType: 'TenantSubscription',
        resourceId: updated.id,
        metadata: { updates: dto },
      });

      const currentPrice = updated.negotiatedPrice ?? updated.plan.priceMonthly;

      return {
        id: updated.id,
        tenantId: updated.tenantId,
        tenantName: tenant.name,
        planCode: updated.planCode as any,
        planName: updated.plan.name,
        status: updated.status as any,
        billingCycle: updated.billingCycle as any,
        negotiatedPrice: updated.negotiatedPrice,
        currentPrice,
        currency: updated.currency,
        startDate: updated.startDate.toISOString(),
        renewalDate: updated.renewalDate.toISOString(),
        trialEndsAt: updated.trialEndsAt ? updated.trialEndsAt.toISOString() : null,
        graceEndsAt: updated.graceEndsAt ? updated.graceEndsAt.toISOString() : null,
        autoRenew: updated.autoRenew,
        maxBranches: updated.plan.maxBranches,
        maxPlayers: updated.plan.maxPlayers,
        maxCoaches: updated.plan.maxCoaches,
        features: (updated.plan.features as Record<string, unknown>) ?? {},
      };
    });
  }

  /**
   * Authorizes an audited, time-limited support session for a specific academy.
   */
  async requestSupportAccess(
    actorUserId: string,
    academyId: string,
    dto: RequestSupportAccessRequest,
  ): Promise<SupportAccessResponse> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: academyId },
        select: { id: true, name: true, status: true },
      });

      if (!tenant) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Academy not found',
        });
      }

      const grantedAt = new Date();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour session

      const auditEvent = await tx.auditLog.create({
        data: {
          tenantId: academyId,
          actorUserId,
          action: 'PLATFORM_SUPPORT_SESSION_STARTED',
          resourceType: 'Tenant',
          resourceId: academyId,
          metadata: {
            reason: dto.reason,
            grantedAt: grantedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            scope: 'READ_ONLY_SUPPORT',
          },
        },
      });

      return {
        authorized: true,
        tenantId: tenant.id,
        tenantName: tenant.name,
        reason: dto.reason,
        grantedAt: grantedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        auditLogId: auditEvent.id,
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
              'PLATFORM_USER_FORCE_LOGOUT',
              'PLATFORM_USER_SECURITY_POLICY_UPDATE',
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
        } else if (log.action === 'PLATFORM_USER_FORCE_LOGOUT') {
          type = 'PERMISSION_DENIED';
          severity = 'MEDIUM';
          description = `Super Admin forced session termination for user: ${actorEmail ?? log.resourceId}`;
        } else if (log.action === 'PLATFORM_USER_SECURITY_POLICY_UPDATE') {
          type = 'PERMISSION_DENIED';
          severity = 'MEDIUM';
          description = `User security policy modified: ${log.resourceId}`;
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

  /**
   * Retrieves active announcements.
   */
  async listAnnouncements(actorUserId: string): Promise<PlatformAnnouncementItem[]> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const announcements = await tx.platformAnnouncement.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return announcements.map((a) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type as any,
        targetRole: a.targetRole as any,
        isActive: a.isActive,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt ? a.endsAt.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
      }));
    });
  }

  /**
   * Creates a platform-wide announcement.
   */
  async createAnnouncement(
    actorUserId: string,
    dto: CreatePlatformAnnouncementRequest,
  ): Promise<PlatformAnnouncementItem> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const announcement = await tx.platformAnnouncement.create({
        data: {
          title: dto.title,
          message: dto.message,
          type: dto.type as any,
          targetRole: dto.targetRole as any,
          isActive: dto.isActive,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        },
      });

      await this.auditService.logEvent({
        actorUserId,
        action: 'PLATFORM_ANNOUNCEMENT_CREATE',
        resourceType: 'PlatformAnnouncement',
        resourceId: announcement.id,
        metadata: { title: dto.title },
      });

      return {
        id: announcement.id,
        title: announcement.title,
        message: announcement.message,
        type: announcement.type as any,
        targetRole: announcement.targetRole as any,
        isActive: announcement.isActive,
        startsAt: announcement.startsAt.toISOString(),
        endsAt: announcement.endsAt ? announcement.endsAt.toISOString() : null,
        createdAt: announcement.createdAt.toISOString(),
      };
    });
  }
}
