/**
 * Online payments (backend contract: /v1/payments).
 */
import type {
  AcademyOnlineCollectionsSummary,
  AcademyPayoutBalanceItem,
  AcademyPayoutItem,
  CreateAcademyPayoutRequest,
  CreateOnlinePaymentResponse,
  OnlinePaymentStatusResponse,
  PaymentDueItem,
  PlatformSubscriptionQuote,
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

  /** Academy owner: what renewing the platform subscription online costs now. */
  async getPlatformSubscriptionQuote(): Promise<PlatformSubscriptionQuote> {
    return request('/payments/platform-subscription/quote', { method: 'GET' });
  },

  /** Academy owner: pay one billing cycle of the platform subscription; redirect to `checkoutUrl`. */
  async payPlatformSubscription(): Promise<CreateOnlinePaymentResponse> {
    return request('/payments/platform-subscription', { method: 'POST', body: '{}' });
  },

  /** Academy finance: families' online payments and the transfers received from the platform. */
  async getAcademyOnlineSummary(): Promise<AcademyOnlineCollectionsSummary> {
    return request('/payments/academy-summary', { method: 'GET' });
  },

  /** Platform console: what the platform owes each academy. */
  async listPayoutBalances(): Promise<AcademyPayoutBalanceItem[]> {
    return request('/platform/payouts/balances', { method: 'GET' });
  },

  async listPayouts(tenantId?: string): Promise<AcademyPayoutItem[]> {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return request(`/platform/payouts${q}`, { method: 'GET' });
  },

  /** Platform owner: record a transfer made to an academy. */
  async recordPayout(dto: CreateAcademyPayoutRequest): Promise<AcademyPayoutItem> {
    return request('/platform/payouts', { method: 'POST', body: JSON.stringify(dto) });
  },
};
