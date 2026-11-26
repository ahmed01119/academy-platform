import {
  STORAGE_KEYS,
  TENANT_COOKIE_MAX_AGE_SECONDS,
  TENANT_COOKIE_NAME,
} from '@/config/constants';

/**
 * Holds the active tenant (academy) id sent as `x-tenant-id` on API requests.
 * Persisted to localStorage and mirrored into a cookie so it survives reloads.
 * Authorization is still decided server-side by the API TenantGuard.
 */

function readInitialActiveTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.activeTenantId);
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

let activeTenantId: string | null = readInitialActiveTenantId();

export function setActiveTenantIdHeader(tenantId: string | null): void {
  activeTenantId = tenantId;
  if (typeof window !== 'undefined') {
    try {
      if (tenantId) {
        localStorage.setItem(STORAGE_KEYS.activeTenantId, tenantId);
        document.cookie = `${TENANT_COOKIE_NAME}=${encodeURIComponent(tenantId)}; path=/; max-age=${TENANT_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
      } else {
        localStorage.removeItem(STORAGE_KEYS.activeTenantId);
        document.cookie = `${TENANT_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
      }
    } catch {
      // Ignore storage write error
    }
  }
}

export function getActiveTenantIdHeader(): string | null {
  return activeTenantId;
}
