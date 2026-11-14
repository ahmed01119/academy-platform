/**
 * finance API endpoints (backend contract: /v1). Moved verbatim from src/api/client.ts.
 */
import type {
  TenantSubscriptionItem,
  PlayerSubscriptionPlanItem,
  CreatePlayerSubscriptionPlanRequest,
  PlayerSubscriptionItem,
  CreatePlayerSubscriptionRequest,
  FinancialTransactionItem,
  RecordPlayerPaymentRequest,
  ReverseTransactionRequest,
  RecordSessionExpenseRequest,
  ApproveExpenseRequest,
  RejectExpenseRequest,
  SessionCashierSummary,
  CloseSessionCashierRequest,
  AcademyFinancialDashboardMetrics,
} from '@academy/shared';
import { request } from '@/lib/http/request';

export const financeApi = {
  async getTenantSubscription(): Promise<TenantSubscriptionItem> {
    return request('/finance/subscription', { method: 'GET' });
  },

  async listPlayerPlans(branchId?: string): Promise<PlayerSubscriptionPlanItem[]> {
    const qs = branchId ? `?branchId=${branchId}` : '';
    return request(`/finance/player-plans${qs}`, { method: 'GET' });
  },

  async createPlayerPlan(
    data: CreatePlayerSubscriptionPlanRequest,
  ): Promise<PlayerSubscriptionPlanItem> {
    return request('/finance/player-plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listPlayerSubscriptions(params?: {
    status?: string;
    search?: string;
    playerId?: string;
    limit?: number;
    offset?: number;
  }): Promise<PlayerSubscriptionItem[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.playerId) query.set('playerId', params.playerId);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/finance/player-subscriptions${qs}`, { method: 'GET' });
  },

  async getPlayerSubscription(playerId: string): Promise<PlayerSubscriptionItem | null> {
    return request(`/finance/player-subscriptions/player/${playerId}`, { method: 'GET' });
  },

  async createPlayerSubscription(
    data: CreatePlayerSubscriptionRequest,
  ): Promise<PlayerSubscriptionItem> {
    return request('/finance/player-subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async recordPayment(data: RecordPlayerPaymentRequest): Promise<FinancialTransactionItem> {
    return request('/finance/payments/collect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async reverseTransaction(
    id: string,
    data: ReverseTransactionRequest,
  ): Promise<FinancialTransactionItem> {
    return request(`/finance/transactions/${id}/reverse`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getSessionCashierSummary(sessionId: string): Promise<SessionCashierSummary> {
    return request(`/finance/sessions/${sessionId}/cashier`, { method: 'GET' });
  },

  async recordSessionExpense(
    sessionId: string,
    data: RecordSessionExpenseRequest,
  ): Promise<FinancialTransactionItem> {
    return request(`/finance/sessions/${sessionId}/expense`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async approveSessionExpense(
    id: string,
    data?: ApproveExpenseRequest,
  ): Promise<FinancialTransactionItem> {
    return request(`/finance/expenses/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  async rejectSessionExpense(
    id: string,
    data: RejectExpenseRequest,
  ): Promise<FinancialTransactionItem> {
    return request(`/finance/expenses/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async closeSessionCashier(
    sessionId: string,
    data?: CloseSessionCashierRequest,
  ): Promise<SessionCashierSummary> {
    return request(`/finance/sessions/${sessionId}/close`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  async getDashboardMetrics(branchId?: string): Promise<AcademyFinancialDashboardMetrics> {
    const qs = branchId ? `?branchId=${branchId}` : '';
    return request(`/finance/dashboard${qs}`, { method: 'GET' });
  },
};
