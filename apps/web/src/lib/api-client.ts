import type {
  AcademyProfile,
  AuthResponse,
  BranchStatus,
  BranchSummary,
  CreateBranchRequest,
  CreateEnrollmentRequest,
  CreatePlayerRequest,
  EnrollmentStatus,
  EnrollmentSummary,
  ForgotPasswordRequest,
  LoginRequest,
  PlayerDetails,
  PlayerStatus,
  PlayerSummary,
  RegisterRequest,
  ResetPasswordRequest,
  TenantMembershipSummary,
  TransferBranchRequest,
  UpdateAcademySettings,
  UpdateBranchRequest,
  UpdatePlayerRequest,
  UserSummary,
} from '@academy/shared';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001/v1';

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
};
