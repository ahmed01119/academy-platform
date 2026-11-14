/**
 * tenancy API endpoints (backend contract: /v1). Moved verbatim from src/api/client.ts.
 */
import type {
  AcademyProfile,
  TenantMembershipSummary,
  UpdateAcademySettings,
  DelegateCoachReviewRequest,
  InviteStaffRequest,
} from '@academy/shared';
import { request } from '@/lib/http/request';
import { setActiveTenantIdHeader } from '@/lib/http/active-tenant';

export const tenancyApi = {
  async getMyMemberships(): Promise<TenantMembershipSummary[]> {
    return request('/tenants/my-memberships', {
      method: 'GET',
    });
  },

  async switchTenant(tenantId: string): Promise<TenantMembershipSummary> {
    const res = await request<TenantMembershipSummary>('/tenants/switch', {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    });
    setActiveTenantIdHeader(tenantId);
    return res;
  },

  async listStaff(): Promise<
    Array<{
      id: string;
      role: string;
      status: string;
      canReviewApplications?: boolean;
      user: { id: string; email: string; name: string; phone?: string | null };
      branch?: { id: string; name: string; code?: string | null } | null;
    }>
  > {
    return request('/tenants/staff', {
      method: 'GET',
    });
  },

  async updateCoachDelegation(
    membershipId: string,
    data: DelegateCoachReviewRequest,
  ): Promise<{ message: string; membership: unknown }> {
    return request(`/tenants/memberships/${membershipId}/coach-delegation`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async listBranches(): Promise<
    Array<{
      id: string;
      name: string;
      code?: string | null;
      city?: string | null;
      address?: string | null;
    }>
  > {
    return request('/tenants/branches', {
      method: 'GET',
    });
  },

  async getProfile(): Promise<AcademyProfile> {
    return request('/tenants/profile', {
      method: 'GET',
    });
  },

  async updateProfile(data: UpdateAcademySettings): Promise<AcademyProfile> {
    return request('/tenants/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async inviteStaff(data: InviteStaffRequest): Promise<{
    id: string;
    email: string;
    role: string;
    token: string;
    expiresAt: string;
    emailDelivered: boolean;
    deliveryStatus: 'SENT' | 'DEV_LOGGED' | 'FAILED';
    deliveryMessage: string;
  }> {
    return request('/tenants/invitations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listInvitations(): Promise<
    Array<{
      id: string;
      email: string;
      role: string;
      status: string;
      branchId: string | null;
      branchName: string | null;
      invitedByName: string | null;
      expiresAt: string;
      createdAt: string;
      isExpired: boolean;
    }>
  > {
    return request('/tenants/invitations', {
      method: 'GET',
    });
  },

  async resendInvitation(invitationId: string): Promise<{
    id: string;
    email: string;
    emailDelivered: boolean;
    deliveryStatus: 'SENT' | 'DEV_LOGGED' | 'FAILED';
    deliveryMessage: string;
  }> {
    return request(`/tenants/invitations/${invitationId}/resend`, {
      method: 'POST',
    });
  },

  async revokeInvitation(invitationId: string): Promise<{ success: boolean; message: string }> {
    return request(`/tenants/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  },

  async revokeMembership(membershipId: string): Promise<{ message: string }> {
    return request(`/tenants/memberships/${membershipId}/revoke`, {
      method: 'POST',
    });
  },

  async acceptInvitation(data: { token: string }): Promise<{ message: string; tenantId: string }> {
    const res = await request<{ message: string; tenantId: string }>(
      '/tenants/invitations/accept',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
    if (res?.tenantId) {
      setActiveTenantIdHeader(res.tenantId);
    }
    return res;
  },
};
