/**
 * attendance API endpoints (backend contract: /v1). Moved verbatim from src/api/client.ts.
 */
import type {
  AttendanceCorrection,
  AttendanceEventSummary,
  AttendanceMutation,
  AttendanceReportQuery,
  AttendanceReportSummary,
  AttendanceRosterItem,
  BulkAttendanceSubmission,
  BulkRecordAttendanceResult,
  CreateAttendanceSession,
  GenerateQrRequest,
  GenerateQrResponse,
  QrCheckInRequest,
  RecordAttendanceResult,
  SessionDetails,
  SessionQuery,
  SessionSummary,
  ScanPlayerQrRequest,
  ScanPlayerQrResponse,
  OfflineAttendanceBatchSyncRequest,
  OfflineAttendanceBatchSyncResponse,
} from '@academy/shared';
import { request } from '@/lib/http/request';

export const attendanceApi = {
  async listSessions(params?: Partial<SessionQuery>): Promise<{
    items: SessionSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query = new URLSearchParams();
    if (params?.branchId) query.set('branchId', params.branchId);
    if (params?.groupId) query.set('groupId', params.groupId);
    if (params?.coachUserId) query.set('coachUserId', params.coachUserId);
    if (params?.status) query.set('status', params.status);
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/attendance/sessions${qs}`, {
      method: 'GET',
    });
  },

  async getSession(id: string): Promise<SessionDetails> {
    return request(`/attendance/sessions/${id}`, {
      method: 'GET',
    });
  },

  async createSession(data: CreateAttendanceSession): Promise<SessionSummary> {
    return request('/attendance/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async closeSession(id: string): Promise<SessionSummary> {
    return request(`/attendance/sessions/${id}/close`, {
      method: 'POST',
    });
  },

  async generateQr(id: string, data?: GenerateQrRequest): Promise<GenerateQrResponse> {
    return request(`/attendance/sessions/${id}/qr`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  async checkInViaQr(sessionId: string, data: QrCheckInRequest): Promise<AttendanceRosterItem> {
    return request(`/attendance/sessions/${sessionId}/checkin-qr`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async scanPlayerQr(sessionId: string, data: ScanPlayerQrRequest): Promise<ScanPlayerQrResponse> {
    return request(`/attendance/sessions/${sessionId}/scan-player-qr`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async syncOfflineBatch(
    sessionId: string,
    data: OfflineAttendanceBatchSyncRequest,
  ): Promise<OfflineAttendanceBatchSyncResponse> {
    return request(`/attendance/sessions/${sessionId}/offline-sync`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async recordAttendance(data: AttendanceMutation): Promise<RecordAttendanceResult> {
    return request('/attendance/records', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async bulkRecordAttendance(data: BulkAttendanceSubmission): Promise<BulkRecordAttendanceResult> {
    return request('/attendance/records/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async correctAttendance(data: AttendanceCorrection): Promise<AttendanceRosterItem> {
    return request('/attendance/corrections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getSessionEvents(sessionId: string): Promise<AttendanceEventSummary[]> {
    return request(`/attendance/sessions/${sessionId}/events`, {
      method: 'GET',
    });
  },

  async getReports(params?: AttendanceReportQuery): Promise<AttendanceReportSummary> {
    const query = new URLSearchParams();
    if (params?.branchId) query.set('branchId', params.branchId);
    if (params?.groupId) query.set('groupId', params.groupId);
    if (params?.playerId) query.set('playerId', params.playerId);
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/attendance/reports${qs}`, {
      method: 'GET',
    });
  },
};
