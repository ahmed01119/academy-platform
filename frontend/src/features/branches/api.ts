/**
 * branches API endpoints (backend contract: /v1). Moved verbatim from src/api/client.ts.
 */
import type {
  BranchStatus,
  BranchSummary,
  CreateBranchRequest,
  UpdateBranchRequest,
} from '@academy/shared';
import { request } from '@/lib/http/request';

export const branchesApi = {
  async list(filter?: { search?: string; status?: BranchStatus }): Promise<BranchSummary[]> {
    const params = new URLSearchParams();
    if (filter?.search) params.set('search', filter.search);
    if (filter?.status) params.set('status', filter.status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request(`/branches${qs}`, {
      method: 'GET',
    });
  },

  async get(id: string): Promise<BranchSummary> {
    return request(`/branches/${id}`, {
      method: 'GET',
    });
  },

  async create(data: CreateBranchRequest): Promise<BranchSummary> {
    return request('/branches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: UpdateBranchRequest): Promise<BranchSummary> {
    return request(`/branches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async getDeletionImpact(id: string): Promise<{
    branchId: string;
    branchName: string;
    activeEnrollmentsCount: number;
    groupsCount: number;
    activeSessionsCount: number;
    activeStaffCount: number;
    financialTransactionsCount: number;
    hasBlockingDependencies: boolean;
    recommendation: 'ARCHIVE' | 'SAFE_DELETE';
  }> {
    return request(`/branches/${id}/deletion-impact`, {
      method: 'GET',
    });
  },

  async archive(id: string): Promise<{
    success: boolean;
    message: string;
    branch: { id: string; name: string; status: string };
  }> {
    return request(`/branches/${id}`, {
      method: 'DELETE',
    });
  },
};
