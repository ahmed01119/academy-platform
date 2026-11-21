import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentsService, toMinorUnits } from './payments.service';
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
