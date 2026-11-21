import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ErrorCode,
  type CreateOnlinePaymentResponse,
  type OnlinePaymentStatusResponse,
  type PaymentDueItem,
  type TenantContext,
} from '@academy/shared';
import { PrismaService } from '../database/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { AuditService } from '../audit/audit.service';
import { money } from '../../common/money';
import { PaymobError, type PaymobClient } from './paymob.client';

export const PAYMOB_CLIENT = Symbol('PAYMOB_CLIENT');

/** Amount in the minor unit (piasters), from a 2-decimal amount. */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

function appUrl(): string {
  return (
    process.env.APP_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

interface PaymobTransactionCallback {
  type?: string;
  obj?: {
    id?: number | string;
    success?: boolean;
    pending?: boolean;
    amount_cents?: number;
    currency?: string;
    order?: { id?: number | string } | number | string;
    data?: { message?: string };
  };
  hmac?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinanceService) private readonly finance: FinanceService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PAYMOB_CLIENT) private readonly paymob: PaymobClient,
  ) {}

  /** Subscription balances the signed-in player or guardian can pay (their own and their children's). */
  async listDues(userId: string): Promise<PaymentDueItem[]> {
    return this.prisma.withPortalUserTransaction({ actorUserId: userId }, async (tx) => {
      const playerIds = await this.payablePlayerIds(tx, userId);
      if (playerIds.length === 0) return [];
      const subs = await tx.playerSubscription.findMany({
        where: {
          playerId: { in: playerIds },
          outstandingBalance: { gt: 0 },
          status: { notIn: ['EXEMPT', 'PAUSED', 'EXPIRED'] },
          tenant: { status: 'ACTIVE' }, // K3: nothing is payable to a suspended academy
        },
        include: {
          tenant: { select: { name: true, currency: true } },
          player: { select: { firstName: true, lastName: true } },
          plan: { select: { name: true } },
        },
        orderBy: { dueDate: 'asc' },
      });
      return subs.map((s) => ({
        subscriptionId: s.id,
        tenantId: s.tenantId,
        academyName: s.tenant.name,
        playerId: s.playerId,
        playerName: `${s.player.firstName} ${s.player.lastName}`.trim(),
        planName: s.plan?.name ?? null,
        dueDate: s.dueDate.toISOString().slice(0, 10),
        outstandingBalance: money(s.outstandingBalance),
        currency: s.tenant.currency,
        canPayOnline:
          this.paymob.isConfigured && this.paymob.currency === s.tenant.currency.toUpperCase(),
      }));
    });
  }

  /** Starts an online payment of a subscription's whole outstanding balance and returns the checkout page. */
  async createPlayerSubscriptionPayment(
    userId: string,
    subscriptionId: string,
  ): Promise<CreateOnlinePaymentResponse> {
    if (!this.paymob.isConfigured) {
      throw new ServiceUnavailableException({
        code: 'ONLINE_PAYMENT_UNAVAILABLE',
        message: 'الدفع الإلكتروني غير متاح حالياً (Online payment is not available yet)',
      });
    }

    const prepared = await this.prisma.withPortalUserTransaction(
      { actorUserId: userId },
      async (tx) => {
        const playerIds = await this.payablePlayerIds(tx, userId);
        const sub = await tx.playerSubscription.findUnique({
          where: { id: subscriptionId },
          include: {
            tenant: { select: { name: true, currency: true, status: true } },
            player: { select: { firstName: true, lastName: true } },
            plan: { select: { name: true } },
          },
        });
        if (!sub || !playerIds.includes(sub.playerId)) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Subscription not found',
          });
        }
        if (sub.tenant.status !== 'ACTIVE') {
          throw new ForbiddenException({
            code: 'ACADEMY_SUSPENDED',
            message: 'This academy is currently suspended by the platform',
          });
        }
        const amount = money(sub.outstandingBalance);
        if (amount <= 0) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Nothing is due on this subscription',
          });
        }
        const currency = sub.tenant.currency.toUpperCase();
        if (currency !== this.paymob.currency) {
          throw new BadRequestException({
            code: 'CURRENCY_NOT_SUPPORTED',
            message: `Online payment is available in ${this.paymob.currency} only`,
          });
        }
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true, phone: true },
        });
        const payment = await tx.onlinePayment.create({
          data: {
            tenantId: sub.tenantId,
            purpose: 'PLAYER_SUBSCRIPTION',
            payerUserId: userId,
            playerSubscriptionId: sub.id,
            amount,
            currency,
          },
        });
        return { payment, sub, user, amount, currency };
      },
    );

    const [firstName, ...rest] = (prepared.user?.name ?? '').trim().split(/\s+/);
    let intention;
    try {
      intention = await this.paymob.createIntention({
        amountCents: toMinorUnits(prepared.amount),
        currency: prepared.currency,
        specialReference: prepared.payment.id,
        itemName: `${prepared.sub.plan?.name ?? 'Subscription'} - ${prepared.sub.player.firstName}`,
        billing: {
          firstName: firstName ?? '',
          lastName: rest.join(' '),
          email: prepared.user?.email ?? '',
          phone: prepared.user?.phone ?? '',
        },
        notificationUrl: `${appUrl()}/v1/payments/paymob/webhook`,
        redirectionUrl: `${appUrl()}/payments/result?payment=${prepared.payment.id}`,
        extras: { paymentId: prepared.payment.id },
      });
    } catch (err) {
      this.logger.error(
        `Paymob intention for payment ${prepared.payment.id} failed: ${(err as Error).message}`,
      );
      await this.prisma.withPortalUserTransaction({ actorUserId: userId }, (tx) =>
        tx.onlinePayment.update({
          where: { id: prepared.payment.id },
          data: {
            status: 'FAILED',
            failureReason: 'Could not start the payment with the provider',
          },
        }),
      );
      throw new BadGatewayException({
        code: 'PAYMENT_PROVIDER_ERROR',
        message:
          'تعذر بدء الدفع الآن، حاول مرة أخرى بعد قليل (Could not start the payment, please try again)',
      });
    }

    await this.prisma.withPortalUserTransaction({ actorUserId: userId }, (tx) =>
      tx.onlinePayment.update({
        where: { id: prepared.payment.id },
        data: { providerOrderId: intention.orderId, providerIntentionId: intention.intentionId },
      }),
    );
    return {
      paymentId: prepared.payment.id,
      checkoutUrl: this.paymob.checkoutUrl(intention.clientSecret),
    };
  }

  /** The payer's view of one payment (the result page after the checkout). */
  async getPaymentStatus(userId: string, paymentId: string): Promise<OnlinePaymentStatusResponse> {
    return this.prisma.withPortalUserTransaction({ actorUserId: userId }, async (tx) => {
      const p = await tx.onlinePayment.findFirst({
        where: { id: paymentId, payerUserId: userId },
        include: { tenant: { select: { name: true } } },
      });
      if (!p)
        throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Payment not found' });
      let playerName: string | null = null;
      let receiptNumber: string | null = null;
      if (p.playerSubscriptionId) {
        const sub = await tx.playerSubscription.findUnique({
          where: { id: p.playerSubscriptionId },
          include: { player: { select: { firstName: true, lastName: true } } },
        });
        playerName = sub ? `${sub.player.firstName} ${sub.player.lastName}`.trim() : null;
      }
      if (p.transactionId) {
        const t = await tx.academyFinancialTransaction.findUnique({
          where: { id: p.transactionId },
          select: { receiptNumber: true },
        });
        receiptNumber = t?.receiptNumber ?? null;
      }
      return {
        id: p.id,
        status: p.status,
        amount: money(p.amount),
        currency: p.currency,
        academyName: p.tenant.name,
        playerName,
        receiptNumber,
        paidAt: p.paidAt?.toISOString() ?? null,
      };
    });
  }

  /**
   * Paymob's transaction-processed callback. Trust comes only from the HMAC, and the HMAC covers Paymob's order id and
   * the amount but not our reference, so the payment is found by the order id we stored when the checkout started and
   * the amount and currency must match. Marking the payment paid and recording it in the academy's ledger happen in one
   * transaction, guarded by status = PENDING, so a repeated callback changes nothing.
   */
  async handlePaymobCallback(
    body: PaymobTransactionCallback,
    queryHmac: string | undefined,
  ): Promise<{ received: true }> {
    if (!this.paymob.isConfigured) {
      throw new ServiceUnavailableException({
        code: 'ONLINE_PAYMENT_UNAVAILABLE',
        message: 'Online payment is not configured',
      });
    }
    const hmac = queryHmac || body?.hmac;
    if (!this.paymob.verifyTransactionCallback(body?.obj, hmac)) {
      this.logger.warn('Paymob callback rejected: invalid HMAC');
      throw new UnauthorizedException({ code: 'INVALID_SIGNATURE', message: 'Invalid signature' });
    }
    if (body.type && body.type !== 'TRANSACTION') return { received: true };
    const obj = body.obj!;
    const orderRef = typeof obj.order === 'object' && obj.order !== null ? obj.order.id : obj.order;
    if (orderRef === undefined || orderRef === null) return { received: true };
    const orderId = String(orderRef);

    const payment = await this.prisma.withPaymentWebhookTransaction((tx) =>
      tx.onlinePayment.findUnique({ where: { providerOrderId: orderId } }),
    );
    if (!payment) {
      this.logger.warn(`Paymob callback for unknown order ${orderId}`);
      return { received: true };
    }
    if (
      Number(obj.amount_cents) !== toMinorUnits(money(payment.amount)) ||
      String(obj.currency ?? '').toUpperCase() !== payment.currency.toUpperCase()
    ) {
      this.logger.error(
        `Paymob callback for payment ${payment.id}: amount or currency does not match; ignored`,
      );
      return { received: true };
    }
    if (obj.pending) return { received: true };

    if (!obj.success) {
      await this.prisma.withPaymentWebhookTransaction((tx) =>
        tx.onlinePayment.updateMany({
          where: { id: payment.id, status: 'PENDING' },
          data: {
            status: 'FAILED',
            providerTransactionId: String(obj.id ?? ''),
            failureReason: (obj.data?.message ?? 'Declined').slice(0, 250),
          },
        }),
      );
      return { received: true };
    }

    if (payment.purpose !== 'PLAYER_SUBSCRIPTION' || !payment.playerSubscriptionId) {
      // Platform subscriptions are phase B; never mark something paid that nothing fulfils.
      this.logger.error(
        `Paymob callback for payment ${payment.id} of purpose ${payment.purpose}: not handled yet`,
      );
      return { received: true };
    }

    // The payer is the actor of the ledger entry (an online payment has no desk clerk).
    const ctx: TenantContext = {
      tenantId: payment.tenantId,
      actorUserId: payment.payerUserId,
      locale: 'ar',
    };
    const receipt = await this.prisma.withTenantTransaction(
      { tenantId: payment.tenantId, actorUserId: payment.payerUserId },
      async (tx) => {
        const claimed = await tx.onlinePayment.updateMany({
          where: { id: payment.id, status: 'PENDING' },
          data: { status: 'PAID', paidAt: new Date(), providerTransactionId: String(obj.id ?? '') },
        });
        if (claimed.count === 0) return null; // already processed

        const sub = await tx.playerSubscription.findUnique({
          where: { id: payment.playerSubscriptionId! },
        });
        if (!sub)
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Subscription not found',
          });
        const enrollment = await tx.playerEnrollment.findFirst({
          where: { tenantId: payment.tenantId, playerId: sub.playerId, status: 'ACTIVE' },
          orderBy: { startDate: 'desc' },
          select: { branchId: true },
        });
        const branchId =
          enrollment?.branchId ??
          (
            await tx.branch.findFirst({
              where: { tenantId: payment.tenantId },
              orderBy: { createdAt: 'asc' },
              select: { id: true },
            })
          )?.id;
        if (!branchId)
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Academy has no branch',
          });

        const { item, receipt } = await this.finance.recordPaymentInTx(tx, ctx, {
          playerId: sub.playerId,
          subscriptionId: sub.id,
          branchId,
          amount: money(payment.amount),
          paymentMethod: 'ONLINE',
          referenceNumber: `PAYMOB-${obj.id ?? orderId}`,
          notes: 'دفع إلكتروني عبر Paymob',
        });
        await tx.onlinePayment.update({
          where: { id: payment.id },
          data: { transactionId: item.id },
        });
        return receipt;
      },
    );
    if (receipt) this.finance.dispatchReceipt(receipt);
    await this.audit
      .logEvent({
        tenantId: payment.tenantId,
        actorUserId: payment.payerUserId,
        action: 'ONLINE_PAYMENT_CONFIRMED',
        resourceType: 'OnlinePayment',
        resourceId: payment.id,
        metadata: {
          provider: 'PAYMOB',
          orderId,
          amount: money(payment.amount),
          currency: payment.currency,
        },
      })
      .catch(() => undefined);
    return { received: true };
  }

  /** Players the user may pay for: their own player profile and the children they are guardian of. */
  private async payablePlayerIds(
    tx: Parameters<Parameters<PrismaService['withPortalUserTransaction']>[1]>[0],
    userId: string,
  ): Promise<string[]> {
    const [own, guarded] = await Promise.all([
      tx.player.findMany({ where: { userId }, select: { id: true } }),
      tx.guardian.findMany({ where: { userId }, select: { playerId: true } }),
    ]);
    return [...new Set([...own.map((p) => p.id), ...guarded.map((g) => g.playerId)])];
  }
}

export { PaymobError };
