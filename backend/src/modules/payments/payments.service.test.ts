import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  nextRenewalDate,
  PaymentsService,
  platformCyclePrice,
  toMinorUnits,
} from './payments.service';
import { computePaymobTransactionHmac, PaymobClient, type PaymobSettings } from './paymob.client';

const settings: PaymobSettings = {
  apiBase: 'https://accept.example',
  checkoutBase: 'https://checkout.example',
  secretKey: 'sk',
  publicKey: 'pk',
  hmacSecret: 'hmac-secret',
  integrationIds: [1],
  currency: 'EGP',
};

const payment = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  purpose: 'PLAYER_SUBSCRIPTION',
  status: 'PENDING',
  payerUserId: '33333333-3333-4333-8333-333333333333',
  playerSubscriptionId: '44444444-4444-4444-8444-444444444444',
  amount: 450,
  currency: 'EGP',
};

function callback(over: Record<string, unknown> = {}) {
  const obj = {
    id: 5550001,
    pending: false,
    success: true,
    amount_cents: 45000,
    currency: 'EGP',
    order: { id: 987 },
    created_at: '2026-11-22T10:00:00',
    integration_id: 1,
    owner: 9,
    ...over,
  };
  return {
    body: { type: 'TRANSACTION', obj },
    hmac: computePaymobTransactionHmac(obj, settings.hmacSecret),
  };
}

describe('PaymentsService.handlePaymobCallback', () => {
  let tx: any;
  let finance: any;
  let service: PaymentsService;

  beforeEach(() => {
    tx = {
      onlinePayment: {
        findUnique: vi.fn().mockResolvedValue(payment),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
      playerSubscription: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: payment.playerSubscriptionId, playerId: 'p-1' }),
      },
      playerEnrollment: { findFirst: vi.fn().mockResolvedValue({ branchId: 'b-1' }) },
      branch: { findFirst: vi.fn() },
    };
    const prisma = {
      withPaymentWebhookTransaction: vi.fn((cb: any) => cb(tx)),
      withTenantTransaction: vi.fn((_o: any, cb: any) => cb(tx)),
    };
    finance = {
      recordPaymentInTx: vi
        .fn()
        .mockResolvedValue({ item: { id: 'tx-1' }, receipt: { to: 'g@example.com' } }),
      dispatchReceipt: vi.fn(),
    };
    const audit = { logEvent: vi.fn().mockResolvedValue(undefined) };
    service = new PaymentsService(
      prisma as any,
      finance,
      audit as any,
      new PaymobClient(settings, vi.fn()),
    );
  });

  it('refuses a callback whose signature does not match', async () => {
    const { body } = callback();
    await expect(service.handlePaymobCallback(body, 'deadbeef')).rejects.toMatchObject({
      status: 401,
    });
    expect(finance.recordPaymentInTx).not.toHaveBeenCalled();
  });

  it('finds the payment by the signed order id and records it once, with a receipt', async () => {
    const { body, hmac } = callback();
    await service.handlePaymobCallback(body, hmac);
    expect(tx.onlinePayment.findUnique).toHaveBeenCalledWith({ where: { providerOrderId: '987' } });
    expect(tx.onlinePayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: payment.id, status: 'PENDING' },
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
    expect(finance.recordPaymentInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ tenantId: payment.tenantId, actorUserId: payment.payerUserId }),
      expect.objectContaining({
        playerId: 'p-1',
        branchId: 'b-1',
        amount: 450,
        paymentMethod: 'ONLINE',
      }),
    );
    expect(tx.onlinePayment.update).toHaveBeenCalledWith({
      where: { id: payment.id },
      data: { transactionId: 'tx-1' },
    });
    expect(finance.dispatchReceipt).toHaveBeenCalledTimes(1);
  });

  it('does nothing the second time (callback retried by the provider)', async () => {
    tx.onlinePayment.updateMany.mockResolvedValue({ count: 0 });
    const { body, hmac } = callback();
    await service.handlePaymobCallback(body, hmac);
    expect(finance.recordPaymentInTx).not.toHaveBeenCalled();
    expect(finance.dispatchReceipt).not.toHaveBeenCalled();
  });

  it('ignores a signed callback whose amount does not match the payment', async () => {
    const { body, hmac } = callback({ amount_cents: 100 });
    await service.handlePaymobCallback(body, hmac);
    expect(tx.onlinePayment.updateMany).not.toHaveBeenCalled();
    expect(finance.recordPaymentInTx).not.toHaveBeenCalled();
  });

  it('ignores an order it does not know', async () => {
    tx.onlinePayment.findUnique.mockResolvedValue(null);
    const { body, hmac } = callback();
    await expect(service.handlePaymobCallback(body, hmac)).resolves.toEqual({ received: true });
    expect(finance.recordPaymentInTx).not.toHaveBeenCalled();
  });

  it('marks a declined payment as failed, without touching the ledger', async () => {
    const { body, hmac } = callback({ success: false, data: { message: 'Insufficient funds' } });
    await service.handlePaymobCallback(body, hmac);
    expect(tx.onlinePayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', failureReason: 'Insufficient funds' }),
      }),
    );
    expect(finance.recordPaymentInTx).not.toHaveBeenCalled();
  });

  it('waits while the transaction is still pending', async () => {
    const { body, hmac } = callback({ pending: true });
    await service.handlePaymobCallback(body, hmac);
    expect(tx.onlinePayment.updateMany).not.toHaveBeenCalled();
  });

  it('converts amounts to minor units without float drift', () => {
    expect(toMinorUnits(1299.99)).toBe(129999);
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
  });
});

