import type {
  AcademyProfile,
  AssignCoachRequest,
  AssignPlayerRequest,
  AttendanceCorrection,
  AttendanceEventSummary,
  AttendanceMutation,
  AttendanceReportQuery,
  AttendanceReportSummary,
  AttendanceRosterItem,
  AuthResponse,
  BranchStatus,
  BranchSummary,
  BulkAttendanceSubmission,
  CreateAttendanceSession,
  CreateBranchRequest,
  CreateEnrollmentRequest,
  CreatePlayerRequest,
  CreateScheduleRequest,
  CreateTrainingGroupRequest,
  EnrollmentStatus,
  EnrollmentSummary,
  ForgotPasswordRequest,
  GenerateQrRequest,
  GenerateQrResponse,
  GroupCoachSummary,
  GroupMemberSummary,
  GroupStatus,
  LoginRequest,
  PlayerDetails,
  PlayerStatus,
  PlayerSummary,
  QrCheckInRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SessionDetails,
  SessionQuery,
  SessionSummary,
  TenantMembershipSummary,
  TrainingGroupDetails,
  TrainingGroupSummary,
  TrainingScheduleSummary,
  TransferBranchRequest,
  UpdateAcademySettings,
  UpdateBranchRequest,
  UpdatePlayerRequest,
  UpdateTrainingGroupRequest,
  UserSummary,
  CreateEvaluationTemplateRequest,
  CreatePlayerEvaluationRequest,
  EvaluationTemplate,
  GuardianPortalData,
  PerformanceRankingsResponse,
  PlatformAcademyItem,
  PlatformAuditLogItem,
  PlatformOverviewMetrics,
  PlatformSecurityEvent,
  PlayerDevelopmentProfile,
  PlayerEvaluation,
  PlayerPortalProfile,
  PlayerPortalEvaluation,
  UpdateAcademyStatusRequest,
  PlayerQrCardResponse,
  RotatePlayerQrCardRequest,
  RevokePlayerQrCardRequest,
  ScanPlayerQrRequest,
  ScanPlayerQrResponse,
  OfflineAttendanceBatchSyncRequest,
  OfflineAttendanceBatchSyncResponse,
  PlatformUserItem,
  UpdateUserSecurityPolicyRequest,
  SaaSPlanItem,
  UpdateSaaSPlanRequest,
  TenantSubscriptionItem,
  UpdateTenantSubscriptionRequest,
  PlatformAnnouncementItem,
  CreatePlatformAnnouncementRequest,
  PlayerSubscriptionPlanItem,
  CreatePlayerSubscriptionPlanRequest,
  PlayerSubscriptionItem,
  CreatePlayerSubscriptionRequest,
  FinancialTransactionItem,
  RecordPlayerPaymentRequest,
  ReverseTransactionRequest,
  RecordSessionExpenseRequest,
  ApproveExpenseRequest,
  RejectExpenseRequest,
  SessionCashierSummary,
  CloseSessionCashierRequest,
  AcademyFinancialDashboardMetrics,
  RequestSupportAccessRequest,
  SupportAccessResponse,
  AppNotificationItem,
  AcademyApplicationItem,
  CreateAcademyApplicationRequest,
  ReviewAcademyApplicationRequest,
  PlayerJoinRequestItem,
  CreatePlayerJoinRequest,
  ReviewPlayerJoinRequest,
  StorageMetrics,
  StorageMaintenanceDryRunResponse,
  ExecuteStorageMaintenanceRequest,
  InvitePlatformSuperAdminRequest,
  PlatformInviteUserRequest,
} from '@academy/shared';

function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // In browser: ALWAYS use relative '/v1' so client requests route via the Next.js
    // reverse proxy on the current origin. This eliminates CORS issues, protects auth
    // cookies on mobile Safari, and guarantees zero dependency on client localhost.
    return '/v1';
  }
  // Server-side (SSR / API routes): talk to internal backend port/container
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'http://127.0.0.1:3001/v1'
  );
}

