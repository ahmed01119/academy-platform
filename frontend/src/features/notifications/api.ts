/**
 * notifications API endpoints (backend contract: /v1). Moved verbatim from src/api/client.ts.
 */
import type { AppNotificationItem } from '@academy/shared';
import { request } from '@/lib/http/request';

export const notificationsApi = {
  async list(params?: { unreadOnly?: boolean; limit?: number; offset?: number }): Promise<{
    items: AppNotificationItem[];
    total: number;
    unreadCount: number;
  }> {
    const query = new URLSearchParams();
    if (params?.unreadOnly) query.set('unreadOnly', 'true');
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/notifications${qs}`, { method: 'GET' });
  },

  async getUnreadCount(): Promise<{ unreadCount: number }> {
    return request('/notifications/unread-count', { method: 'GET' });
  },

  async markRead(id: string): Promise<AppNotificationItem> {
    return request(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  async markAllRead(): Promise<{ success: boolean; markedCount: number }> {
    return request('/notifications/mark-all-read', { method: 'POST' });
  },
};
