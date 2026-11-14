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

  async listPublicAcademies(): Promise<Array<{ id: string; name: string; slug: string }>> {
    return request('/portal/academies', { method: 'GET' });
  },

  async submitPlayerJoinRequest(data: CreatePlayerJoinRequest): Promise<PlayerJoinRequestItem> {
    return request('/portal/player-join-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
