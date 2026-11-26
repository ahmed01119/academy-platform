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
  SAAS_BILLING_CYCLE_MONTHS,
  type CreateOnlinePaymentResponse,
  type OnlinePaymentStatusResponse,
  type PaymentDueItem,
  type PlatformSubscriptionQuote,
  type SaaSBillingCycleCode,
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

/**
 * The price of one billing cycle of an academy's platform subscription. Prices are monthly across the platform (the
 * negotiated price and the plan's monthly price are what the console shows as MRR), so a cycle costs the monthly price
 * times its months; an annual cycle on the list price uses the plan's yearly price when one is set.
 */
export function platformCyclePrice(input: {
  billingCycle: SaaSBillingCycleCode;
  negotiatedPrice: number | null;
  priceMonthly: number;
  priceYearly: number;
}): { months: number; amount: number } {
  const months = SAAS_BILLING_CYCLE_MONTHS[input.billingCycle] ?? 1;
  if (input.billingCycle === 'ANNUAL' && input.negotiatedPrice === null && input.priceYearly > 0) {
    return { months, amount: money(input.priceYearly) };
  }
  const monthly = input.negotiatedPrice ?? input.priceMonthly;
  return { months, amount: money(monthly * months) };
}

/** The renewal date after paying `months`: counted from the later of today and the current renewal date. */
export function nextRenewalDate(renewalDate: Date, months: number, now = new Date()): Date {
  const next = new Date(Math.max(renewalDate.getTime(), now.getTime()));
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

interface CheckoutUser {
  name: string | null;
  email: string | null;
  phone: string | null;
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
    this.assertConfigured();

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

    return this.openCheckout(userId, prepared.payment.id, {
      amount: prepared.amount,
      currency: prepared.currency,
      itemName: `${prepared.sub.plan?.name ?? 'Subscription'} - ${prepared.sub.player.firstName}`,
      user: prepared.user,
    });
  }

  /** What renewing the academy's platform subscription online costs now (owner's finance page). */
  async getPlatformSubscriptionQuote(
    tenantContext: TenantContext,
  ): Promise<PlatformSubscriptionQuote> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const sub = await tx.tenantSubscription.findUnique({
          where: { tenantId: tenantContext.tenantId },
          include: { plan: true },
        });
        if (!sub) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'This academy has no platform subscription yet',
          });
        }
        const cycle = sub.billingCycle as SaaSBillingCycleCode;
        const { months, amount } = platformCyclePrice({
          billingCycle: cycle,
          negotiatedPrice: sub.negotiatedPrice === null ? null : money(sub.negotiatedPrice),
          priceMonthly: money(sub.plan.priceMonthly),
          priceYearly: money(sub.plan.priceYearly),
        });
        const currency = sub.currency.toUpperCase();
        return {
          planName: sub.plan.name,
          status: sub.status,
          billingCycle: cycle,
          months,
          amount,
          currency,
          renewalDate: sub.renewalDate.toISOString(),
          nextRenewalDate: nextRenewalDate(sub.renewalDate, months).toISOString(),
          canPayOnline: this.paymob.isConfigured && amount > 0 && currency === this.paymob.currency,
        };
      },
    );
  }

  /** Starts the online payment of one billing cycle of the academy's platform subscription (academy owner). */
  async createPlatformSubscriptionPayment(
    tenantContext: TenantContext,
  ): Promise<CreateOnlinePaymentResponse> {
    this.assertConfigured();
    const quote = await this.getPlatformSubscriptionQuote(tenantContext);
    if (quote.amount <= 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'There is nothing to pay on this subscription',
      });
    }
    if (quote.currency !== this.paymob.currency) {
      throw new BadRequestException({
        code: 'CURRENCY_NOT_SUPPORTED',
        message: `Online payment is available in ${this.paymob.currency} only`,
      });
    }
    const userId = tenantContext.actorUserId;
    const prepared = await this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: userId },
      async (tx) => {
        const [tenant, user] = await Promise.all([
          tx.tenant.findUnique({ where: { id: tenantContext.tenantId }, select: { name: true } }),
          tx.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true, phone: true },
          }),
        ]);
        const payment = await tx.onlinePayment.create({
          data: {
            tenantId: tenantContext.tenantId,
            purpose: 'PLATFORM_SUBSCRIPTION',
            payerUserId: userId,
            amount: quote.amount,
            currency: quote.currency,
            billingMonths: quote.months,
          },
        });
        return { payment, tenantName: tenant?.name ?? '', user };
      },
    );
    return this.openCheckout(userId, prepared.payment.id, {
      amount: quote.amount,
      currency: quote.currency,
      itemName:
        `Sportexus ${quote.planName} - ${quote.months} month(s) - ${prepared.tenantName}`.slice(
          0,
          250,
        ),
      user: prepared.user,
    });
  }

  /** The payer's view of one payment (the result page after the checkout). */
  async getPaymentStatus(userId: string, paymentId: string): Promise<OnlinePaymentStatusResponse> {
    const base = await this.prisma.withPortalUserTransaction(
      { actorUserId: userId },
      async (tx) => {
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
          purpose: p.purpose,
          status: p.status,
          amount: money(p.amount),
          currency: p.currency,
          academyName: p.tenant.name,
          playerName,
          receiptNumber,
          paidAt: p.paidAt?.toISOString() ?? null,
          tenantId: p.tenantId,
          saasInvoiceId: p.saasInvoiceId,
        };
      },
    );
    const { tenantId, saasInvoiceId, ...result } = base;
    if (result.purpose !== 'PLATFORM_SUBSCRIPTION') return result;
    // Platform invoices and the academy's subscription are readable in the academy's own context only.
    const extra = await this.prisma.withTenantTransaction(
      { tenantId, actorUserId: userId },
      async (tx) => {
        const [invoice, sub] = await Promise.all([
          saasInvoiceId
            ? tx.saaSInvoice.findUnique({
                where: { id: saasInvoiceId },
                select: { invoiceNumber: true },
              })
            : null,
          tx.tenantSubscription.findUnique({ where: { tenantId }, select: { renewalDate: true } }),
        ]);
        return {
          invoiceNumber: invoice?.invoiceNumber ?? null,
          renewalDate: sub?.renewalDate.toISOString() ?? null,
        };
      },
    );
    return { ...result, ...extra };
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

    if (payment.purpose === 'PLATFORM_SUBSCRIPTION') {
      await this.fulfilPlatformSubscription(payment, orderId, String(obj.id ?? ''));
      return { received: true };
    }
    if (!payment.playerSubscriptionId) {
      this.logger.error(`Paymob callback for payment ${payment.id}: no subscription to credit`);
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

  /**
   * Marks a platform-subscription payment paid and renews the academy's subscription, in one transaction: the renewal
   * and the paid invoice are written by the definer function fulfil_platform_subscription_payment, which acts only on
   * a PAID payment of that purpose and only in the webhook context (platform tables are not writable otherwise).
   */
  private async fulfilPlatformSubscription(
    payment: {
      id: string;
      tenantId: string;
      payerUserId: string;
      amount: unknown;
      currency: string;
    },
    orderId: string,
    providerTransactionId: string,
  ): Promise<void> {
    const invoiceId = await this.prisma.withPaymentWebhookTransaction(async (tx) => {
      const claimed = await tx.onlinePayment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date(), providerTransactionId },
      });
      if (claimed.count === 0) return null; // already processed
      const rows = await tx.$queryRaw<Array<{ invoice_id: string }>>`
        SELECT public.fulfil_platform_subscription_payment(${payment.id}::uuid)::text AS invoice_id`;
      return rows[0]?.invoice_id ?? null;
    });
    if (!invoiceId) return;
    await this.audit
      .logEvent({
        tenantId: payment.tenantId,
        actorUserId: payment.payerUserId,
        action: 'PLATFORM_SUBSCRIPTION_PAID_ONLINE',
        resourceType: 'OnlinePayment',
        resourceId: payment.id,
        metadata: {
          provider: 'PAYMOB',
          orderId,
          invoiceId,
          amount: money(payment.amount as number),
          currency: payment.currency,
        },
      })
      .catch(() => undefined);
  }

  /** Sends the payer to the provider's checkout for a payment row already created as PENDING. */
  private async openCheckout(
    userId: string,
    paymentId: string,
    input: { amount: number; currency: string; itemName: string; user: CheckoutUser | null },
  ): Promise<CreateOnlinePaymentResponse> {
    const [firstName, ...rest] = (input.user?.name ?? '').trim().split(/\s+/);
    let intention: Awaited<ReturnType<PaymobClient['createIntention']>>;
    try {
      intention = await this.paymob.createIntention({
        amountCents: toMinorUnits(input.amount),
        currency: input.currency,
        specialReference: paymentId,
        itemName: input.itemName,
        billing: {
          firstName: firstName ?? '',
          lastName: rest.join(' '),
          email: input.user?.email ?? '',
          phone: input.user?.phone ?? '',
        },
        notificationUrl: `${appUrl()}/v1/payments/paymob/webhook`,
        redirectionUrl: `${appUrl()}/payments/result?payment=${paymentId}`,
        extras: { paymentId },
      });
    } catch (err) {
      this.logger.error(
        `Paymob intention for payment ${paymentId} failed: ${(err as Error).message}`,
      );
      return this.abandonCheckout(
        userId,
        paymentId,
        'Could not start the payment with the provider',
      );
    }

    try {
      await this.prisma.withPortalUserTransaction({ actorUserId: userId }, (tx) =>
        tx.onlinePayment.update({
          where: { id: paymentId },
          data: { providerOrderId: intention.orderId, providerIntentionId: intention.intentionId },
        }),
      );
    } catch (err) {
      // Without the stored order id no confirmation could ever match this payment: never send the payer to pay it.
      this.logger.error(
        `Could not store Paymob order ${intention.orderId} for payment ${paymentId}: ${(err as Error).message}`,
      );
      return this.abandonCheckout(userId, paymentId, 'Could not record the provider order');
    }
    return { paymentId, checkoutUrl: this.paymob.checkoutUrl(intention.clientSecret) };
  }

  /** Marks a checkout that could not be opened as FAILED (best effort) and tells the payer to retry. */
  private async abandonCheckout(userId: string, paymentId: string, reason: string): Promise<never> {
    await this.prisma
      .withPortalUserTransaction({ actorUserId: userId }, (tx) =>
        tx.onlinePayment.update({
          where: { id: paymentId },
          data: { status: 'FAILED', failureReason: reason },
        }),
      )
      .catch((e: Error) =>
        this.logger.error(`Could not mark payment ${paymentId} as failed: ${e.message}`),
      );
    throw new BadGatewayException({
      code: 'PAYMENT_PROVIDER_ERROR',
      message:
        'تعذر بدء الدفع الآن، حاول مرة أخرى بعد قليل (Could not start the payment, please try again)',
    });
  }

  private assertConfigured(): void {
    if (!this.paymob.isConfigured) {
      throw new ServiceUnavailableException({
        code: 'ONLINE_PAYMENT_UNAVAILABLE',
        message: 'الدفع الإلكتروني غير متاح حالياً (Online payment is not available yet)',
      });
    }
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
