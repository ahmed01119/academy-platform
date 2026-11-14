import type { AuthResponse } from '@academy/shared';
import { API_BASE_URL } from '@/config/env';
import { setActiveTenantIdHeader } from './active-tenant';
import { emitAuthEvent } from './auth-events';

let refreshPromise: Promise<AuthResponse | null> | null = null;

/**
 * Rotates the httpOnly refresh cookie. Concurrent callers share one in-flight
 * request (single flight) so the backend never sees the same refresh token twice,
 * which would trigger its reuse detection and revoke the session family.
 */
export async function executeSingleFlightTokenRefresh(
  explicitRefreshToken?: string,
): Promise<AuthResponse | null> {
  if (!explicitRefreshToken && refreshPromise) {
    return refreshPromise;
  }

  const task = (async (): Promise<AuthResponse | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(explicitRefreshToken ? { refreshToken: explicitRefreshToken } : {}),
        credentials: 'include',
      });

      if (!response.ok) {
        emitAuthEvent('SESSION_EXPIRED');
        return null;
      }

      const resData = (await response.json()) as AuthResponse;
      if (resData?.activeTenant?.tenantId) {
        setActiveTenantIdHeader(resData.activeTenant.tenantId);
      }
      emitAuthEvent('REFRESH_SUCCESS');
      return resData;
    } catch {
      emitAuthEvent('SESSION_EXPIRED');
      return null;
    } finally {
      if (!explicitRefreshToken) {
        refreshPromise = null;
      }
    }
  })();

  if (!explicitRefreshToken) {
    refreshPromise = task;
  }

  return task;
}
