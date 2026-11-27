/**
 * auth API endpoints (backend contract: /v1). Moved verbatim from src/api/client.ts.
 */
import type {
  AuthResponse,
  EmailCodeProofResponse,
  SendEmailCodeResponse,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  TenantMembershipSummary,
  UserSummary,
  ChangePasswordRequest,
  UpdateUserProfileRequest,
} from '@academy/shared';
import { request } from '@/lib/http/request';
import { setActiveTenantIdHeader } from '@/lib/http/active-tenant';
import { executeSingleFlightTokenRefresh, runSessionReplacement } from '@/lib/http/token-refresh';
import { ApiError } from '@/lib/http/api-error';

export const authApi = {
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const res = await request<RegisterResponse>('/auth/register', {
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
    const res = await executeSingleFlightTokenRefresh(refreshToken);
    if (!res) {
      throw new ApiError('Failed to refresh authentication session', 401, 'UNAUTHORIZED');
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

  async resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Sends a 6-digit code that confirms an applicant's e-mail before an account is created. */
  async sendEmailCode(email: string): Promise<SendEmailCodeResponse> {
    return request('/auth/email-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  /** Checks the code; the returned proof goes with the registration / join form as `emailProof`. */
  async verifyEmailCode(email: string, code: string): Promise<EmailCodeProofResponse> {
    return request('/auth/email-code/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
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

  /** The answer replaces this device's session cookies; requests in flight meanwhile continue with the new ones. */
  async changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
    return runSessionReplacement(() =>
      request<{ message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    );
  },

  async updateProfile(
    data: UpdateUserProfileRequest,
  ): Promise<{ message: string; name?: string; phone?: string | null }> {
    return request('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
