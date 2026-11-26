import { money } from '../../common/money';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { HealthService } from '../health/health.service';
import type { PlatformOverviewMetrics } from '@academy/shared';

@Injectable()
export class PlatformMetricsService {
  private readonly logger = new Logger(PlatformMetricsService.name);
  private metricsCache: { data: PlatformOverviewMetrics; expiresAt: number } | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(HealthService) private readonly healthService: HealthService,
  ) {}

  /**
   * Clears the current in-memory cache to force an immediate recalculation.
   */
  clearCache(): void {
    this.metricsCache = null;
  }

  /**
   * Retrieves high-level SaaS platform metrics for Super Administrators.
   * Real database aggregations across tenants, subscriptions, users, and financials.
   */
  async getOverviewMetrics(actorUserId: string): Promise<PlatformOverviewMetrics> {
    if (this.metricsCache && Date.now() < this.metricsCache.expiresAt) {
      return this.metricsCache.data;
    }

    // Health check executes independently outside the database transaction
    const systemHealth = await this.healthService.getPlatformHealth();

    const metrics = await this.prisma.withPlatformAdminTransaction(
      { actorUserId, timeout: 30000, maxWait: 15000 },
      async (tx) => {
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
          expiredSubscriptions,
          upcomingRenewals,
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
          tx.tenantSubscription.count({
            where: {
              status: 'ACTIVE',
              renewalDate: { lte: in14Days, gte: now },
            },
          }),
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

        const activeSubscriptions = activeSubs.length;
        const expiredAcademies = expiredSubscriptions;

        // Calculate Monthly Recurring Revenue (MRR) based on active subscription prices
        const mrr = money(
          activeSubs.reduce(
            (acc: number, sub) => acc + money(sub.negotiatedPrice ?? sub.plan.priceMonthly),
            0,
          ),
        );

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
          collectedRevenue: money(paidInvoicesSum._sum.amount),
          outstandingInvoices: pendingInvoicesCount,
          failedPayments: overdueInvoicesCount,
          systemHealth,
        };
      },
    );

    // Cache metrics in memory for 15 seconds to prevent slamming DB with repeated count aggregations
    this.metricsCache = {
      data: metrics,
      expiresAt: Date.now() + 15000,
    };

    return metrics;
  }
}
