/**
 * platform API endpoints (backend contract: /v1). Moved verbatim from src/api/client.ts.
 */
import type {
  PlatformAcademyItem,
  PlatformAuditLogItem,
  PlatformOverviewMetrics,
  PlatformSecurityEvent,
  UpdateAcademyStatusRequest,
  AcademyDeletionImpact,
  DeleteAcademyRequest,
  DeleteAcademyResponse,
  PlatformUserItem,
  UpdateUserSecurityPolicyRequest,
  SaaSPlanItem,
  UpdateSaaSPlanRequest,
  TenantSubscriptionItem,
  UpdateTenantSubscriptionRequest,
  PlatformAnnouncementItem,
  CreatePlatformAnnouncementRequest,
  RequestSupportAccessRequest,
  SupportAccessResponse,
  AcademyApplicationItem,
  ReviewAcademyApplicationRequest,
  StorageMetrics,
  StorageMaintenanceDryRunResponse,
  ExecuteStorageMaintenanceRequest,
  InvitePlatformSuperAdminRequest,
  UpdatePlatformAdminRoleRequest,
  PlatformInviteUserRequest,
} from '@academy/shared';
import { request } from '@/lib/http/request';

export const platformApi = {
  async getMetrics(): Promise<PlatformOverviewMetrics> {
    return request('/platform/metrics', { method: 'GET' });
  },

  async listAcademies(params?: {
    status?: string;
    search?: string;
  }): Promise<PlatformAcademyItem[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/platform/academies${qs}`, { method: 'GET' });
  },

  async getAcademyDeletionImpact(id: string): Promise<AcademyDeletionImpact> {
    return request(`/platform/academies/${id}/deletion-impact`, { method: 'GET' });
  },

  async archiveAcademy(id: string, data: DeleteAcademyRequest): Promise<DeleteAcademyResponse> {
    return request(`/platform/academies/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAcademyStatus(
    id: string,
    data: UpdateAcademyStatusRequest,
  ): Promise<PlatformAcademyItem> {
    return request(`/platform/academies/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async requestSupportAccess(
    id: string,
    data: RequestSupportAccessRequest,
  ): Promise<SupportAccessResponse> {
    return request(`/platform/academies/${id}/support-access`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listAuditLogs(params?: {
    limit?: number;
    offset?: number;
  }): Promise<PlatformAuditLogItem[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/platform/audit-logs${qs}`, { method: 'GET' });
  },

  async getSecurityEvents(): Promise<PlatformSecurityEvent[]> {
    return request('/platform/security-events', { method: 'GET' });
  },

  async listUsers(params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<PlatformUserItem[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/platform/users${qs}`, { method: 'GET' });
  },

  async revokeUserSessions(userId: string): Promise<{ success: boolean; revokedCount: number }> {
    return request(`/platform/users/${userId}/revoke-sessions`, { method: 'POST' });
  },

  async updateUserSecurityPolicy(
    userId: string,
    data: UpdateUserSecurityPolicyRequest,
  ): Promise<PlatformUserItem> {
    return request(`/platform/users/${userId}/security-policy`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async listSaaSPlans(): Promise<SaaSPlanItem[]> {
    return request('/platform/saas-plans', { method: 'GET' });
  },

  async updateSaaSPlan(code: string, data: UpdateSaaSPlanRequest): Promise<SaaSPlanItem> {
    return request(`/platform/saas-plans/${code}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async updateTenantSubscription(
    tenantId: string,
    data: UpdateTenantSubscriptionRequest,
  ): Promise<TenantSubscriptionItem> {
    return request(`/platform/academies/${tenantId}/subscription`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async listAnnouncements(): Promise<PlatformAnnouncementItem[]> {
    return request('/platform/announcements', { method: 'GET' });
  },

  async createAnnouncement(
    data: CreatePlatformAnnouncementRequest,
  ): Promise<PlatformAnnouncementItem> {
    return request('/platform/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listAcademyApplications(status?: string): Promise<AcademyApplicationItem[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/platform/applications${qs}`, { method: 'GET' });
  },

  async reviewAcademyApplication(
    id: string,
    data: ReviewAcademyApplicationRequest,
  ): Promise<AcademyApplicationItem> {
    return request(`/platform/applications/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getStorageMetrics(): Promise<StorageMetrics> {
    return request('/platform/storage/metrics', { method: 'GET' });
  },

  async dryRunStorageMaintenance(): Promise<StorageMaintenanceDryRunResponse> {
    return request('/platform/storage/maintenance/dry-run', { method: 'POST' });
  },

  async executeStorageMaintenance(data: ExecuteStorageMaintenanceRequest): Promise<{
    success: boolean;
    purgedTokensCount: number;
    purgedLogsCount: number;
    message: string;
  }> {
    return request('/platform/storage/maintenance/execute', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async inviteSuperAdmin(data: InvitePlatformSuperAdminRequest): Promise<{
    success: boolean;
    message: string;
    userId: string;
  }> {
    return request('/platform/super-admin/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async inviteUser(data: PlatformInviteUserRequest): Promise<{
    success: boolean;
    message: string;
    userId: string;
  }> {
    return request('/platform/users/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePlatformAdminRole(
    userId: string,
    data: UpdatePlatformAdminRoleRequest,
  ): Promise<{ success: boolean; message: string }> {
    return request(`/platform/super-admin/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
