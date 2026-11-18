import type { AuthResponse } from '@academy/shared';
import { API_BASE_URL } from '@/config/env';
import { setActiveTenantIdHeader } from './active-tenant';
import { emitAuthEvent } from './auth-events';

let refreshPromise: Promise<AuthResponse | null> | null = null;

/** Web Locks name shared by every tab of the app on this origin. */
export const CROSS_TAB_REFRESH_LOCK = 'sportexus-token-refresh';
/** localStorage key holding the time of the last successful rotation (any tab). */
export const LAST_ROTATION_KEY = 'sportexus_token_rotated_at';
/** A rotation this recent by another tab means the shared cookies are already fresh. */
export const RECENT_ROTATION_MS = 10_000;

/**
 * Runs `task` while holding a lock shared by every open tab (Web Locks API), so two tabs never send the same refresh
 * token at once. The backend treats a second use of a rotated refresh token as theft and revokes the whole session
 * family, which signed the user out whenever the access token expired with two tabs open. Without the API (very old
 * browsers) the task simply runs.
 */
async function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks || typeof locks.request !== 'function') return task();
  return locks.request(CROSS_TAB_REFRESH_LOCK, task) as Promise<T>;
}

function readLastRotation(): number {
  try {
    return Number(localStorage.getItem(LAST_ROTATION_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markRotated(): void {
  try {
    localStorage.setItem(LAST_ROTATION_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: the lock alone still prevents concurrent rotations.
  }
}

/**
 * Another tab rotated a moment ago and the browser already holds its new cookies: reload the session with them
 * instead of rotating again. Returns null when that does not work, so the caller falls back to a normal refresh.
 */
async function adoptSessionFromOtherTab(): Promise<AuthResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });
    if (!response.ok) return null;
    const me = (await response.json()) as Omit<AuthResponse, 'accessToken'>;
    // The access token lives in an httpOnly cookie; the body's copy is only used at login.
    return { accessToken: '', ...me };
  } catch {
    return null;
  }
}

async function rotate(explicitRefreshToken?: string): Promise<AuthResponse | null> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(explicitRefreshToken ? { refreshToken: explicitRefreshToken } : {}),
    credentials: 'include',
  });
  if (!response.ok) return null;
  markRotated();
  return (await response.json()) as AuthResponse;
}

/**
 * Rotates the httpOnly refresh cookie. Concurrent callers in this tab share one in-flight request (single flight),
 * and tabs take turns through a cross-tab lock, so the backend never sees the same refresh token twice.
 */
export async function executeSingleFlightTokenRefresh(
  explicitRefreshToken?: string,
): Promise<AuthResponse | null> {
  if (!explicitRefreshToken && refreshPromise) {
    return refreshPromise;
  }

  const task = (async (): Promise<AuthResponse | null> => {
    try {
      const resData = await withCrossTabLock(async () => {
        if (!explicitRefreshToken && Date.now() - readLastRotation() < RECENT_ROTATION_MS) {
          const adopted = await adoptSessionFromOtherTab();
          if (adopted) return adopted;
        }
        return rotate(explicitRefreshToken);
      });

      if (!resData) {
        emitAuthEvent('SESSION_EXPIRED');
        return null;
      }
      if (resData.activeTenant?.tenantId) {
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
