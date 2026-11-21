import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  computePaymobTransactionHmac,
  PaymobClient,
  readPaymobSettings,
  type PaymobSettings,
} from './paymob.client';

const settings: PaymobSettings = {
  apiBase: 'https://accept.example',
  checkoutBase: 'https://checkout.example',
  secretKey: 'sk_test_secret',
  publicKey: 'pk_test_public',
  hmacSecret: 'hmac-test-secret',
  integrationIds: [111, 222],
  currency: 'EGP',
};

// The sample transaction from Paymob's "HMAC Transaction Callback" page (values only).
const sampleObj = {
  id: 192036465,
  pending: false,
  amount_cents: 100000,
  success: true,
  is_auth: false,
  is_capture: false,
  is_standalone_payment: true,
  is_voided: false,
  is_refunded: false,
  is_3d_secure: true,
  integration_id: 4097558,
  has_parent_transaction: false,
  order: { id: 217503754, merchant_order_id: null },
  created_at: '2024-06-13T11:33:44.592345',
  currency: 'EGP',
  source_data: { pan: '2346', type: 'card', sub_type: 'MasterCard' },
  owner: 302852,
  error_occured: false,
};

describe('Paymob HMAC (transaction callback)', () => {
  it('concatenates the 20 documented fields in order', () => {
    const message =
      '1000002024-06-13T11:33:44.592345EGPfalsefalse1920364654097558truefalsefalsefalsetruefalse217503754302852false2346MasterCardcardtrue';
    const expected = createHmac('sha512', 'k').update(message).digest('hex');
    expect(computePaymobTransactionHmac(sampleObj, 'k')).toBe(expected);
  });

  it('accepts the genuine signature (any letter case) and refuses tampered payloads', () => {
    const client = new PaymobClient(settings, vi.fn());
    const hmac = computePaymobTransactionHmac(sampleObj, settings.hmacSecret);
    expect(client.verifyTransactionCallback(sampleObj, hmac)).toBe(true);
    expect(client.verifyTransactionCallback(sampleObj, hmac.toUpperCase())).toBe(true);
    expect(client.verifyTransactionCallback({ ...sampleObj, amount_cents: 1 }, hmac)).toBe(false);
    expect(client.verifyTransactionCallback({ ...sampleObj, success: false }, hmac)).toBe(false);
    expect(client.verifyTransactionCallback({ ...sampleObj, order: { id: 1 } }, hmac)).toBe(false);
    expect(client.verifyTransactionCallback(sampleObj, undefined)).toBe(false);
    expect(client.verifyTransactionCallback(sampleObj, 'abc')).toBe(false);
  });
});

describe('Paymob settings', () => {
  it('is off unless secret, public key, HMAC secret and integration ids are all set', () => {
    expect(readPaymobSettings({})).toBeNull();
    expect(
      readPaymobSettings({
        PAYMOB_SECRET_KEY: 'a',
        PAYMOB_PUBLIC_KEY: 'b',
        PAYMOB_HMAC_SECRET: 'c',
      }),
    ).toBeNull();
    const s = readPaymobSettings({
      PAYMOB_SECRET_KEY: 'a',
      PAYMOB_PUBLIC_KEY: 'b',
      PAYMOB_HMAC_SECRET: 'c',
      PAYMOB_INTEGRATION_IDS: '12, x, 34',
    });
    expect(s?.integrationIds).toEqual([12, 34]);
    expect(s?.apiBase).toBe('https://accept.paymob.com');
    expect(s?.checkoutBase).toBe('https://eg.checkout.paymob.com');
    expect(s?.currency).toBe('EGP');
  });
});

describe('Paymob intention', () => {
  it('sends the documented body and returns order id, intention id and client secret', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: 'pi_1', client_secret: 'cs_1', intention_order_id: 987 }),
          { status: 201 },
        ),
      );
    const client = new PaymobClient(settings, fetchMock as unknown as typeof fetch);
    const out = await client.createIntention({
      amountCents: 45000,
      currency: 'EGP',
      specialReference: 'pay-1',
      itemName: 'Monthly - Adam',
      billing: { firstName: 'Hany', lastName: '', email: 'h@example.com', phone: '' },
      notificationUrl: 'https://app/v1/payments/paymob/webhook',
      redirectionUrl: 'https://app/payments/result?payment=pay-1',
    });
    expect(out).toEqual({ intentionId: 'pi_1', orderId: '987', clientSecret: 'cs_1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://accept.example/v1/intention/');
    expect(init.headers.Authorization).toBe('Token sk_test_secret');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      amount: 45000,
      currency: 'EGP',
      payment_methods: [111, 222],
      special_reference: 'pay-1',
      items: [{ name: 'Monthly - Adam', amount: 45000, quantity: 1 }],
      billing_data: {
        first_name: 'Hany',
        last_name: 'NA',
        email: 'h@example.com',
        phone_number: 'NA',
      },
    });
    expect(client.checkoutUrl('cs_1')).toBe(
      'https://checkout.example/?publicKey=pk_test_public&clientSecret=cs_1',
    );
  });

  it('fails without leaking the provider body to callers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"detail":"bad integration"}', { status: 404 }));
    const client = new PaymobClient(settings, fetchMock as unknown as typeof fetch);
    await expect(
      client.createIntention({
        amountCents: 1,
        currency: 'EGP',
        specialReference: 'x',
        itemName: 'x',
        billing: { firstName: '', lastName: '', email: '', phone: '' },
        notificationUrl: 'n',
        redirectionUrl: 'r',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