describe('PaymentsService checkout start', () => {
  it('marks the payment failed and refuses to send the payer on if the order id cannot be stored', async () => {
    const updates: any[] = [];
    let call = 0;
    const tx = {
      onlinePayment: {
        update: vi.fn((args: any) => {
          updates.push(args);
          call += 1;
          if (call === 1) return Promise.reject(new Error('unique violation'));
          return Promise.resolve({});
        }),
      },
    };
    const prisma = {
      withPortalUserTransaction: vi.fn((_o: any, cb: any) => cb(tx)),
      withTenantTransaction: vi.fn((_o: any, cb: any) =>
        cb({
          tenant: { findUnique: vi.fn().mockResolvedValue({ name: 'Stars' }) },
          user: {
            findUnique: vi.fn().mockResolvedValue({ name: 'Ahmed', email: 'a@x', phone: '' }),
          },
          onlinePayment: { create: vi.fn().mockResolvedValue({ id: payment.id }) },
          tenantSubscription: {
            findUnique: vi.fn().mockResolvedValue({
              billingCycle: 'MONTHLY',
              negotiatedPrice: null,
              currency: 'EGP',
              status: 'ACTIVE',
              renewalDate: new Date('2026-12-18T00:00:00Z'),
              plan: { name: 'Pro', priceMonthly: 1299, priceYearly: 0 },
            }),
          },
        }),
      ),
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'pi', client_secret: 'cs', intention_order_id: 5 }), {
        status: 201,
      }),
    );
    const service = new PaymentsService(
      prisma as any,
      {} as any,
      { logEvent: vi.fn() } as any,
      new PaymobClient(settings, fetchMock as unknown as typeof fetch),
    );
    await expect(
      service.createPlatformSubscriptionPayment({
        tenantId: payment.tenantId,
        actorUserId: payment.payerUserId,
        locale: 'ar',
      } as any),
    ).rejects.toMatchObject({ status: 502 });
    expect(updates[1]).toMatchObject({
      where: { id: payment.id },
      data: { status: 'FAILED', failureReason: 'Could not record the provider order' },
    });
  });
});

