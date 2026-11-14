import { API_BASE_URL } from '@/config/env';
import { API_CACHE_TTL_MS } from '@/config/constants';
import { ApiError } from './api-error';
import { getActiveTenantIdHeader } from './active-tenant';
import { executeSingleFlightTokenRefresh } from './token-refresh';

/** Auth endpoints that must never carry an `x-tenant-id` header. */
const AUTH_ENDPOINTS_WITHOUT_TENANT_HEADER = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/resend-verification',
];

/** Endpoints where a 401 is a real answer, not an expired access token. */
const NO_AUTO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/resend-verification',
];

export interface RequestOptions extends RequestInit {
  _retry?: boolean;
  skipCache?: boolean;
}

interface CacheItem {
  data: unknown;
  timestamp: number;
}

/**
 * Short-lived GET cache keyed by tenant + endpoint, plus in-flight de-duplication.
 * Any successful mutation clears the whole cache.
 */
const memoryCache = new Map<string, CacheItem>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export function clearApiCache(): void {
  memoryCache.clear();
  inFlightRequests.clear();
}

/**
 * Single entry point for every backend call:
 * same-origin `/v1`, cookies included, tenant header, one transparent
 * refresh-and-retry on 401, uniform `ApiError` on failure.
 */
export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const activeTenantId = getActiveTenantIdHeader();
  const cacheKey = `${activeTenantId || 'global'}:${endpoint}`;
  const shouldSkipCache = options.skipCache || headers.get('x-no-cache') === 'true';

  if (isGet && !shouldSkipCache) {
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < API_CACHE_TTL_MS) {
      return cached.data as T;
    }
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }

  const fetchPromise = (async () => {
    const isAuthEndpoint = AUTH_ENDPOINTS_WITHOUT_TENANT_HEADER.some((path) =>
      endpoint.startsWith(path),
    );
    if (activeTenantId && !headers.has('x-tenant-id') && !isAuthEndpoint) {
      headers.set('x-tenant-id', activeTenantId);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const shouldTryRefresh =
      response.status === 401 &&
      !options._retry &&
      !NO_AUTO_REFRESH_PATHS.some((path) => endpoint.startsWith(path));

    if (shouldTryRefresh) {
      const refreshed = await executeSingleFlightTokenRefresh();
      if (refreshed) {
        return request<T>(endpoint, {
          ...options,
          _retry: true,
        });
      }
    }

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

    if (isGet) {
      memoryCache.set(cacheKey, { data, timestamp: Date.now() });
    } else {
      memoryCache.clear();
    }

    return data as T;
  })();

  if (isGet && !shouldSkipCache) {
    inFlightRequests.set(cacheKey, fetchPromise);
    try {
      return (await fetchPromise) as T;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  }

  return fetchPromise as Promise<T>;
}
