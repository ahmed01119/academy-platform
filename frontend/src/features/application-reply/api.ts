/**
 * Answering a "more details" request on an academy application (public; the signed token from the e-mail is the
 * credential). Backend: GET/POST /v1/academy-applications/reply.
 */
import type {
  AcademyApplicationReplyView,
  SubmitAcademyApplicationReplyRequest,
} from '@academy/shared';
import { request } from '@/lib/http/request';

export const applicationReplyApi = {
  async get(token: string): Promise<AcademyApplicationReplyView> {
    return request(`/academy-applications/reply?token=${encodeURIComponent(token)}`, {
      skipCache: true,
    });
  },

  async submit(data: SubmitAcademyApplicationReplyRequest): Promise<{ success: true }> {
    return request('/academy-applications/reply', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
