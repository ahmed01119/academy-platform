import * as crypto from 'node:crypto';

/**
 * Paymob (Egypt) client: Intention API + Unified Checkout + transaction-callback HMAC.
 * Docs (read 2026-11-22): developers.paymob.com → Intention APIs / Create Intention, Checkout experiences / Unified
 * Checkout (Redirection), Webhook callbacks and HMAC / HMAC Transaction Callback.
 *
 * Configuration (all from the environment, never from the code):
 *   PAYMOB_SECRET_KEY        secret key ("Token <key>" Authorization header)
 *   PAYMOB_PUBLIC_KEY        public key (checkout URL)
 *   PAYMOB_HMAC_SECRET       HMAC secret (dashboard → Settings → Account Info)
 *   PAYMOB_INTEGRATION_IDS   comma-separated integration ids (card, wallet…), live or test matching the secret key
 *   PAYMOB_API_BASE          default https://accept.paymob.com
 *   PAYMOB_CHECKOUT_URL      default https://eg.checkout.paymob.com
 *   PAYMOB_CURRENCY          default EGP (must match the integrations' currency)
 * Online payment is offered only when the first four are set.
 */
export interface PaymobSettings {
  apiBase: string;
  checkoutBase: string;
  secretKey: string;
  publicKey: string;
  hmacSecret: string;
  integrationIds: number[];
  currency: string;
}

export function readPaymobSettings(env: NodeJS.ProcessEnv = process.env): PaymobSettings | null {
  const secretKey = env.PAYMOB_SECRET_KEY?.trim();
  const publicKey = env.PAYMOB_PUBLIC_KEY?.trim();
  const hmacSecret = env.PAYMOB_HMAC_SECRET?.trim();
  const integrationIds = (env.PAYMOB_INTEGRATION_IDS ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!secretKey || !publicKey || !hmacSecret || integrationIds.length === 0) return null;
  return {
    apiBase: (env.PAYMOB_API_BASE?.trim() || 'https://accept.paymob.com').replace(/\/+$/, ''),
    checkoutBase: (env.PAYMOB_CHECKOUT_URL?.trim() || 'https://eg.checkout.paymob.com').replace(
      /\/+$/,
      '',
    ),
    secretKey,
    publicKey,
    hmacSecret,
    integrationIds,
    currency: (env.PAYMOB_CURRENCY?.trim() || 'EGP').toUpperCase(),
  };
}

export interface CreateIntentionInput {
  /** Amount in the currency's minor unit (piasters for EGP). */
  amountCents: number;
  currency: string;
  /** Our payment id; Paymob returns it as merchant_order_id. */
  specialReference: string;
  itemName: string;
  billing: { firstName: string; lastName: string; email: string; phone: string };
  notificationUrl: string;
  redirectionUrl: string;
  extras?: Record<string, string>;
}

export interface CreatedIntention {
  intentionId: string;
  /** Paymob's order id: the transaction callback carries it as obj.order.id (covered by the HMAC). */
  orderId: string;
  clientSecret: string;
}

export class PaymobError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export class PaymobClient {
  constructor(
    private readonly settings: PaymobSettings | null = readPaymobSettings(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get isConfigured(): boolean {
    return this.settings !== null;
  }

  get currency(): string | null {
    return this.settings?.currency ?? null;
  }

  private required(): PaymobSettings {
    if (!this.settings) throw new PaymobError('Online payment is not configured');
    return this.settings;
  }

  async createIntention(input: CreateIntentionInput): Promise<CreatedIntention> {
    const s = this.required();
    const res = await this.fetchImpl(`${s.apiBase}/v1/intention/`, {
      method: 'POST',
      headers: { Authorization: `Token ${s.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: input.amountCents,
        currency: input.currency,
        payment_methods: s.integrationIds,
        items: [{ name: input.itemName.slice(0, 50), amount: input.amountCents, quantity: 1 }],
        billing_data: {
          first_name: input.billing.firstName || 'NA',
          last_name: input.billing.lastName || 'NA',
          email: input.billing.email || 'NA',
          phone_number: input.billing.phone || 'NA',
        },
        special_reference: input.specialReference,
        notification_url: input.notificationUrl,
        redirection_url: input.redirectionUrl,
        extras: input.extras ?? {},
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    if (!res.ok) {
      // Never echo the provider's body to clients: it can name integration ids or keys.
      throw new PaymobError(
        `Paymob intention failed (${res.status}): ${text.slice(0, 300)}`,
        res.status,
      );
    }
    const body = JSON.parse(text) as {
      id?: string;
      client_secret?: string;
      intention_order_id?: number | string;
    };
    if (!body.client_secret || body.intention_order_id === undefined || !body.id) {
      throw new PaymobError(
        'Paymob intention response is missing client_secret, id or intention_order_id',
      );
    }
    return {
      intentionId: String(body.id),
      orderId: String(body.intention_order_id),
      clientSecret: body.client_secret,
    };
  }

  checkoutUrl(clientSecret: string): string {
    const s = this.required();
    return `${s.checkoutBase}/?publicKey=${encodeURIComponent(s.publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;
  }

  /** Verifies a transaction-processed callback (POST JSON `obj`) against its hmac. */
  verifyTransactionCallback(obj: unknown, hmac: string | undefined): boolean {
    const s = this.required();
    if (!hmac || typeof obj !== 'object' || obj === null) return false;
    return safeEqualHex(
      computePaymobTransactionHmac(obj as Record<string, unknown>, s.hmacSecret),
      hmac,
    );
  }
}

/** The fields Paymob signs on a transaction callback, in the order they are concatenated (no separator). */
export const PAYMOB_TRANSACTION_HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
] as const;

function readPath(obj: Record<string, unknown>, path: string): unknown {
  let value: unknown = obj;
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  // obj.order may be a plain id in some payloads
  if (
    path === 'order.id' &&
    value === undefined &&
    obj.order !== null &&
    typeof obj.order !== 'object'
  ) {
    return obj.order;
  }
  return value;
}

export function computePaymobTransactionHmac(obj: Record<string, unknown>, secret: string): string {
  const message = PAYMOB_TRANSACTION_HMAC_FIELDS.map((field) => {
    const value = readPath(obj, field);
    return value === undefined || value === null ? '' : String(value);
  }).join('');
  return crypto.createHmac('sha512', secret).update(message, 'utf8').digest('hex');
}

function safeEqualHex(expected: string, received: string): boolean {
  const a = Buffer.from(expected.toLowerCase(), 'utf8');
  const b = Buffer.from(received.trim().toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
