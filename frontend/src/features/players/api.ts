/**
 * players API endpoints (backend contract: /v1). Moved verbatim from src/api/client.ts.
 */
import type {
  CreatePlayerRequest,
  PlayerDetails,
  PlayerDeletionImpact,
  PlayerDeletionResponse,
  PlayerStatus,
  PlayerSummary,
  UpdatePlayerRequest,
  PlayerQrCardResponse,
  RotatePlayerQrCardRequest,
  RevokePlayerQrCardRequest,
  PlayerJoinRequestItem,
  ReviewPlayerJoinRequest,
} from '@academy/shared';
import { request } from '@/lib/http/request';

export const playersApi = {
  async list(params?: {
    search?: string;
    branchId?: string;
    status?: PlayerStatus;
    page?: number;
    limit?: number;
  }): Promise<{
    items: PlayerSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.branchId) query.set('branchId', params.branchId);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/players${qs}`, {
      method: 'GET',
    });
  },

  async get(id: string): Promise<PlayerDetails> {
    return request(`/players/${id}`, {
      method: 'GET',
    });
  },

  async create(data: CreatePlayerRequest): Promise<PlayerSummary> {
    return request('/players', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: UpdatePlayerRequest): Promise<PlayerSummary> {
    return request(`/players/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async getQrCard(id: string): Promise<PlayerQrCardResponse> {
    return request(`/players/${id}/qr-card`, {
      method: 'GET',
    });
  },

  async rotateQrCard(id: string, data?: RotatePlayerQrCardRequest): Promise<PlayerQrCardResponse> {
    return request(`/players/${id}/qr-card/rotate`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  async revokeQrCard(id: string, data: RevokePlayerQrCardRequest): Promise<PlayerQrCardResponse> {
    return request(`/players/${id}/qr-card/revoke`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listJoinRequests(status?: string): Promise<PlayerJoinRequestItem[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/players/registration-requests${qs}`, { method: 'GET' });
  },

  async reviewJoinRequest(
    id: string,
    data: ReviewPlayerJoinRequest,
  ): Promise<PlayerJoinRequestItem> {
    return request(`/players/registration-requests/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getDeletionImpact(id: string): Promise<PlayerDeletionImpact> {
    return request(`/players/${id}/deletion-impact`, {
      method: 'GET',
    });
  },

  async safeDelete(id: string): Promise<PlayerDeletionResponse> {
    return request(`/players/${id}`, {
      method: 'DELETE',
    });
  },
};