const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getInitialActiveTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('academy_active_tenant_id');
    if (saved) return saved;
  } catch {
    // Ignore storage read error
  }
  try {
    const match = document.cookie.match(/(?:^|;\s*)tenant_id=([^;]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch {
    // Ignore cookie read error
  }
  return null;
}

let activeTenantIdCache: string | null = getInitialActiveTenantId();

export function setActiveTenantIdHeader(tenantId: string | null): void {
  activeTenantIdCache = tenantId;
  if (typeof window !== 'undefined') {
    try {
      if (tenantId) {
        localStorage.setItem('academy_active_tenant_id', tenantId);
        document.cookie = `tenant_id=${encodeURIComponent(tenantId)}; path=/; max-age=2592000; SameSite=Lax`;
      } else {
        localStorage.removeItem('academy_active_tenant_id');
        document.cookie = 'tenant_id=; path=/; max-age=0; SameSite=Lax';
      }
    } catch {
      // Ignore storage write error
    }
  }
}

export function getActiveTenantIdHeader(): string | null {
  return activeTenantIdCache;
}

const AUTH_ENDPOINTS_WITHOUT_TENANT_HEADER = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/resend-verification',
];

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const isAuthEndpoint = AUTH_ENDPOINTS_WITHOUT_TENANT_HEADER.some((path) =>
    endpoint.startsWith(path),
  );

  if (activeTenantIdCache && !headers.has('x-tenant-id') && !isAuthEndpoint) {
    headers.set('x-tenant-id', activeTenantIdCache);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorData = typeof data === 'object' && data !== null ? data : {};
    const message =
      (errorData as { message?: string | string[] }).message ??
      `Request failed with status ${response.status}`;
    const code = (errorData as { code?: string }).code;
    const finalMessage = Array.isArray(message) ? message.join(', ') : message;

    throw new ApiError(finalMessage, response.status, code, data);
  }

  return data as T;
}

