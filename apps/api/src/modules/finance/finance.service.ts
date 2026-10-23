import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ErrorCode,
  type TenantContext,
  type TenantSubscriptionItem,
  type PlayerSubscriptionPlanItem,
  type CreatePlayerSubscriptionPlanRequest,
  type PlayerSubscriptionItem,
  type CreatePlayerSubscriptionRequest,
  type FinancialTransactionItem,
  type RecordPlayerPaymentRequest,
  type ReverseTransactionRequest,
  type RecordSessionExpenseRequest,
  type SessionCashierSummary,
  type CloseSessionCashierRequest,
  type AcademyFinancialDashboardMetrics,
} from '@academy/shared';

@Injectable()
export class FinanceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /**
   * Retrieves active SaaS subscription details and feature entitlements for the current Academy.
   */
  async getTenantSubscription(tenantContext: TenantContext): Promise<TenantSubscriptionItem> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantContext.tenantId },
          include: {
            subscription: {
              include: { plan: true },
            },
          },
        });

        if (!tenant) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Academy not found',
          });
        }

        // If subscription hasn't been created yet, fallback to default active Starter
        let sub = tenant.subscription;
        if (!sub) {
          const starterPlan = await tx.saaSPlan.findFirst({
            where: { code: 'STARTER' },
          });

          sub = await tx.tenantSubscription.create({
            data: {
              tenantId: tenant.id,
              planCode: 'STARTER',
              status: 'ACTIVE',
              billingCycle: 'MONTHLY',
              renewalDate: new Date(Date.now() + 30 * 86400000),
            },
            include: { plan: true },
          });
        }

        const currentPrice = sub.negotiatedPrice ?? sub.plan.priceMonthly;

        return {
          id: sub.id,
          tenantId: sub.tenantId,
          tenantName: tenant.name,
          planCode: sub.planCode as any,
          planName: sub.plan.name,
          status: sub.status as any,
          billingCycle: sub.billingCycle as any,
          negotiatedPrice: sub.negotiatedPrice,
          currentPrice,
          currency: sub.currency,
          startDate: sub.startDate.toISOString(),
          renewalDate: sub.renewalDate.toISOString(),
          trialEndsAt: sub.trialEndsAt ? sub.trialEndsAt.toISOString() : null,
          graceEndsAt: sub.graceEndsAt ? sub.graceEndsAt.toISOString() : null,
          autoRenew: sub.autoRenew,
          maxBranches: sub.plan.maxBranches,
          maxPlayers: sub.plan.maxPlayers,
          maxCoaches: sub.plan.maxCoaches,
          features: (sub.plan.features as Record<string, unknown>) ?? {},
        };
      },
    );
  }

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

  /**
   * Lists player subscriptions with status, overdue balance, and player info.
   */
  async listPlayerSubscriptions(
    tenantContext: TenantContext,
    query?: { status?: string; search?: string; playerId?: string; limit?: number; offset?: number },
  ): Promise<PlayerSubscriptionItem[]> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const take = Math.min(query?.limit ?? 50, 100);
        const skip = query?.offset ?? 0;

        const where: Record<string, any> = { tenantId: tenantContext.tenantId };
        if (query?.status) {
          where.status = query.status;
        }
        if (query?.playerId) {
          where.playerId = query.playerId;
        }
        if (query?.search?.trim()) {
          const s = query.search.trim();
          where.player = {
            OR: [
              { firstName: { contains: s, mode: 'insensitive' } },
              { lastName: { contains: s, mode: 'insensitive' } },
            ],
          };
        }

        const subs = await tx.playerSubscription.findMany({
          where,
          take,
          skip,
          orderBy: { createdAt: 'desc' },
          include: {
            player: { select: { firstName: true, lastName: true } },
            plan: { select: { name: true } },
          },
        });

        return subs.map((s) => ({
          id: s.id,
          tenantId: s.tenantId,
          playerId: s.playerId,
          playerName: `${s.player.firstName} ${s.player.lastName}`,
          planId: s.planId,
          planName: s.plan?.name ?? null,
          status: s.status as any,
          startDate: s.startDate.toISOString().slice(0, 10),
          dueDate: s.dueDate.toISOString().slice(0, 10),
          renewalDate: s.renewalDate ? s.renewalDate.toISOString().slice(0, 10) : null,
          feeAmount: s.feeAmount,
          discountAmount: s.discountAmount,
          discountReason: s.discountReason,
          paidAmount: s.paidAmount,
          outstandingBalance: s.outstandingBalance,
          lastPaymentDate: s.lastPaymentDate ? s.lastPaymentDate.toISOString() : null,
          notes: s.notes,
        }));
      },
    );
  }

  /**
   * Retrieves single player's active subscription details.
   */
  async getPlayerSubscription(
    tenantContext: TenantContext,
    playerId: string,
  ): Promise<PlayerSubscriptionItem | null> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const sub = await tx.playerSubscription.findFirst({
          where: { tenantId: tenantContext.tenantId, playerId },
          orderBy: { createdAt: 'desc' },
          include: {
            player: { select: { firstName: true, lastName: true } },
            plan: { select: { name: true } },
          },
        });

        if (!sub) return null;

        return {
          id: sub.id,
          tenantId: sub.tenantId,
          playerId: sub.playerId,
          playerName: `${sub.player.firstName} ${sub.player.lastName}`,
          planId: sub.planId,
          planName: sub.plan?.name ?? null,
          status: sub.status as any,
          startDate: sub.startDate.toISOString().slice(0, 10),
          dueDate: sub.dueDate.toISOString().slice(0, 10),
          renewalDate: sub.renewalDate ? sub.renewalDate.toISOString().slice(0, 10) : null,
          feeAmount: sub.feeAmount,
          discountAmount: sub.discountAmount,
          discountReason: sub.discountReason,
          paidAmount: sub.paidAmount,
          outstandingBalance: sub.outstandingBalance,
          lastPaymentDate: sub.lastPaymentDate ? sub.lastPaymentDate.toISOString() : null,
          notes: sub.notes,
        };
      },
    );
  }

  /**
   * Enrolls a player in a subscription.
   */
  async createPlayerSubscription(
    tenantContext: TenantContext,
    dto: CreatePlayerSubscriptionRequest,
  ): Promise<PlayerSubscriptionItem> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const player = await tx.player.findUnique({
          where: { tenantId_id: { tenantId: tenantContext.tenantId, id: dto.playerId } },
        });

        if (!player) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Player not found in this academy',
          });
        }

        const netFee = Math.max(0, dto.feeAmount - (dto.discountAmount || 0));

        const sub = await tx.playerSubscription.create({
          data: {
            tenantId: tenantContext.tenantId,
            playerId: dto.playerId,
            planId: dto.planId,
            status: netFee === 0 ? 'ACTIVE' : 'OVERDUE',
            startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
            dueDate: new Date(dto.dueDate),
            renewalDate: new Date(dto.dueDate),
            feeAmount: dto.feeAmount,
            discountAmount: dto.discountAmount || 0,
            discountReason: dto.discountReason,
            paidAmount: 0,
            outstandingBalance: netFee,
            notes: dto.notes,
          },
          include: {
            player: { select: { firstName: true, lastName: true } },
            plan: { select: { name: true } },
          },
        });

        await this.auditService.logEvent({
          tenantId: tenantContext.tenantId,
          actorUserId: tenantContext.actorUserId,
          action: 'PLAYER_SUBSCRIPTION_ENROLLED',
          resourceType: 'PlayerSubscription',
          resourceId: sub.id,
          metadata: { playerId: dto.playerId, feeAmount: netFee },
        });

        return {
          id: sub.id,
          tenantId: sub.tenantId,
          playerId: sub.playerId,
          playerName: `${sub.player.firstName} ${sub.player.lastName}`,
          planId: sub.planId,
          planName: sub.plan?.name ?? null,
          status: sub.status as any,
          startDate: sub.startDate.toISOString().slice(0, 10),
          dueDate: sub.dueDate.toISOString().slice(0, 10),
          renewalDate: sub.renewalDate ? sub.renewalDate.toISOString().slice(0, 10) : null,
          feeAmount: sub.feeAmount,
          discountAmount: sub.discountAmount,
          discountReason: sub.discountReason,
          paidAmount: sub.paidAmount,
          outstandingBalance: sub.outstandingBalance,
          lastPaymentDate: null,
          notes: sub.notes,
        };
      },
    );
  }

  /**
   * Records a collected payment for a player (membership fee, partial installment, etc.).
   * Updates ledger and synchronizes player's subscription balance in a single atomic transaction.
   */
  async recordPayment(
    tenantContext: TenantContext,
    dto: RecordPlayerPaymentRequest,
  ): Promise<FinancialTransactionItem> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const player = await tx.player.findUnique({
          where: { tenantId_id: { tenantId: tenantContext.tenantId, id: dto.playerId } },
        });

        if (!player) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Player not found in this academy',
          });
        }

        const now = new Date();
        const year = now.getFullYear();
        const rand = Math.floor(1000 + Math.random() * 9000);
        const receiptNumber = dto.receiptNumber || `REC-${year}-${rand}`;

        // 1. Create financial transaction in ledger
        const transaction = await tx.academyFinancialTransaction.create({
          data: {
            tenantId: tenantContext.tenantId,
            branchId: dto.branchId,
            sessionId: dto.sessionId,
            playerId: dto.playerId,
            subscriptionId: dto.subscriptionId,
            recordedByUserId: tenantContext.actorUserId,
            type: 'MEMBERSHIP_FEE',
            amount: dto.amount,
            currency: 'SAR',
            paymentMethod: dto.paymentMethod as any,
            status: 'COMPLETED',
            receiptNumber,
            referenceNumber: dto.referenceNumber,
            notes: dto.notes,
          },
          include: {
            branch: { select: { name: true } },
            player: { select: { firstName: true, lastName: true } },
            recordedByUser: { select: { name: true } },
          },
        });

        // 2. Synchronize PlayerSubscription balance if subscription exists
        let sub = dto.subscriptionId
          ? await tx.playerSubscription.findUnique({ where: { id: dto.subscriptionId } })
          : await tx.playerSubscription.findFirst({
              where: { tenantId: tenantContext.tenantId, playerId: dto.playerId },
              orderBy: { createdAt: 'desc' },
            });

        if (sub) {
          const newPaidAmount = sub.paidAmount + dto.amount;
          const newOutstanding = Math.max(0, sub.outstandingBalance - dto.amount);
          const newStatus = newOutstanding <= 0 ? 'ACTIVE' : 'PARTIAL';

          await tx.playerSubscription.update({
            where: { id: sub.id },
            data: {
              paidAmount: newPaidAmount,
              outstandingBalance: newOutstanding,
              status: newStatus,
              lastPaymentDate: now,
            },
          });
        }

        await this.auditService.logEvent({
          tenantId: tenantContext.tenantId,
          actorUserId: tenantContext.actorUserId,
          action: 'FINANCIAL_PAYMENT_COLLECTED',
          resourceType: 'AcademyFinancialTransaction',
          resourceId: transaction.id,
          metadata: {
            playerId: dto.playerId,
            amount: dto.amount,
            paymentMethod: dto.paymentMethod,
            receiptNumber,
          },
        });

        return {
          id: transaction.id,
          tenantId: transaction.tenantId,
          branchId: transaction.branchId,
          branchName: transaction.branch.name,
          sessionId: transaction.sessionId,
          playerId: transaction.playerId,
          playerName: `${transaction.player?.firstName} ${transaction.player?.lastName}`,
          subscriptionId: transaction.subscriptionId,
          recordedByUserId: transaction.recordedByUserId,
          recordedByName: transaction.recordedByUser.name,
          type: transaction.type as any,
          amount: transaction.amount,
          currency: transaction.currency,
          paymentMethod: transaction.paymentMethod as any,
          status: transaction.status as any,
          receiptNumber: transaction.receiptNumber,
          referenceNumber: transaction.referenceNumber,
          notes: transaction.notes,
          reversalReason: null,
          reversedAt: null,
          createdAt: transaction.createdAt.toISOString(),
        };
      },
    );
  }

  /**
   * Reverses a financial transaction with mandatory audit reason (never silent deletion).
   */
  async reverseTransaction(
    tenantContext: TenantContext,
    transactionId: string,
    dto: ReverseTransactionRequest,
  ): Promise<FinancialTransactionItem> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const transaction = await tx.academyFinancialTransaction.findUnique({
          where: { tenantId_id: { tenantId: tenantContext.tenantId, id: transactionId } },
          include: {
            branch: { select: { name: true } },
            player: { select: { firstName: true, lastName: true } },
            recordedByUser: { select: { name: true } },
          },
        });

        if (!transaction) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Financial transaction not found',
          });
        }

        if (transaction.status === 'REVERSED') {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Transaction has already been reversed',
          });
        }

        const now = new Date();
        const updated = await tx.academyFinancialTransaction.update({
          where: { id: transactionId },
          data: {
            status: 'REVERSED',
            reversalReason: dto.reason,
            reversedAt: now,
            reversedByUserId: tenantContext.actorUserId,
          },
          include: {
            branch: { select: { name: true } },
            player: { select: { firstName: true, lastName: true } },
            recordedByUser: { select: { name: true } },
          },
        });

        // Re-adjust player subscription balance if this was a membership fee
        if (transaction.type === 'MEMBERSHIP_FEE' && transaction.subscriptionId) {
          const sub = await tx.playerSubscription.findUnique({
            where: { id: transaction.subscriptionId },
          });

          if (sub) {
            const reOutstanding = sub.outstandingBalance + transaction.amount;
            const rePaid = Math.max(0, sub.paidAmount - transaction.amount);
            const reStatus = reOutstanding > 0 ? (rePaid > 0 ? 'PARTIAL' : 'OVERDUE') : 'ACTIVE';

            await tx.playerSubscription.update({
              where: { id: sub.id },
              data: {
                paidAmount: rePaid,
                outstandingBalance: reOutstanding,
                status: reStatus,
              },
            });
          }
        }

        await this.auditService.logEvent({
          tenantId: tenantContext.tenantId,
          actorUserId: tenantContext.actorUserId,
          action: 'FINANCIAL_TRANSACTION_REVERSED',
          resourceType: 'AcademyFinancialTransaction',
          resourceId: transactionId,
          metadata: { reason: dto.reason, amount: transaction.amount },
        });

        return {
          id: updated.id,
          tenantId: updated.tenantId,
          branchId: updated.branchId,
          branchName: updated.branch.name,
          sessionId: updated.sessionId,
          playerId: updated.playerId,
          playerName: updated.player ? `${updated.player.firstName} ${updated.player.lastName}` : null,
          subscriptionId: updated.subscriptionId,
          recordedByUserId: updated.recordedByUserId,
          recordedByName: updated.recordedByUser.name,
          type: updated.type as any,
          amount: updated.amount,
          currency: updated.currency,
          paymentMethod: updated.paymentMethod as any,
          status: updated.status as any,
          receiptNumber: updated.receiptNumber,
          referenceNumber: updated.referenceNumber,
          notes: updated.notes,
          reversalReason: updated.reversalReason,
          reversedAt: updated.reversedAt ? updated.reversedAt.toISOString() : null,
          createdAt: updated.createdAt.toISOString(),
        };
      },
    );
  }

  /**
   * Records an operational expense during a training session (hydration, equipment, field fee).
   */
  async recordSessionExpense(
    tenantContext: TenantContext,
    sessionId: string,
    dto: RecordSessionExpenseRequest,
  ): Promise<FinancialTransactionItem> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const session = await tx.attendanceSession.findUnique({
          where: { tenantId_id: { tenantId: tenantContext.tenantId, id: sessionId } },
        });

        if (!session) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Attendance session not found',
          });
        }

        const now = new Date();
        const receiptNumber = dto.receiptNumber || `EXP-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const transaction = await tx.academyFinancialTransaction.create({
          data: {
            tenantId: tenantContext.tenantId,
            branchId: dto.branchId,
            sessionId,
            recordedByUserId: tenantContext.actorUserId,
            type: 'SESSION_EXPENSE',
            amount: dto.amount,
            currency: 'SAR',
            paymentMethod: dto.paymentMethod as any,
            status: 'COMPLETED',
            receiptNumber,
            notes: dto.notes,
          },
          include: {
            branch: { select: { name: true } },
            recordedByUser: { select: { name: true } },
          },
        });

        await this.auditService.logEvent({
          tenantId: tenantContext.tenantId,
          actorUserId: tenantContext.actorUserId,
          action: 'SESSION_EXPENSE_RECORDED',
          resourceType: 'AcademyFinancialTransaction',
          resourceId: transaction.id,
          metadata: { sessionId, amount: dto.amount, reason: dto.notes },
        });

        return {
          id: transaction.id,
          tenantId: transaction.tenantId,
          branchId: transaction.branchId,
          branchName: transaction.branch.name,
          sessionId: transaction.sessionId,
          playerId: null,
          playerName: null,
          subscriptionId: null,
          recordedByUserId: transaction.recordedByUserId,
          recordedByName: transaction.recordedByUser.name,
          type: transaction.type as any,
          amount: transaction.amount,
          currency: transaction.currency,
          paymentMethod: transaction.paymentMethod as any,
          status: transaction.status as any,
          receiptNumber: transaction.receiptNumber,
          referenceNumber: null,
          notes: transaction.notes,
          reversalReason: null,
          reversedAt: null,
          createdAt: transaction.createdAt.toISOString(),
        };
      },
    );
  }

  /**
   * Retrieves cashier reconciliation breakdown for a training session.
   */
  async getSessionCashierSummary(
    tenantContext: TenantContext,
    sessionId: string,
  ): Promise<SessionCashierSummary> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const session = await tx.attendanceSession.findUnique({
          where: { tenantId_id: { tenantId: tenantContext.tenantId, id: sessionId } },
          include: {
            branch: { select: { name: true } },
            records: true,
            cashierClosing: { include: { closedByUser: { select: { name: true } } } },
          },
        });

        if (!session) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Attendance session not found',
          });
        }

        // Transactions recorded for this session
        const transactions = await tx.academyFinancialTransaction.findMany({
          where: {
            tenantId: tenantContext.tenantId,
            sessionId,
            status: 'COMPLETED',
          },
          include: {
            branch: { select: { name: true } },
            player: { select: { firstName: true, lastName: true } },
            recordedByUser: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        const totalAttendees = session.records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
        const totalAbsent = session.records.filter((r) => r.status === 'ABSENT').length;
        const totalLate = session.records.filter((r) => r.status === 'LATE').length;

        // Player IDs in this session
        const playerIds = session.records.map((r) => r.playerId);
        const playerSubs = await tx.playerSubscription.findMany({
          where: {
            tenantId: tenantContext.tenantId,
            playerId: { in: playerIds },
          },
        });

        const totalActiveSubscribers = playerSubs.filter((s) => s.status === 'ACTIVE').length;
        const totalOverdueSubscribers = playerSubs.filter((s) => s.status === 'OVERDUE' || s.status === 'PARTIAL').length;

        let totalCashCollected = 0;
        let totalElectronicCollected = 0;
        let totalExpenses = 0;

        for (const t of transactions) {
          if (t.type === 'MEMBERSHIP_FEE' || t.type === 'REGISTRATION_FEE') {
            if (t.paymentMethod === 'CASH') {
              totalCashCollected += t.amount;
            } else {
              totalElectronicCollected += t.amount;
            }
          } else if (t.type === 'SESSION_EXPENSE') {
            totalExpenses += t.amount;
          }
        }

        const netCashMovement = totalCashCollected - totalExpenses;

        return {
          sessionId: session.id,
          branchId: session.branchId,
          groupName: session.groupName,
          sessionDate: session.sessionDate.toISOString().slice(0, 10),
          startTime: session.startTime,
          endTime: session.endTime,
          status: session.status,
          totalAttendees,
          totalAbsent,
          totalLate,
          totalActiveSubscribers,
          totalOverdueSubscribers,
          totalCashCollected,
          totalElectronicCollected,
          totalExpenses,
          netCashMovement,
          isReconciled: Boolean(session.cashierClosing?.isReconciled),
          reconciledAt: session.cashierClosing?.reconciledAt ? session.cashierClosing.reconciledAt.toISOString() : null,
          closedByUserName: session.cashierClosing?.closedByUser?.name ?? null,
          notes: session.cashierClosing?.notes ?? null,
          transactions: transactions.map((t) => ({
            id: t.id,
            tenantId: t.tenantId,
            branchId: t.branchId,
            branchName: t.branch.name,
            sessionId: t.sessionId,
            playerId: t.playerId,
            playerName: t.player ? `${t.player.firstName} ${t.player.lastName}` : null,
            subscriptionId: t.subscriptionId,
            recordedByUserId: t.recordedByUserId,
            recordedByName: t.recordedByUser.name,
            type: t.type as any,
            amount: t.amount,
            currency: t.currency,
            paymentMethod: t.paymentMethod as any,
            status: t.status as any,
            receiptNumber: t.receiptNumber,
            referenceNumber: t.referenceNumber,
            notes: t.notes,
            reversalReason: t.reversalReason,
            reversedAt: t.reversedAt ? t.reversedAt.toISOString() : null,
            createdAt: t.createdAt.toISOString(),
          })),
        };
      },
    );
  }

  /**
   * Reconciles and formally closes cashier for a training session.
   */
  async closeSessionCashier(
    tenantContext: TenantContext,
    sessionId: string,
    dto: CloseSessionCashierRequest,
  ): Promise<SessionCashierSummary> {
    const summary = await this.getSessionCashierSummary(tenantContext, sessionId);

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        await tx.sessionCashierClosing.upsert({
          where: { sessionId },
          create: {
            tenantId: tenantContext.tenantId,
            branchId: summary.branchId,
            sessionId,
            closedByUserId: tenantContext.actorUserId,
            totalAttendees: summary.totalAttendees,
            totalAbsent: summary.totalAbsent,
            totalLate: summary.totalLate,
            totalActiveSubscribers: summary.totalActiveSubscribers,
            totalOverdueSubscribers: summary.totalOverdueSubscribers,
            totalCashCollected: summary.totalCashCollected,
            totalElectronicCollected: summary.totalElectronicCollected,
            totalExpenses: summary.totalExpenses,
            netCashMovement: summary.netCashMovement,
            isReconciled: true,
            notes: dto.notes,
          },
          update: {
            closedByUserId: tenantContext.actorUserId,
            totalAttendees: summary.totalAttendees,
            totalAbsent: summary.totalAbsent,
            totalLate: summary.totalLate,
            totalActiveSubscribers: summary.totalActiveSubscribers,
            totalOverdueSubscribers: summary.totalOverdueSubscribers,
            totalCashCollected: summary.totalCashCollected,
            totalElectronicCollected: summary.totalElectronicCollected,
            totalExpenses: summary.totalExpenses,
            netCashMovement: summary.netCashMovement,
            isReconciled: true,
            notes: dto.notes,
            reconciledAt: new Date(),
          },
        });

        await this.auditService.logEvent({
          tenantId: tenantContext.tenantId,
          actorUserId: tenantContext.actorUserId,
          action: 'SESSION_CASHIER_RECONCILED',
          resourceType: 'SessionCashierClosing',
          resourceId: sessionId,
          metadata: {
            netCashMovement: summary.netCashMovement,
            totalCashCollected: summary.totalCashCollected,
            totalExpenses: summary.totalExpenses,
          },
        });

        return {
          ...summary,
          isReconciled: true,
          reconciledAt: new Date().toISOString(),
          notes: dto.notes ?? null,
        };
      },
    );
  }

  /**
   * Retrieves complete financial metrics for Academy management dashboard.
   */
  async getDashboardMetrics(
    tenantContext: TenantContext,
    branchId?: string,
  ): Promise<AcademyFinancialDashboardMetrics> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const where: Record<string, any> = {
          tenantId: tenantContext.tenantId,
          status: 'COMPLETED',
        };
        if (branchId) where.branchId = branchId;

        const transactions = await tx.academyFinancialTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            branch: { select: { name: true } },
            player: { select: { firstName: true, lastName: true } },
            recordedByUser: { select: { name: true } },
          },
        });

        let todayCollections = 0;
        let sessionCollections = 0;
        let monthlyRevenue = 0;
        let totalExpenses = 0;
        const branchRevenue: Record<string, number> = {};
        const expensesByCategory: Record<string, number> = {};
        const paymentMethodBreakdown: Record<string, number> = {
          CASH: 0,
          CARD: 0,
          BANK_TRANSFER: 0,
          POS: 0,
          ONLINE: 0,
        };

        for (const t of transactions) {
          const isRevenue = t.type === 'MEMBERSHIP_FEE' || t.type === 'REGISTRATION_FEE';
          const isExpense = t.type === 'SESSION_EXPENSE';

          if (isRevenue) {
            paymentMethodBreakdown[t.paymentMethod] =
              (paymentMethodBreakdown[t.paymentMethod] || 0) + t.amount;

            const bName = t.branch.name;
            branchRevenue[bName] = (branchRevenue[bName] || 0) + t.amount;

            if (t.createdAt >= startOfDay) {
              todayCollections += t.amount;
            }
            if (t.sessionId) {
              sessionCollections += t.amount;
            }
            if (t.createdAt >= startOfMonth) {
              monthlyRevenue += t.amount;
            }
          } else if (isExpense) {
            totalExpenses += t.amount;
            const category = 'تشغيل وتدريب';
            expensesByCategory[category] = (expensesByCategory[category] || 0) + t.amount;
          }
        }

        const playerSubs = await tx.playerSubscription.findMany({
          where: { tenantId: tenantContext.tenantId },
        });

        const outstandingPlayerBalances = playerSubs.reduce((acc, s) => acc + s.outstandingBalance, 0);
        const overdueSubscriptionsCount = playerSubs.filter(
          (s) => s.status === 'OVERDUE' || s.status === 'PARTIAL',
        ).length;

        const netCashMovement = monthlyRevenue - totalExpenses;

        return {
          todayCollections,
          sessionCollections,
          monthlyRevenue,
          outstandingPlayerBalances,
          overdueSubscriptionsCount,
          netCashMovement,
          branchRevenue,
          expensesByCategory,
          paymentMethodBreakdown,
          recentTransactions: transactions.slice(0, 15).map((t) => ({
            id: t.id,
            tenantId: t.tenantId,
            branchId: t.branchId,
            branchName: t.branch.name,
            sessionId: t.sessionId,
            playerId: t.playerId,
            playerName: t.player ? `${t.player.firstName} ${t.player.lastName}` : null,
            subscriptionId: t.subscriptionId,
            recordedByUserId: t.recordedByUserId,
            recordedByName: t.recordedByUser.name,
            type: t.type as any,
            amount: t.amount,
            currency: t.currency,
            paymentMethod: t.paymentMethod as any,
            status: t.status as any,
            receiptNumber: t.receiptNumber,
            referenceNumber: t.referenceNumber,
            notes: t.notes,
            reversalReason: t.reversalReason,
            reversedAt: t.reversedAt ? t.reversedAt.toISOString() : null,
            createdAt: t.createdAt.toISOString(),
          })),
        };
      },
    );
  }
}
