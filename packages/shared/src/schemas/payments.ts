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
  status: OnlinePaymentStatus;
  amount: number;
  currency: string;
  academyName: string;
  playerName: string | null;
  receiptNumber: string | null;
  paidAt: string | null;
}
