/**
 * enrollments API endpoints (backend contract: /v1). Moved verbatim from src/api/client.ts.
 */
import type {
  CreateEnrollmentRequest,
  EnrollmentStatus,
  EnrollmentSummary,
  TransferBranchRequest,
} from '@academy/shared';
import { request } from '@/lib/http/request';

export const enrollmentsApi = {
  async list(params?: {
    playerId?: string;
    branchId?: string;
    status?: EnrollmentStatus;
  }): Promise<EnrollmentSummary[]> {
    const query = new URLSearchParams();
    if (params?.playerId) query.set('playerId', params.playerId);
    if (params?.branchId) query.set('branchId', params.branchId);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/enrollments${qs}`, {
      method: 'GET',
    });
  },

  async create(data: CreateEnrollmentRequest): Promise<EnrollmentSummary> {
    return request('/enrollments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async transfer(id: string, data: TransferBranchRequest): Promise<EnrollmentSummary> {
    return request(`/enrollments/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
