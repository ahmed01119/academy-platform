/**
 * evaluations API endpoints (backend contract: /v1). Moved verbatim from src/api/client.ts.
 */
import type {
  CreateEvaluationTemplateRequest,
  CreatePlayerEvaluationRequest,
  EvaluationTemplate,
  PerformanceRankingsResponse,
  PlayerDevelopmentProfile,
  PlayerEvaluation,
} from '@academy/shared';
import { request } from '@/lib/http/request';

export const evaluationsApi = {
  async listTemplates(): Promise<EvaluationTemplate[]> {
    return request('/evaluations/templates', { method: 'GET' });
  },

  async createTemplate(data: CreateEvaluationTemplateRequest): Promise<EvaluationTemplate> {
    return request('/evaluations/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createEvaluation(data: CreatePlayerEvaluationRequest): Promise<PlayerEvaluation> {
    return request('/evaluations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listPlayerEvaluations(playerId: string): Promise<PlayerEvaluation[]> {
    return request(`/evaluations/player/${playerId}`, { method: 'GET' });
  },

  async getPlayerDevelopmentProfile(playerId: string): Promise<PlayerDevelopmentProfile> {
    return request(`/evaluations/player/${playerId}/profile`, { method: 'GET' });
  },

  async listSessionEvaluations(sessionId: string): Promise<PlayerEvaluation[]> {
    return request(`/evaluations/session/${sessionId}`, { method: 'GET' });
  },

  async getRankings(params?: {
    ageCategory?: string;
    groupId?: string;
    timeframe?: string;
  }): Promise<PerformanceRankingsResponse> {
    const query = new URLSearchParams();
    if (params?.ageCategory) query.set('ageCategory', params.ageCategory);
    if (params?.groupId) query.set('groupId', params.groupId);
    if (params?.timeframe) query.set('timeframe', params.timeframe);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/evaluations/rankings${qs}`, { method: 'GET' });
  },
};