describe('Platform subscription price and period', () => {
  const base = { negotiatedPrice: null, priceMonthly: 500, priceYearly: 0 };

  it('charges the monthly price times the months of the cycle', () => {
    expect(platformCyclePrice({ ...base, billingCycle: 'MONTHLY' })).toEqual({
      months: 1,
      amount: 500,
    });
    expect(platformCyclePrice({ ...base, billingCycle: 'QUARTERLY' })).toEqual({
      months: 3,
      amount: 1500,
    });
    expect(platformCyclePrice({ ...base, billingCycle: 'SEMIANNUAL' })).toEqual({
      months: 6,
      amount: 3000,
    });
    expect(platformCyclePrice({ ...base, billingCycle: 'ANNUAL' })).toEqual({
      months: 12,
      amount: 6000,
    });
  });

  it('uses the yearly list price for an annual cycle, and a negotiated price over the list', () => {
    expect(platformCyclePrice({ ...base, billingCycle: 'ANNUAL', priceYearly: 5000 })).toEqual({
      months: 12,
      amount: 5000,
    });
    expect(
      platformCyclePrice({
        billingCycle: 'ANNUAL',
        negotiatedPrice: 300,
        priceMonthly: 500,
        priceYearly: 5000,
      }),
    ).toEqual({ months: 12, amount: 3600 });
    expect(platformCyclePrice({ ...base, billingCycle: 'MONTHLY', negotiatedPrice: 0 })).toEqual({
      months: 1,
      amount: 0,
    });
  });

  it('renews from the later of today and the current renewal date', () => {
    const now = new Date('2026-11-22T10:00:00Z');
    expect(nextRenewalDate(new Date('2026-12-10T00:00:00Z'), 1, now).toISOString()).toBe(
      '2027-01-10T00:00:00.000Z',
    );
    expect(nextRenewalDate(new Date('2026-10-01T00:00:00Z'), 3, now).toISOString()).toBe(
      '2027-02-22T10:00:00.000Z',
    );
  });
});

describe('PaymentsService.handlePaymobCallback (platform subscription)', () => {
  const platformPayment = {
    ...payment,
    purpose: 'PLATFORM_SUBSCRIPTION',
    playerSubscriptionId: null,
    amount: 1500,
    billingMonths: 3,
  };
  let tx: any;
  let finance: any;
  let audit: any;
  let service: PaymentsService;

  beforeEach(() => {
    tx = {
      onlinePayment: {
        findUnique: vi.fn().mockResolvedValue(platformPayment),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ invoice_id: 'inv-1' }]),
    };
    const prisma = {
      withPaymentWebhookTransaction: vi.fn((cb: any) => cb(tx)),
      withTenantTransaction: vi.fn(),
    };
    finance = { recordPaymentInTx: vi.fn(), dispatchReceipt: vi.fn() };
    audit = { logEvent: vi.fn().mockResolvedValue(undefined) };
    service = new PaymentsService(
      prisma as any,
      finance,
      audit,
      new PaymobClient(settings, vi.fn()),
    );
  });

  it('marks it paid and renews through the definer function, in the webhook transaction', async () => {
    const { body, hmac } = callback({ amount_cents: 150000 });
    await service.handlePaymobCallback(body, hmac);
    expect(tx.onlinePayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: payment.id, status: 'PENDING' },
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toContain(
      'fulfil_platform_subscription_payment',
    );
    expect(finance.recordPaymentInTx).not.toHaveBeenCalled();
    expect(audit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PLATFORM_SUBSCRIPTION_PAID_ONLINE' }),
    );
  });

  it('renews only once when the provider repeats the callback', async () => {
    tx.onlinePayment.updateMany.mockResolvedValue({ count: 0 });
    const { body, hmac } = callback({ amount_cents: 150000 });
    await service.handlePaymobCallback(body, hmac);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(audit.logEvent).not.toHaveBeenCalled();
  });

  it('does not renew when the signed amount differs from the stored one', async () => {
    const { body, hmac } = callback({ amount_cents: 50000 });
    await service.handlePaymobCallback(body, hmac);
    expect(tx.onlinePayment.updateMany).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
