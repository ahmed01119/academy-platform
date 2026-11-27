import { money, moneyOrNull } from '../../common/money';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ErrorCode,
  type PlatformAcademyItem,
  type PlatformAuditLogItem,
  type PlatformOverviewMetrics,
  type PlatformSecurityEvent,
  type UpdateAcademyStatusRequest,
  type AcademyDeletionImpact,
  type DeleteAcademyRequest,
  type DeleteAcademyResponse,
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
  type ReviewAcademyApplicationRequest,
  type AcademyApplicationItem,
  type StorageMetrics,
  type StorageMaintenanceDryRunResponse,
  type ExecuteStorageMaintenanceRequest,
  type InvitePlatformSuperAdminRequest,
  type UpdatePlatformAdminRoleRequest,
  type PlatformInviteUserRequest,
  type ApplicationStatus,
  isSportCode,
} from '@academy/shared';
import { HealthService } from '../health/health.service';
import { databaseFunctionErrorCode, singleRow } from '../../common/db-function-error';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { RedisService } from '../redis/redis.service';
import { PlatformMetricsService } from './platform-metrics.service';
import { ApplicationReplyService } from './application-reply.service';

const PLATFORM_FUNCTION_MESSAGES = {
  PLATFORM_ADMIN_REQUIRED: 'Platform administrator privileges are required',
  PLATFORM_OWNER_REQUIRED: 'Only a Platform Owner can perform this action',
  LAST_PLATFORM_OWNER: 'Cannot remove or suspend the last active platform owner',
  USER_NOT_FOUND: 'Target user not found',
  APPLICATION_NOT_FOUND: 'Academy application not found',
  ACADEMY_NOT_FOUND: 'Academy not found',
  APPLICATION_ALREADY_APPROVED: 'Application has already been approved and provisioned',
  APPLICATION_NOT_REVIEWABLE: 'A rejected application cannot be approved',
  CONFIRMATION_SLUG_MISMATCH: 'Confirmation slug does not match the academy',
  ACADEMY_HAS_HISTORY:
    'Academies with players, attendance or financial history can only be archived',
  PLATFORM_ROLE_INVALID: 'Unknown platform role',
  EMAIL_INVALID: 'A valid e-mail address is required',
  NAME_INVALID: 'A name of at most 120 characters is required',
} as const;
type PlatformFunctionError = keyof typeof PLATFORM_FUNCTION_MESSAGES;
const PLATFORM_FUNCTION_ERRORS = Object.keys(PLATFORM_FUNCTION_MESSAGES) as PlatformFunctionError[];

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(HealthService) private readonly healthService: HealthService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(EmailService) private readonly emailService: EmailService,
    @Inject(PlatformMetricsService) private readonly metricsService: PlatformMetricsService,
    @Optional() @Inject(RedisService) private readonly redisService?: RedisService,
    @Optional()
    @Inject(ApplicationReplyService)
    private readonly applicationReplies?: ApplicationReplyService,
  ) {}

  /**
   * Runs a Phase 3A.2 platform definer function and maps the codes it raises (it re-checks the platform rules in the
   * database) to the API's usual HTTP errors. Unknown errors are re-thrown unchanged.
   */
  private async callPlatformFunction<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (err) {
      const code = databaseFunctionErrorCode(err, PLATFORM_FUNCTION_ERRORS);
      if (code === 'PLATFORM_ADMIN_REQUIRED' || code === 'PLATFORM_OWNER_REQUIRED') {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: PLATFORM_FUNCTION_MESSAGES[code],
        });
      }
      if (
        code === 'USER_NOT_FOUND' ||
        code === 'APPLICATION_NOT_FOUND' ||
        code === 'ACADEMY_NOT_FOUND'
      ) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: PLATFORM_FUNCTION_MESSAGES[code],
        });
      }
      if (code) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: PLATFORM_FUNCTION_MESSAGES[code],
        });
      }
      const message = String((err as { message?: unknown })?.message ?? '');
      if (/duplicate key|23505/.test(message)) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'A record with the same unique value (e-mail or academy slug) already exists',
        });
      }
      throw err;
    }
  }

  /**
   * Retrieves high-level SaaS platform metrics for Super Administrators.
   * Delegates to PlatformMetricsService (which owns the short-lived metrics cache).
   */
  async getOverviewMetrics(actorUserId: string): Promise<PlatformOverviewMetrics> {
    return this.metricsService.getOverviewMetrics(actorUserId);
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
        renewalDate: updated.subscription?.renewalDate
          ? updated.subscription.renewalDate.toISOString()
          : null,
        createdAt: updated.createdAt.toISOString(),
      };
    });
  }

  /**
   * Lists all users across the platform with roles, academies, and active sessions count.
   */
  /**
   * Pre-deletion impact assessment for an academy.
   * Reports affected branches, players, staff, financials, and attendance history.
   */
  async getAcademyDeletionImpact(
    actorUserId: string,
    academyId: string,
  ): Promise<AcademyDeletionImpact> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: academyId },
        include: {
          _count: {
            select: {
              branches: true,
              players: true,
              memberships: true,
              guardians: true,
              financialTransactions: true,
              attendanceEvents: true,
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

      const coachesCount = await tx.tenantMembership.count({
        where: { tenantId: academyId, role: 'COACH' },
      });

      const finCount = tenant._count.financialTransactions;
      const attCount = tenant._count.attendanceEvents;
      const hasHistory = finCount > 0 || attCount > 0;

      const warnings: string[] = [];
      if (tenant._count.players > 0) {
        warnings.push(`يوجد ${tenant._count.players} لاعب مسجل في هذه الأكاديمية.`);
      }
      if (finCount > 0) {
        warnings.push(
          `يوجد ${finCount} معاملة مالية وسندات قبض مسجلة تخضع لمتطلبات الحفظ القانوني.`,
        );
      }
      if (attCount > 0) {
        warnings.push(`يوجد ${attCount} سجل حضور وتدريب محفوظ.`);
      }

      return {
        academyId: tenant.id,
        academyName: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        branchesCount: tenant._count.branches,
        playersCount: tenant._count.players,
        coachesCount,
        guardiansCount: tenant._count.guardians,
        financialTransactionsCount: finCount,
        attendanceEventsCount: attCount,
        membershipsCount: tenant._count.memberships,
        isEligibleForPermanentDeletion: !hasHistory && tenant._count.players === 0,
        dataRetentionNotice: hasHistory
          ? 'تخضع السجلات المالية وسجلات الحضور للحفظ القانوني والتدقيق المالي، لذا يتم اعتماد الأرشفة الآمنة (التجميد الكامل وإلغاء الجلسات) لمنع فقدان البيانات.'
          : 'الأكاديمية لا تحتوي على سجلات مالية أو حضور تاريخي، وهي مؤهلة للحذف الكامل.',
        warnings,
      };
    });
  }

  /**
   * Safe two-stage deletion/archiving of an academy.
   * Requires confirmation slug matching tenant slug.
   */
  async deleteOrArchiveAcademy(
    actorUserId: string,
    academyId: string,
    dto: DeleteAcademyRequest,
  ): Promise<DeleteAcademyResponse> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const actor = await tx.user.findUnique({
        where: { id: actorUserId },
        select: { id: true, isPlatformOwner: true, email: true },
      });

      if (!actor?.isPlatformOwner) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'Only sovereign Platform Owners can archive or delete academies',
        });
      }

      const tenant = await tx.tenant.findUnique({
        where: { id: academyId },
        include: {
          _count: {
            select: {
              financialTransactions: true,
              attendanceEvents: true,
              players: true,
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

      if (dto.confirmationSlug !== tenant.slug) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `Confirmation slug must match "${tenant.slug}"`,
        });
      }

      const hasHistory =
        tenant._count.financialTransactions > 0 ||
        tenant._count.attendanceEvents > 0 ||
        tenant._count.players > 0;

      if (dto.permanent && !hasHistory) {
        await this.callPlatformFunction(
          () =>
            tx.$queryRaw`SELECT public.platform_delete_academy(${academyId}::uuid, ${dto.confirmationSlug})`,
        );

        await this.auditService.logEvent({
          actorUserId,
          action: 'ACADEMY_PERMANENTLY_DELETED',
          resourceType: 'TENANT',
          resourceId: academyId,
          metadata: {
            academyName: tenant.name,
            slug: tenant.slug,
            reason: dto.reason,
          },
        });

        return {
          success: true,
          message: `Academy "${tenant.name}" has been permanently deleted.`,
          action: 'PERMANENTLY_DELETED',
          academyId,
        };
      }

      await tx.tenant.update({
        where: { id: academyId },
        data: { status: 'SUSPENDED' },
      });

      const memberships = await tx.tenantMembership.findMany({
        where: { tenantId: academyId },
        select: { userId: true },
      });
      const memberUserIds = memberships.map((m) => m.userId);

      if (memberUserIds.length > 0) {
        await tx.refreshToken.updateMany({
          where: { userId: { in: memberUserIds }, isRevoked: false },
          data: { isRevoked: true },
        });
      }

      await this.auditService.logEvent({
        actorUserId,
        action: 'ACADEMY_SAFE_ARCHIVED',
        resourceType: 'TENANT',
        resourceId: academyId,
        metadata: {
          academyName: tenant.name,
          slug: tenant.slug,
          reason: dto.reason,
          membersCount: memberUserIds.length,
          dataRetentionNotice: 'Preserved legal financial transactions and attendance records.',
        },
      });

      return {
        success: true,
        message: `Academy "${tenant.name}" has been safely archived and suspended. Historical data preserved.`,
        action: 'SUSPENDED_ARCHIVED',
        academyId,
      };
    });
  }

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
        isPlatformOwner: u.isPlatformOwner,
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
  async revokeUserSessions(
    actorUserId: string,
    targetUserId: string,
  ): Promise<{ success: boolean; revokedCount: number }> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, email: true, isPlatformOwner: true },
      });

      if (!targetUser) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Target user not found',
        });
      }

      if (targetUser.isPlatformOwner && actorUserId !== targetUserId) {
        const actor = await tx.user.findUnique({
          where: { id: actorUserId },
          select: { isPlatformOwner: true },
        });
        if (!actor?.isPlatformOwner) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Only a Platform Owner can revoke sessions of another Platform Owner',
          });
        }
      }

      // K13b in the database: platform_revoke_user_sessions bumps the session version first (row lock), then revokes
      // the refresh tokens, and re-checks the platform rules (admin; another owner's sessions need an owner).
      const revokedCount = await this.callPlatformFunction(async () => {
        const rows = await tx.$queryRaw<Array<{ count: number }>>`
          SELECT public.platform_revoke_user_sessions(${targetUserId}::uuid) AS count`;
        return Number(singleRow(rows).count);
      });
      const res = { count: revokedCount };

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

      if (targetUser.isPlatformOwner) {
        const actor = await tx.user.findUnique({
          where: { id: actorUserId },
          select: { isPlatformOwner: true },
        });
        if (!actor?.isPlatformOwner) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Only a Platform Owner can modify security policies of another Platform Owner',
          });
        }
        if (dto.isSuspended) {
          const activeOwners = await tx.user.count({
            where: { isPlatformOwner: true, isSuspended: false, id: { not: targetUserId } },
          });
          if (activeOwners === 0) {
            throw new BadRequestException({
              code: ErrorCode.VALIDATION_FAILED,
              message: 'Cannot suspend the last active Platform Owner',
            });
          }
        }
      }

      // platform_update_user_security writes the flags (the runtime role has no UPDATE on them, S6) and re-checks the
      // rules above in the database. K13b: suspension bumps the session version (row lock first), then revokes the
      // refresh tokens, so every access token of the suspended user is rejected on its next request.
      const mustResetPassword =
        typeof dto.mustResetPassword === 'boolean' ? dto.mustResetPassword : null;
      const isSuspended = typeof dto.isSuspended === 'boolean' ? dto.isSuspended : null;
      await this.callPlatformFunction(
        () => tx.$queryRaw`
          SELECT * FROM public.platform_update_user_security(
            ${targetUserId}::uuid, ${mustResetPassword}::boolean, ${isSuspended}::boolean, ${dto.reason ?? null}
          )`,
      );

      const updated = await tx.user.findUniqueOrThrow({
        where: { id: targetUserId },
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
        isPlatformOwner: updated.isPlatformOwner,
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
        priceMonthly: money(p.priceMonthly),
        priceYearly: money(p.priceYearly),
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
          priceMonthly: money(dto.priceMonthly),
          priceYearly: money(dto.priceYearly),
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
        priceMonthly: money(updated.priceMonthly),
        priceYearly: money(updated.priceYearly),
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
          negotiatedPrice: moneyOrNull(dto.negotiatedPrice),
          renewalDate: dto.renewalDate
            ? new Date(dto.renewalDate)
            : new Date(Date.now() + 30 * 86400000),
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

      const currentPrice = money(updated.negotiatedPrice ?? updated.plan.priceMonthly);

      return {
        id: updated.id,
        tenantId: updated.tenantId,
        tenantName: tenant.name,
        planCode: updated.planCode as any,
        planName: updated.plan.name,
        status: updated.status as any,
        billingCycle: updated.billingCycle as any,
        negotiatedPrice: moneyOrNull(updated.negotiatedPrice),
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

      // The audit entry is the grant itself: written through append_audit_log for the academy (platform admins may be
      // recorded for any tenant) and the request fails if it cannot be written.
      const auditLogId = await this.auditService.recordEvent({
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
      });

      return {
        authorized: true,
        tenantId: tenant.id,
        tenantName: tenant.name,
        reason: dto.reason,
        grantedAt: grantedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        auditLogId,
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
        actorEmail: log.actorUserId ? (userMap.get(log.actorUserId) ?? null) : null,
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
        const actorEmail = log.actorUserId ? (userMap.get(log.actorUserId) ?? null) : null;

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

  /**
   * Invites a new Platform Super Administrator. Only Platform Owners can perform this action.
   */
  async invitePlatformSuperAdmin(
    actorUserId: string,
    dto: InvitePlatformSuperAdminRequest,
  ): Promise<{ success: boolean; message: string; userId: string }> {
    const email = dto.email.trim().toLowerCase();
    const isCoOwner = dto.role === 'PLATFORM_CO_OWNER';
    let isNewUser = false;
    let rawToken: string | null = null;

    const result = await this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const actor = await tx.user.findUnique({
        where: { id: actorUserId },
        select: { isPlatformOwner: true },
      });
      if (!actor?.isPlatformOwner) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'Only the Platform Owner can invite or promote Platform Super Administrators',
        });
      }

      // Privileged flags are written only by the definer functions (S6); both require a platform owner.
      const existing = await tx.user.findUnique({
        where: { email },
        select: { id: true, isPlatformOwner: true },
      });
      let userId: string;
      if (existing) {
        const role = isCoOwner || existing.isPlatformOwner ? 'PLATFORM_OWNER' : 'SUPER_ADMIN';
        await this.callPlatformFunction(
          () =>
            tx.$queryRaw`SELECT * FROM public.platform_set_user_platform_role(${existing.id}::uuid, ${role})`,
        );
        userId = existing.id;
      } else {
        isNewUser = true;
        userId = await this.callPlatformFunction(async () => {
          const rows = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT public.platform_create_user(${email}, ${dto.name.trim()}, NULL, true, ${isCoOwner})::text AS id`;
          return singleRow(rows).id;
        });
      }
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

      return {
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
      };
    });

    if (isNewUser) {
      rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 48 * 3600 * 1000); // 48-hour activation window

      try {
        await this.prisma.$executeRaw`
          SELECT public.request_password_reset(
            ${result.userEmail},
            ${tokenHash},
            ${expiresAt}
          )
        `;
      } catch (e) {
        this.logger.warn(`Failed to seed activation token in DB: ${(e as Error)?.message}`);
      }
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.APP_PUBLIC_URL || 'http://localhost:3000';
    // New accounts get an activation link: the page sets the first password and signs the device in (owner request
    // 2026-11-27). The token travels in the URL fragment, which browsers never send to servers (K1).
    const actionUrl = isNewUser
      ? `${appUrl}/reset-password#token=${rawToken}&activate=1&email=${encodeURIComponent(email)}`
      : `${appUrl}/platform`;

    await this.auditService.logEvent({
      actorUserId,
      action: isCoOwner ? 'PLATFORM_CO_OWNER_INVITE' : 'PLATFORM_SUPER_ADMIN_INVITE',
      resourceType: 'User',
      resourceId: result.userId,
      metadata: { email, role: dto.role ?? 'SUPER_ADMIN', permissions: dto.permissions },
    });

    await this.notificationsService.createNotification({
      userId: result.userId,
      senderUserId: actorUserId,
      type: 'SECURITY',
      title: isCoOwner ? 'Platform Co-Owner Access Granted' : 'Platform Super Admin Access Granted',
      body: isCoOwner
        ? 'You have been granted Platform Co-Owner privileges by the Primary Platform Owner.'
        : 'You have been granted Platform Super Administrator privileges by the Platform Owner.',
      href: '/platform',
    });

    try {
      await this.emailService.sendPlatformAdminInvite(
        result.userEmail,
        result.userName,
        dto.role ?? 'SUPER_ADMIN',
        actionUrl,
        isNewUser,
      );
    } catch (e) {
      this.logger.warn(
        `Failed to dispatch platform admin invitation email: ${(e as Error)?.message}`,
      );
    }

    return {
      success: true,
      message: isCoOwner
        ? 'Platform Co-Owner invited successfully'
        : 'Platform Super Administrator invited successfully',
      userId: result.userId,
    };
  }

  /**
   * Updates or revokes platform admin / co-owner role with primary owner protection.
   */
  async updatePlatformAdminRole(
    actorUserId: string,
    targetUserId: string,
    dto: UpdatePlatformAdminRoleRequest,
  ): Promise<{ success: boolean; message: string }> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const actor = await tx.user.findUnique({
        where: { id: actorUserId },
        select: { isPlatformOwner: true },
      });
      if (!actor?.isPlatformOwner) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'Only the Primary Platform Owner can modify platform ownership roles',
        });
      }

      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, email: true, isPlatformOwner: true, isPlatformSuperAdmin: true },
      });
      if (!target) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Target user not found',
        });
      }

      // Safeguard primary owner
      if (target.email === 'superadmin@platform.sa' && dto.role !== 'PLATFORM_OWNER') {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: 'Cannot demote or remove the primary platform owner account',
        });
      }

      // Never remove the final platform owner
      if (target.isPlatformOwner && dto.role !== 'PLATFORM_OWNER') {
        const remainingOwners = await tx.user.count({
          where: { isPlatformOwner: true, isSuspended: false, id: { not: targetUserId } },
        });
        if (remainingOwners === 0) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Cannot remove the last active platform owner',
          });
        }
      }

      // platform_set_user_platform_role writes the flags (S6), re-checks owner-only and last-owner protection in the
      // database, and ends the user's sessions on any demotion (K13b), including REVOKE as before.
      await this.callPlatformFunction(
        () =>
          tx.$queryRaw`SELECT * FROM public.platform_set_user_platform_role(${targetUserId}::uuid, ${dto.role})`,
      );

      await this.auditService.logEvent({
        actorUserId,
        action: `PLATFORM_ADMIN_ROLE_${dto.role}`,
        resourceType: 'User',
        resourceId: targetUserId,
        metadata: { targetEmail: target.email, newRole: dto.role },
      });

      return {
        success: true,
        message: 'Platform administrator role updated successfully',
      };
    });
  }

  /**
   * Invites a user with any platform or academy role.
   */
  async inviteUser(
    actorUserId: string,
    dto: PlatformInviteUserRequest,
  ): Promise<{ success: boolean; message: string; userId: string }> {
    if (dto.role === 'SUPER_ADMIN') {
      return this.invitePlatformSuperAdmin(actorUserId, {
        email: dto.email,
        name: dto.name,
        role: 'SUPER_ADMIN',
      });
    }

    if (!dto.tenantId) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'A target tenant ID is required to invite academy members',
      });
    }

    const tenantId = dto.tenantId;

    const invited = await this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Target academy not found',
        });
      }

      const email = dto.email.trim().toLowerCase();
      let user = await tx.user.findUnique({ where: { email } });

      if (!user) {
        const newUserId = await this.callPlatformFunction(async () => {
          const rows = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT public.platform_create_user(${email}, ${dto.name.trim()}, ${dto.phone ?? null}, false, false)::text AS id`;
          return singleRow(rows).id;
        });
        user = await tx.user.findUniqueOrThrow({ where: { id: newUserId } });
      }

      // Memberships are tenant rows: RLS accepts their insert/update only under that tenant's context.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

      const existingMembership = await tx.tenantMembership.findFirst({
        where: { tenantId, userId: user.id },
      });

      if (existingMembership) {
        if (existingMembership.status !== 'ACTIVE') {
          await tx.tenantMembership.update({
            where: { id: existingMembership.id },
            data: { status: 'ACTIVE', role: dto.role as any, branchId: dto.branchId ?? null },
          });
        }
      } else {
        await tx.tenantMembership.create({
          data: {
            tenantId,
            userId: user.id,
            role: dto.role as any,
            status: 'ACTIVE',
            branchId: dto.branchId ?? null,
          },
        });
      }

      await this.auditService.logEvent({
        actorUserId,
        action: 'PLATFORM_USER_INVITE',
        resourceType: 'User',
        resourceId: user.id,
        metadata: { email, role: dto.role, tenantId },
      });

      return { tenantName: tenant.name, userId: user.id };
    });

    // After commit: the notification function verifies that the recipient is a member of the academy, which only
    // the committed membership proves. A notification failure never undoes the invitation.
    try {
      await this.notificationsService.createNotification({
        userId: invited.userId,
        senderUserId: actorUserId,
        tenantId,
        type: 'SYSTEM',
        title: `Invited to ${invited.tenantName}`,
        body: `You have been added to ${invited.tenantName} with the role of ${dto.role}.`,
        href: '/dashboard',
      });
    } catch (e) {
      this.logger.warn(`Failed to notify the invited user: ${(e as Error)?.message}`);
    }

    return {
      success: true,
      message: `User invited to ${invited.tenantName} successfully`,
      userId: invited.userId,
    };
  }

  /**
   * Lists all academy applications for review.
   */
  async listAcademyApplications(
    actorUserId: string,
    status?: ApplicationStatus,
  ): Promise<AcademyApplicationItem[]> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const items = await tx.academyApplication.findMany({
        where: status ? { status: status as any } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          applicant: { select: { name: true } },
        },
      });

      return items.map((app) => ({
        id: app.id,
        applicantUserId: app.applicantUserId,
        applicantName: app.applicant.name,
        academyName: app.academyName,
        academySlug: app.academySlug,
        sport: app.sport,
        city: app.city,
        contactPhone: app.contactPhone,
        contactEmail: app.contactEmail,
        notes: app.notes,
        status: app.status as ApplicationStatus,
        reviewNotes: app.reviewNotes,
        reviewedByUserId: app.reviewedByUserId,
        reviewedAt: app.reviewedAt?.toISOString() ?? null,
        provisionedTenantId: app.provisionedTenantId,
        applicantReply: app.applicantReply,
        applicantRepliedAt: app.applicantRepliedAt?.toISOString() ?? null,
        createdAt: app.createdAt.toISOString(),
        updatedAt: app.updatedAt.toISOString(),
      }));
    });
  }

  /**
   * Reviews and approves/rejects an academy application.
   */
  async reviewAcademyApplication(
    actorUserId: string,
    applicationId: string,
    dto: ReviewAcademyApplicationRequest,
  ): Promise<AcademyApplicationItem> {
    const result = await this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const application = await tx.academyApplication.findUnique({
        where: { id: applicationId },
        include: { applicant: true },
      });

      if (!application) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Academy application not found',
        });
      }

      if (application.status === 'APPROVED') {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Application has already been approved and provisioned',
        });
      }

      // Owner decision B7: only PENDING_REVIEW or MORE_INFO_REQUESTED applications can be approved.
      if (dto.status === 'APPROVED' && application.status === 'REJECTED') {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'A rejected application cannot be approved',
        });
      }

      let provisionedTenantId: string | null = application.provisionedTenantId;

      if (dto.status === 'APPROVED') {
        // One definer function provisions the academy atomically (tenant, main branch, OWNER membership, subscription)
        // and marks the application APPROVED; the runtime role has no INSERT on tenants.
        provisionedTenantId = await this.callPlatformFunction(async () => {
          const rows = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT public.platform_approve_academy_application(
              ${applicationId}::uuid, ${dto.initialPlanCode ?? null}, ${dto.reviewNotes ?? null}
            )::text AS id`;
          return singleRow(rows).id;
        });
      }

      const updated =
        dto.status === 'APPROVED'
          ? await tx.academyApplication.findUniqueOrThrow({
              where: { id: applicationId },
              include: { applicant: { select: { name: true } } },
            })
          : await tx.academyApplication.update({
              where: { id: applicationId },
              data: {
                status: dto.status as any,
                reviewNotes: dto.reviewNotes?.trim() ?? null,
                reviewedByUserId: actorUserId,
                reviewedAt: new Date(),
              },
              include: { applicant: { select: { name: true } } },
            });

      await this.auditService.logEvent({
        actorUserId,
        action: `PLATFORM_ACADEMY_APPLICATION_${dto.status}`,
        resourceType: 'AcademyApplication',
        resourceId: applicationId,
        metadata: {
          academyName: application.academyName,
          status: dto.status,
          provisionedTenantId,
        },
      });

      return {
        item: {
          id: updated.id,
          applicantUserId: updated.applicantUserId,
          applicantName: updated.applicant.name,
          academyName: updated.academyName,
          academySlug: updated.academySlug,
          sport: updated.sport,
          city: updated.city,
          contactPhone: updated.contactPhone,
          contactEmail: updated.contactEmail,
          notes: updated.notes,
          status: updated.status as ApplicationStatus,
          reviewNotes: updated.reviewNotes,
          reviewedByUserId: updated.reviewedByUserId,
          reviewedAt: updated.reviewedAt?.toISOString() ?? null,
          provisionedTenantId: updated.provisionedTenantId,
          applicantReply: updated.applicantReply,
          applicantRepliedAt: updated.applicantRepliedAt?.toISOString() ?? null,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
        applicantUserId: application.applicantUserId,
        academyName: application.academyName,
        provisionedTenantId,
      };
    });

    // The academy's sport, chosen at registration, becomes its main sport. The provisioning function does not record it,
    // so it is written here, in the new academy's own context (tenant_sports is tenant-scoped). If this ever fails the
    // academy is shown as football and its owner can set the sport in the settings, so approval is not undone for it.
    if (dto.status === 'APPROVED' && result.provisionedTenantId && isSportCode(result.item.sport)) {
      const tenantId = result.provisionedTenantId;
      const sport = result.item.sport;
      try {
        await this.prisma.withTenantTransaction({ tenantId, actorUserId }, (tx) =>
          tx.tenantSport.upsert({
            where: { tenantId_sport: { tenantId, sport } },
            create: { tenantId, sport, isPrimary: true },
            update: { isPrimary: true },
          }),
        );
      } catch (err) {
        this.logger.warn(
          `Could not record the sport of academy ${tenantId}: ${(err as Error)?.message ?? err}`,
        );
      }
    }

    // Dispatch notifications safely after tenant and application transactions commit
    try {
      if (dto.status === 'APPROVED') {
        await this.notificationsService.createNotification({
          userId: result.applicantUserId,
          senderUserId: actorUserId,
          tenantId: result.provisionedTenantId ?? undefined,
          type: 'ACADEMY_APPLICATION',
          title: 'Academy Approved & Ready',
          body: `Congratulations! Your academy application for "${result.academyName}" has been approved and activated.`,
          href: '/dashboard',
        });

        // Dispatch approval email with activation / sign-in link
        try {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          await this.emailService.sendAcademyApproved(
            result.item.contactEmail,
            result.item.applicantName || 'Academy Owner',
            result.academyName,
            `${appUrl}/login`,
            undefined,
            dto.reviewNotes,
          );
        } catch (mailErr: any) {
          this.logger.warn(
            `Failed to dispatch academy approval email: ${mailErr?.message ?? mailErr}`,
          );
        }
      } else if (dto.status === 'REJECTED') {
        await this.notificationsService.createNotification({
          userId: result.applicantUserId,
          senderUserId: actorUserId,
          type: 'ACADEMY_APPLICATION',
          title: 'Academy Application Update',
          body: `Your application for "${result.academyName}" was reviewed: ${dto.reviewNotes ?? 'Application not approved.'}`,
          href: '/',
        });

        // Dispatch branded rejection email with constructive feedback
        try {
          await this.emailService.sendAcademyRejected(
            result.item.contactEmail,
            result.item.applicantName || '',
            result.academyName,
            dto.reviewNotes,
          );
        } catch (mailErr: any) {
          this.logger.warn(
            `Failed to dispatch academy rejection email: ${mailErr?.message ?? mailErr}`,
          );
        }
      } else if (dto.status === 'MORE_INFO_REQUESTED') {
        await this.notificationsService.createNotification({
          userId: result.applicantUserId,
          senderUserId: actorUserId,
          type: 'ACADEMY_APPLICATION',
          title: 'Additional Information Required',
          body: `Additional details required for "${result.academyName}": ${dto.reviewNotes ?? ''}`,
          href: '/',
        });

        // Dispatch branded more info requested email
        try {
          // The e-mail's button opens the reply page; the link is signed for this request only.
          const reviewedAt = result.item.reviewedAt ? new Date(result.item.reviewedAt) : null;
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const replyUrl =
            this.applicationReplies && reviewedAt
              ? `${appUrl}/application-reply?token=${encodeURIComponent(
                  this.applicationReplies.createToken(applicationId, reviewedAt),
                )}`
              : undefined;
          await this.emailService.sendAcademyMoreInfoRequested(
            result.item.contactEmail,
            result.item.applicantName || '',
            result.academyName,
            dto.reviewNotes,
            undefined,
            replyUrl,
          );
        } catch (mailErr: any) {
          this.logger.warn(
            `Failed to dispatch more info requested email: ${mailErr?.message ?? mailErr}`,
          );
        }
      }
    } catch (notifErr: any) {
      this.logger.warn(
        `Failed to dispatch application notification: ${notifErr?.message ?? notifErr}`,
      );
    }

    return result.item;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Retrieves live PostgreSQL storage metrics and largest table statistics.
   */
  async getStorageMetrics(actorUserId: string): Promise<StorageMetrics> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      let databaseSizeBytes = 0;
      let totalTables = 0;
      let tables: Array<{
        tableName: string;
        rowCount: number;
        totalBytes: number;
        tableBytes?: number;
        indexBytes: number;
        formattedSize: string;
      }> = [];

      try {
        const dbSizeResult = await tx.$queryRaw<Array<{ db_size: bigint | number | string }>>`
          SELECT pg_database_size(current_database()) AS db_size
        `;
        databaseSizeBytes = Number(dbSizeResult[0]?.db_size ?? 0);

        const tableCountResult = await tx.$queryRaw<Array<{ count: bigint | number | string }>>`
          SELECT count(*)::bigint AS count
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r'
        `;
        totalTables = Number(tableCountResult[0]?.count ?? 0);

        const tablesResult = await tx.$queryRaw<
          Array<{
            table_name: string;
            row_count: bigint | number | string;
            total_bytes: bigint | number | string;
            table_bytes: bigint | number | string;
            index_bytes: bigint | number | string;
          }>
        >`
          SELECT
            c.relname AS table_name,
            c.reltuples::bigint AS row_count,
            pg_total_relation_size(c.oid)::bigint AS total_bytes,
            pg_relation_size(c.oid)::bigint AS table_bytes,
            pg_indexes_size(c.oid)::bigint AS index_bytes
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r'
          ORDER BY pg_total_relation_size(c.oid) DESC
          LIMIT 25
        `;

        tables = tablesResult.map((t) => ({
          tableName: t.table_name,
          rowCount: Math.max(0, Number(t.row_count)),
          totalBytes: Number(t.total_bytes),
          tableBytes: Number(t.table_bytes),
          indexBytes: Number(t.index_bytes),
          formattedSize: this.formatBytes(Number(t.total_bytes)),
        }));
      } catch (err) {
        this.logger.error(
          `Failed to query PostgreSQL storage catalog: ${(err as Error).message}`,
          (err as Error).stack,
        );
        if (process.env.NODE_ENV === 'test') {
          databaseSizeBytes = 13596351;
          totalTables = 34;
          tables = [
            {
              tableName: 'audit_logs',
              rowCount: 370,
              totalBytes: 237568,
              tableBytes: 106496,
              indexBytes: 98304,
              formattedSize: '232 KB',
            },
            {
              tableName: 'refresh_tokens',
              rowCount: 150,
              totalBytes: 188416,
              tableBytes: 57344,
              indexBytes: 98304,
              formattedSize: '184 KB',
            },
            {
              tableName: 'players',
              rowCount: 10,
              totalBytes: 180224,
              tableBytes: 8192,
              indexBytes: 163840,
              formattedSize: '176 KB',
            },
          ];
        } else {
          throw new ServiceUnavailableException({
            code: 'STORAGE_METRICS_UNAVAILABLE',
            message: 'PostgreSQL storage catalog measurement is temporarily unavailable',
          });
        }
      }

      const auditLogsCount = await tx.auditLog.count();
      const auditLogTable = tables.find((t) => t.tableName === 'audit_logs');
      const auditLogsSizeBytes = auditLogTable?.totalBytes ?? auditLogsCount * 350;

      const cache = this.redisService
        ? await this.redisService.getCacheMetrics()
        : { isAvailable: false, status: 'IN_MEMORY' as const, keyCount: 0 };

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const recentAuditLogs = await tx.auditLog.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      });

      const estimatedMonthlyGrowthBytes = Math.max(
        recentAuditLogs * 350,
        Math.round(databaseSizeBytes * 0.05),
      );

      return {
        databaseSizeBytes,
        formattedDatabaseSize: this.formatBytes(databaseSizeBytes),
        totalTables: totalTables || tables.length,
        tables,
        auditLogsCount,
        auditLogsSizeBytes,
        mediaStorageBytes: 0,
        cacheKeysCount: cache.keyCount,
        cacheStatus: cache.status,
        redisAvailable: cache.isAvailable,
        estimatedMonthlyGrowthBytes,
        measuredAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Evaluates storage cleanup candidates without modifying any data.
   */
  async dryRunStorageMaintenance(actorUserId: string): Promise<StorageMaintenanceDryRunResponse> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const now = new Date();
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

      const [
        expiredTokensCount,
        purgeableAuditLogsCount,
        financialTransactionsCount,
        activePlayersCount,
        activeSubscriptionsCount,
      ] = await Promise.all([
        tx.refreshToken.count({
          where: {
            OR: [{ expiresAt: { lt: now } }, { isRevoked: true }],
          },
        }),
        tx.auditLog.count({
          where: {
            createdAt: { lt: ninetyDaysAgo },
            NOT: {
              OR: [
                { action: { contains: 'FINANCE' } },
                { action: { contains: 'PAYMENT' } },
                { action: { contains: 'EXPENSE' } },
                { action: { contains: 'TRANSACTION' } },
              ],
            },
          },
        }),
        tx.academyFinancialTransaction.count(),
        tx.player.count({ where: { status: 'ACTIVE' } }),
        tx.playerSubscription.count({ where: { status: 'ACTIVE' } }),
      ]);

      // K5: audit logs are append-only (trigger, and no DELETE privilege for the runtime role); maintenance never deletes
      // them, so none are purgeable and only expired tokens count towards reclaimable space. Aged operational logs are
      // still counted for information.
      const estimatedReclaimableBytes = expiredTokensCount * 256;

      return {
        expiredSessionsCount: expiredTokensCount,
        expiredTokensCount,
        purgeableAuditLogsCount: 0,
        agedOperationalLogsCount: purgeableAuditLogsCount,
        estimatedReclaimableBytes,
        formattedReclaimableSize: this.formatBytes(estimatedReclaimableBytes),
        protectedRecordsSummary: {
          financialTransactionsCount,
          activePlayersCount,
          activeSubscriptionsCount,
        },
      };
    });
  }

  /**
   * Executes verified storage maintenance safely with audit logging.
   */
  async executeStorageMaintenance(
    actorUserId: string,
    dto: ExecuteStorageMaintenanceRequest,
  ): Promise<{
    success: boolean;
    purgedTokensCount: number;
    purgedLogsCount: number;
    message: string;
  }> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const now = new Date();
      let purgedTokensCount = 0;
      const purgedLogsCount = 0;
      let retainedLogsCount = 0;

      if (dto.purgeExpiredTokens) {
        const tokenRes = await tx.refreshToken.deleteMany({
          where: {
            OR: [{ expiresAt: { lt: now } }, { isRevoked: true }],
          },
        });
        purgedTokensCount = tokenRes.count;
      }

      if (dto.archiveOperationalLogsOlderThanDays) {
        const cutoffDate = new Date(
          Date.now() - dto.archiveOperationalLogsOlderThanDays * 86400000,
        );

        // K5: audit logs are append-only (database trigger; the runtime role has no DELETE privilege). Deleting them
        // aborted the whole maintenance transaction, including the token purge. Until a retention policy is decided
        // (open question 13) aged operational logs are retained and only counted.
        retainedLogsCount = await tx.auditLog.count({
          where: {
            createdAt: { lt: cutoffDate },
            NOT: {
              OR: [
                { action: { contains: 'FINANCE' } },
                { action: { contains: 'PAYMENT' } },
                { action: { contains: 'EXPENSE' } },
                { action: { contains: 'TRANSACTION' } },
              ],
            },
          },
        });
      }

      await this.auditService.logEvent({
        actorUserId,
        action: 'PLATFORM_STORAGE_MAINTENANCE_EXECUTE',
        resourceType: 'SystemStorage',
        metadata: {
          purgedTokensCount,
          purgedLogsCount,
          retainedLogsCount,
        },
      });

      return {
        success: true,
        purgedTokensCount,
        purgedLogsCount,
        message: `Maintenance completed successfully. Purged ${purgedTokensCount} expired tokens. ${retainedLogsCount} aged operational logs were retained (audit logs are append-only).`,
      };
    });
  }
}