export const api = {
  auth: {
    async register(data: RegisterRequest): Promise<AuthResponse> {
      const res = await request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res.activeTenant?.tenantId) {
        setActiveTenantIdHeader(res.activeTenant.tenantId);
      }
      return res;
    },

    async login(data: LoginRequest): Promise<AuthResponse> {
      const res = await request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res.activeTenant?.tenantId) {
        setActiveTenantIdHeader(res.activeTenant.tenantId);
      }
      return res;
    },

    async logout(): Promise<{ message: string }> {
      const res = await request<{ message: string }>('/auth/logout', {
        method: 'POST',
      });
      setActiveTenantIdHeader(null);
      return res;
    },

    async refresh(refreshToken?: string): Promise<AuthResponse> {
      const res = await request<AuthResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      });
      if (res.activeTenant?.tenantId) {
        setActiveTenantIdHeader(res.activeTenant.tenantId);
      }
      return res;
    },

    async forgotPassword(
      data: ForgotPasswordRequest,
    ): Promise<{ message: string; debugToken?: string }> {
      return request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
      return request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async verifyEmail(token: string): Promise<{ message: string }> {
      return request('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    },

    async resendVerification(email: string): Promise<{ message: string; debugToken?: string }> {
      return request('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    async getMe(): Promise<{
      user: UserSummary;
      activeTenant?: TenantMembershipSummary;
      memberships: TenantMembershipSummary[];
    }> {
      return request('/auth/me', {
        method: 'GET',
      });
    },
  },

  tenancy: {
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
        user: { id: string; email: string; name: string; phone?: string | null };
        branch?: { id: string; name: string; code?: string | null } | null;
      }>
    > {
      return request('/tenants/staff', {
        method: 'GET',
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
  },

  branches: {
    async list(filter?: { search?: string; status?: BranchStatus }): Promise<BranchSummary[]> {
      const params = new URLSearchParams();
      if (filter?.search) params.set('search', filter.search);
      if (filter?.status) params.set('status', filter.status);
      const qs = params.toString() ? `?${params.toString()}` : '';
      return request(`/branches${qs}`, {
        method: 'GET',
      });
    },

    async get(id: string): Promise<BranchSummary> {
      return request(`/branches/${id}`, {
        method: 'GET',
      });
    },

    async create(data: CreateBranchRequest): Promise<BranchSummary> {
      return request('/branches', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(id: string, data: UpdateBranchRequest): Promise<BranchSummary> {
      return request(`/branches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
  },

  players: {
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

    async rotateQrCard(
      id: string,
      data?: RotatePlayerQrCardRequest,
    ): Promise<PlayerQrCardResponse> {
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
      return request(`/players/join-requests${qs}`, { method: 'GET' });
    },

    async reviewJoinRequest(
      id: string,
      data: ReviewPlayerJoinRequest,
    ): Promise<PlayerJoinRequestItem> {
      return request(`/players/join-requests/${id}/review`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  enrollments: {
    async list(params?: {
      playerId?: string;
      branchId?: string;
      status?: EnrollmentStatus;
    }): Promise<EnrollmentSummary[]> {
      const query = new URLSearchParams();
      if (params?.playerId) query.set('playerId', params.playerId);
      if (params?.branchId) query.set('branchId', params.branchId);
      if (params?.status) query.set('status', params.status);
      const qs = query.toString() ? `?${query.toString()}` : '';
      return request(`/enrollments${qs}`, {
        method: 'GET',
      });
    },

    async create(data: CreateEnrollmentRequest): Promise<EnrollmentSummary> {
      return request('/enrollments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async transfer(id: string, data: TransferBranchRequest): Promise<EnrollmentSummary> {
      return request(`/enrollments/${id}/transfer`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  groups: {
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
  },

  attendance: {
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

    async scanPlayerQr(
      sessionId: string,
      data: ScanPlayerQrRequest,
    ): Promise<ScanPlayerQrResponse> {
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

    async recordAttendance(data: AttendanceMutation): Promise<AttendanceRosterItem> {
      return request('/attendance/records', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async bulkRecordAttendance(
      data: BulkAttendanceSubmission,
    ): Promise<{ count: number; updated: AttendanceRosterItem[] }> {
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
  },

  platform: {
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

    async submitAcademyApplication(
      data: CreateAcademyApplicationRequest,
    ): Promise<AcademyApplicationItem> {
      return request('/platform/applications', {
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
      return request('/platform/super-admins/invite', {
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
  },

  finance: {
    async getTenantSubscription(): Promise<TenantSubscriptionItem> {
      return request('/finance/subscription', { method: 'GET' });
    },

    async listPlayerPlans(branchId?: string): Promise<PlayerSubscriptionPlanItem[]> {
      const qs = branchId ? `?branchId=${branchId}` : '';
      return request(`/finance/player-plans${qs}`, { method: 'GET' });
    },

    async createPlayerPlan(
      data: CreatePlayerSubscriptionPlanRequest,
    ): Promise<PlayerSubscriptionPlanItem> {
      return request('/finance/player-plans', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async listPlayerSubscriptions(params?: {
      status?: string;
      search?: string;
      playerId?: string;
      limit?: number;
      offset?: number;
    }): Promise<PlayerSubscriptionItem[]> {
      const query = new URLSearchParams();
      if (params?.status) query.set('status', params.status);
      if (params?.search) query.set('search', params.search);
      if (params?.playerId) query.set('playerId', params.playerId);
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.offset) query.set('offset', String(params.offset));
      const qs = query.toString() ? `?${query.toString()}` : '';
      return request(`/finance/player-subscriptions${qs}`, { method: 'GET' });
    },

    async getPlayerSubscription(playerId: string): Promise<PlayerSubscriptionItem | null> {
      return request(`/finance/player-subscriptions/player/${playerId}`, { method: 'GET' });
    },

    async createPlayerSubscription(
      data: CreatePlayerSubscriptionRequest,
    ): Promise<PlayerSubscriptionItem> {
      return request('/finance/player-subscriptions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async recordPayment(data: RecordPlayerPaymentRequest): Promise<FinancialTransactionItem> {
      return request('/finance/payments/collect', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async reverseTransaction(
      id: string,
      data: ReverseTransactionRequest,
    ): Promise<FinancialTransactionItem> {
      return request(`/finance/transactions/${id}/reverse`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getSessionCashierSummary(sessionId: string): Promise<SessionCashierSummary> {
      return request(`/finance/sessions/${sessionId}/cashier`, { method: 'GET' });
    },

    async recordSessionExpense(
      sessionId: string,
      data: RecordSessionExpenseRequest,
    ): Promise<FinancialTransactionItem> {
      return request(`/finance/sessions/${sessionId}/expense`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async approveSessionExpense(
      id: string,
      data?: ApproveExpenseRequest,
    ): Promise<FinancialTransactionItem> {
      return request(`/finance/expenses/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      });
    },

    async rejectSessionExpense(
      id: string,
      data: RejectExpenseRequest,
    ): Promise<FinancialTransactionItem> {
      return request(`/finance/expenses/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async closeSessionCashier(
      sessionId: string,
      data?: CloseSessionCashierRequest,
    ): Promise<SessionCashierSummary> {
      return request(`/finance/sessions/${sessionId}/close`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      });
    },

    async getDashboardMetrics(branchId?: string): Promise<AcademyFinancialDashboardMetrics> {
      const qs = branchId ? `?branchId=${branchId}` : '';
      return request(`/finance/dashboard${qs}`, { method: 'GET' });
    },
  },

  evaluations: {
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
  },

  portal: {
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
  },

  notifications: {
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
      return request('/notifications/read-all', { method: 'PATCH' });
    },
  },
};

export const apiClient = api;
export default api;
