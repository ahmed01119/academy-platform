import { Injectable } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import type {
  AcademyFinancialTransaction,
  PlayerSubscriptionPlan,
  PlayerSubscription,
  Prisma,
} from '@academy/database';
import type { TenantTransactionClient } from '@academy/database';

@Injectable()
export class FinanceRepository extends BaseRepository {
  async findPlanById(
    tenantId: string,
    id: string,
    tx?: TenantTransactionClient,
  ): Promise<PlayerSubscriptionPlan | null> {
    return this.getClient(tx).playerSubscriptionPlan.findFirst({
      where: { id, tenantId },
    });
  }

  async listPlans(
    tenantId: string,
    activeOnly = false,
    tx?: TenantTransactionClient,
  ): Promise<PlayerSubscriptionPlan[]> {
    return this.getClient(tx).playerSubscriptionPlan.findMany({
      where: {
        tenantId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSubscriptionById(
    tenantId: string,
    id: string,
    tx?: TenantTransactionClient,
  ): Promise<PlayerSubscription | null> {
    return this.getClient(tx).playerSubscription.findFirst({
      where: { id, tenantId },
      include: {
        plan: true,
        player: true,
      },
    });
  }

  async createTransaction(
    data: Prisma.AcademyFinancialTransactionCreateInput,
    tx?: TenantTransactionClient,
  ): Promise<AcademyFinancialTransaction> {
    return this.getClient(tx).academyFinancialTransaction.create({
      data,
    });
  }

  async findTransactions(
    tenantId: string,
    params: {
      branchId?: string;
      playerId?: string;
      sessionId?: string;
      limit?: number;
      offset?: number;
    },
    tx?: TenantTransactionClient,
  ): Promise<AcademyFinancialTransaction[]> {
    return this.getClient(tx).academyFinancialTransaction.findMany({
      where: {
        tenantId,
        ...(params.branchId ? { branchId: params.branchId } : {}),
        ...(params.playerId ? { playerId: params.playerId } : {}),
        ...(params.sessionId ? { sessionId: params.sessionId } : {}),
      },
      take: params.limit,
      skip: params.offset,
      orderBy: { createdAt: 'desc' },
    });
  }
}
