import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type {
  TenantContext,
  PlayerSubscriptionPlanItem,
  CreatePlayerSubscriptionPlanRequest,
} from '@academy/shared';

@Injectable()
export class FinancePlansService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /**
   * Lists player membership plans defined by this Academy.
   */
  async listPlayerSubscriptionPlans(
    tenantContext: TenantContext,
    branchId?: string,
  ): Promise<PlayerSubscriptionPlanItem[]> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const where: Record<string, any> = { tenantId: tenantContext.tenantId };
        if (branchId) {
          where.OR = [{ branchId }, { branchId: null }];
        }

        const plans = await tx.playerSubscriptionPlan.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: { branch: { select: { name: true } } },
        });

        return plans.map((p) => ({
          id: p.id,
          tenantId: p.tenantId,
          branchId: p.branchId,
          branchName: p.branch?.name ?? null,
          sport: p.sport as any,
          name: p.name,
          description: p.description,
          billingPeriod: p.billingPeriod as any,
          feeAmount: p.feeAmount,
          currency: p.currency,
          isActive: p.isActive,
          createdAt: p.createdAt.toISOString(),
        }));
      },
    );
  }

  /**
   * Creates a new player membership plan for the Academy.
   */
  async createPlayerSubscriptionPlan(
    tenantContext: TenantContext,
    dto: CreatePlayerSubscriptionPlanRequest,
  ): Promise<PlayerSubscriptionPlanItem> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const plan = await tx.playerSubscriptionPlan.create({
          data: {
            tenantId: tenantContext.tenantId,
            branchId: dto.branchId,
            sport: dto.sport as any,
            name: dto.name,
            description: dto.description,
            billingPeriod: dto.billingPeriod as any,
            feeAmount: dto.feeAmount,
            currency: dto.currency || 'EGP',
          },
          include: { branch: { select: { name: true } } },
        });

        await this.auditService.logEvent({
          tenantId: tenantContext.tenantId,
          actorUserId: tenantContext.actorUserId,
          action: 'PLAYER_SUBSCRIPTION_PLAN_CREATED',
          resourceType: 'PlayerSubscriptionPlan',
          resourceId: plan.id,
          metadata: { name: plan.name, feeAmount: plan.feeAmount },
        });

        return {
          id: plan.id,
          tenantId: plan.tenantId,
          branchId: plan.branchId,
          branchName: plan.branch?.name ?? null,
          sport: plan.sport as any,
          name: plan.name,
          description: plan.description,
          billingPeriod: plan.billingPeriod as any,
          feeAmount: plan.feeAmount,
          currency: plan.currency,
          isActive: plan.isActive,
          createdAt: plan.createdAt.toISOString(),
        };
      },
    );
  }
}

