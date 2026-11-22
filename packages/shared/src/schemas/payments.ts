import { z } from 'zod';

/** Online payment states (database enum OnlinePaymentStatus). */
export const OnlinePaymentStatusSchema = z.enum(['PENDING', 'PAID', 'FAILED']);
export type OnlinePaymentStatus = z.infer<typeof OnlinePaymentStatusSchema>;

/** A subscription balance the signed-in player or guardian can pay. */
export interface PaymentDueItem {
  subscriptionId: string;
  tenantId: string;
  academyName: string;
  playerId: string;
  playerName: string;
  planName: string | null;
  dueDate: string;
  outstandingBalance: number;
  currency: string;
  /** False when online payment is not available for this due (provider not configured, or another currency). */
  canPayOnline: boolean;
}

export const CreateOnlinePaymentRequestSchema = z.object({
  subscriptionId: z.string().uuid(),
});
export type CreateOnlinePaymentRequest = z.infer<typeof CreateOnlinePaymentRequestSchema>;

export interface CreateOnlinePaymentResponse {
  paymentId: string;
  /** The payment provider's hosted checkout page; the browser is sent there. */
  checkoutUrl: string;
}

export interface OnlinePaymentStatusResponse {
  id: string;
  /** Absent in responses from before phase B; treat as PLAYER_SUBSCRIPTION. */
  purpose?: 'PLAYER_SUBSCRIPTION' | 'PLATFORM_SUBSCRIPTION';
  status: OnlinePaymentStatus;
  amount: number;
  currency: string;
  academyName: string;
  playerName: string | null;
  receiptNumber: string | null;
  /** PLATFORM_SUBSCRIPTION: the platform invoice issued for the payment. */
  invoiceNumber?: string | null;
  /** PLATFORM_SUBSCRIPTION: the subscription's renewal date after the payment. */
  renewalDate?: string | null;
  paidAt: string | null;
}

/** What an online payment pays for (database enum OnlinePaymentPurpose). */
export const OnlinePaymentPurposeSchema = z.enum(['PLAYER_SUBSCRIPTION', 'PLATFORM_SUBSCRIPTION']);
export type OnlinePaymentPurpose = z.infer<typeof OnlinePaymentPurposeSchema>;

/** Months bought by one payment of the academy's platform subscription, per billing cycle. */
export const SAAS_BILLING_CYCLE_MONTHS = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
} as const;
export type SaaSBillingCycleCode = keyof typeof SAAS_BILLING_CYCLE_MONTHS;

/** What the academy owner would pay now to renew the platform subscription for one billing cycle. */
export interface PlatformSubscriptionQuote {
  planName: string;
  status: string;
  billingCycle: SaaSBillingCycleCode;
  months: number;
  amount: number;
  currency: string;
  renewalDate: string;
  /** The renewal date after this payment (one cycle after the later of today and the current renewal date). */
  nextRenewalDate: string;
  /** False when the provider is not configured, the price is zero, or the currency is not supported online. */
  canPayOnline: boolean;
}

/** Per academy: money collected online on its behalf, what the platform transferred to it, and what is still owed. */
export interface AcademyPayoutBalanceItem {
  tenantId: string;
  academyName: string;
  currency: string;
  collectedOnline: number;
  paymentsCount: number;
  paidOut: number;
  balance: number;
  lastPaymentAt: string | null;
  lastPayoutAt: string | null;
}

export interface AcademyPayoutItem {
  id: string;
  tenantId: string;
  academyName: string;
  amount: number;
  currency: string;
  reference: string | null;
  notes: string | null;
  paidAt: string;
  recordedByName: string | null;
  createdAt: string;
}

export const CreateAcademyPayoutRequestSchema = z.object({
  tenantId: z.string().uuid(),
  amount: z
    .number()
    .positive()
    .max(100_000_000)
    .refine((n) => Math.round(n * 100) === n * 100, 'At most two decimal places'),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  /** When the transfer was made (YYYY-MM-DD); defaults to today. */
  paidAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type CreateAcademyPayoutRequest = z.infer<typeof CreateAcademyPayoutRequestSchema>;

/** The academy's own view: what families paid online, and the transfers it received from the platform. */
export interface AcademyOnlineCollectionsSummary {
  currency: string;
  collectedOnline: number;
  paymentsCount: number;
  paidOut: number;
  balance: number;
  payouts: AcademyPayoutItem[];
}
