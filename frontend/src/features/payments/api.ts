/**
 * Online payments (backend contract: /v1/payments).
 */
import type {
  CreateOnlinePaymentResponse,
  OnlinePaymentStatusResponse,
  PaymentDueItem,
} from '@academy/shared';
import { request } from '@/lib/http/request';

export const paymentsApi = {
  /** Subscription balances the signed-in player or guardian can pay. */
  async listDues(): Promise<PaymentDueItem[]> {
    return request('/payments/dues', { method: 'GET' });
  },

  /** Starts an online payment; the caller sends the browser to `checkoutUrl`. */
  async startOnlinePayment(subscriptionId: string): Promise<CreateOnlinePaymentResponse> {
    return request('/payments/online', {
      method: 'POST',
      body: JSON.stringify({ subscriptionId }),
    });
  },

  async getOnlinePayment(id: string): Promise<OnlinePaymentStatusResponse> {
    return request(`/payments/online/${id}`, { method: 'GET' });
  },
};
