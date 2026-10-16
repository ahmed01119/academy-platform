import type {
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  TenantMembershipSummary,
  UserSummary,
} from '@academy/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

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

let activeTenantIdCache: string | null = null;

export function setActiveTenantIdHeader(tenantId: string | null): void {
  activeTenantIdCache = tenantId;
}

export function getActiveTenantIdHeader(): string | null {
  return activeTenantIdCache;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (activeTenantIdCache && !headers.has('x-tenant-id')) {
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
  },
};
