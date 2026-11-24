/**
 * portal API endpoints (backend contract: /v1). Moved verbatim from src/api/client.ts.
 */
import type {
  GuardianPortalData,
  PlayerPortalProfile,
  PlayerPortalEvaluation,
  PlayerQrCardResponse,
  PlayerJoinRequestItem,
  CreatePlayerJoinRequest,
  DecideGuardianLinkRequest,
  GuardianLinkRequestView,
  RequestGuardianLinkRequest,
} from '@academy/shared';
import { request } from '@/lib/http/request';

export const portalApi = {
  async getPlayerProfile(): Promise<{
    profile: PlayerPortalProfile;
    upcomingSessions: Array<{
      id: string;
      sessionDate: string;
      startTime: string;
      endTime: string;
      groupName: string;
      branchName?: string;
    }>;
    attendanceSummary: {
      totalEligible: number;
      present: number;
      late: number;
      absent: number;
      attendanceRate: number;
    };
    recentEvaluations: PlayerPortalEvaluation[];
  }> {
    return request('/portal/player/me', { method: 'GET' });
  },

  async getMyPlayerQrCard(): Promise<PlayerQrCardResponse> {
    return request('/portal/player/qr-card', { method: 'GET' });
  },

  async getGuardianProfile(): Promise<GuardianPortalData> {
    return request('/portal/guardian/me', { method: 'GET' });
  },

  async redeemClaimToken(claimToken: string): Promise<{
    success: boolean;
    type: 'PLAYER' | 'GUARDIAN';
    entityId: string;
    message: string;
  }> {
    return request('/portal/claim', {
      method: 'POST',
      body: JSON.stringify({ claimToken }),
    });
  },

  async generateClaimToken(data: {
    targetType: 'PLAYER' | 'GUARDIAN';
    targetId: string;
  }): Promise<{ claimToken: string; expiresAt: string }> {
    return request('/portal/claim-token', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Asks to be linked to a child who has a player account. The child gets an approval e-mail only when the phone
   * matches the guardian the academy registered; the answer is the same either way.
   */
  async requestGuardianLink(data: RequestGuardianLinkRequest): Promise<{ success: true }> {
    return request('/portal/guardian-links', { method: 'POST', body: JSON.stringify(data) });
  },

  /** The link request the child is asked to approve (public; signed link). */
  async getGuardianLinkRequest(token: string): Promise<GuardianLinkRequestView> {
    return request(`/portal/guardian-links/approval?token=${encodeURIComponent(token)}`, {
      skipCache: true,
    });
  },

  /** The child's answer to a link request. */
  async decideGuardianLink(data: DecideGuardianLinkRequest): Promise<{ linked: boolean }> {
    return request('/portal/guardian-links/approval', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listPublicAcademies(): Promise<Array<{ id: string; name: string; slug: string }>> {
    return request('/portal/academies', { method: 'GET' });
  },

  /** PLAYER or GUARDIAN join request (K6). Not signed in: include `password` (a pending account is created). */
  async submitPlayerJoinRequest(data: CreatePlayerJoinRequest): Promise<PlayerJoinRequestItem> {
    return request('/portal/player-join-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** The signed-in user's own join requests (any status), newest first. */
  async listMyJoinRequests(): Promise<PlayerJoinRequestItem[]> {
    return request('/portal/my-join-requests', { method: 'GET' });
  },
};
