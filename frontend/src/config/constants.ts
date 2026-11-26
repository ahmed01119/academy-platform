/**
 * Browser storage keys. Values are part of the persisted client contract —
 * changing them logs users out or loses preferences, so treat them as stable.
 */
export const STORAGE_KEYS = {
  activeTenantId: 'academy_active_tenant_id',
  hasSession: 'sportexus_has_session',
  authExpiry: 'sportexus_auth_expiry',
  authUser: 'sportexus_auth_user',
  recentSearches: 'academy_recent_searches',
} as const;

/** Cookie mirrored from the active tenant id (read by the API TenantGuard as a fallback). */
export const TENANT_COOKIE_NAME = 'tenant_id';

/** Tenant cookie lifetime: 30 days. */
export const TENANT_COOKIE_MAX_AGE_SECONDS = 2_592_000;

/** In-memory GET response cache lifetime used by the HTTP client. */
export const API_CACHE_TTL_MS = 25_000;
