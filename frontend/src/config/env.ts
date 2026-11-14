/**
 * Runtime environment configuration for the web client.
 * Only NEXT_PUBLIC_* values are ever exposed to the browser bundle.
 */

/**
 * Resolves the API base URL.
 * - Browser: always the relative `/v1` path so requests go through the Next.js
 *   reverse proxy on the current origin (no CORS, first-party auth cookies).
 * - Server (SSR / route handlers): the internal backend URL.
 */
export function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '/v1';
  }

  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'http://127.0.0.1:3001/v1'
  );
}

export const API_BASE_URL = resolveApiBaseUrl();

// Note: development-only UI must test `process.env.NODE_ENV === 'development'` inline at the
// call site. Next.js replaces that expression with a literal, so the branch is compiled out of
// production bundles; a re-exported constant is not folded across modules and would ship.
