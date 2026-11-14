/**
 * groups API endpoints (backend contract: /v1). Moved verbatim from src/api/client.ts.
 */
import type {
  AssignCoachRequest,
  AssignPlayerRequest,
  CreateScheduleRequest,
  CreateTrainingGroupRequest,
  GroupCoachSummary,
  GroupMemberSummary,
  GroupStatus,
  TrainingGroupDetails,
  TrainingGroupSummary,
  TrainingScheduleSummary,
  UpdateTrainingGroupRequest,
} from '@academy/shared';
import { request } from '@/lib/http/request';

export const groupsApi = {
  async list(params?: {
    search?: string;
    branchId?: string;
    status?: GroupStatus;
    page?: number;
    limit?: number;
  }): Promise<{
    items: TrainingGroupSummary[];
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
    return request(`/groups${qs}`, {
      method: 'GET',
    });
  },

  async get(id: string): Promise<TrainingGroupDetails> {
    return request(`/groups/${id}`, {
      method: 'GET',
    });
  },

  async create(data: CreateTrainingGroupRequest): Promise<TrainingGroupSummary> {
    return request('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: UpdateTrainingGroupRequest): Promise<TrainingGroupSummary> {
    return request(`/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async assignCoach(groupId: string, data: AssignCoachRequest): Promise<GroupCoachSummary> {
    return request(`/groups/${groupId}/coaches`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async removeCoach(groupId: string, coachUserId: string): Promise<{ success: boolean }> {
    return request(`/groups/${groupId}/coaches/${coachUserId}`, {
      method: 'DELETE',
    });
  },

  async assignPlayer(groupId: string, data: AssignPlayerRequest): Promise<GroupMemberSummary> {
    return request(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async removePlayer(groupId: string, playerId: string): Promise<{ success: boolean }> {
    return request(`/groups/${groupId}/members/${playerId}`, {
      method: 'DELETE',
    });
  },

  async createSchedule(
    groupId: string,
    data: CreateScheduleRequest,
  ): Promise<TrainingScheduleSummary> {
    return request(`/groups/${groupId}/schedules`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteSchedule(groupId: string, scheduleId: string): Promise<{ success: boolean }> {
    return request(`/groups/${groupId}/schedules/${scheduleId}`, {
      method: 'DELETE',
    });
  },
};
