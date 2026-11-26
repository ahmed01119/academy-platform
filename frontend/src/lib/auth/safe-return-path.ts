/**
 * Safe post-authentication return paths (open-redirect protection).
 *
 * Only an explicit allow-list of internal pages may be used as a `?redirect=` target.
 * Everything else — external URLs, protocol-relative URLs (`//evil.com`), other schemes
 * (`javascript:`), backslash tricks, encoded slashes, dot-segments, control characters —
 * is rejected and callers fall back to their normal destination.
 */

/** Query parameter carrying the return path on /login and /register. */
export const RETURN_PATH_PARAM = 'redirect';

/** Internal pages a user may be returned to after signing in or registering. */
export const ALLOWED_RETURN_PATHNAMES: ReadonlySet<string> = new Set([
  '/accept-invite',
  '/auth/accept-invite',
]);

const MAX_RETURN_PATH_LENGTH = 2048;
// Synthetic origin used only to parse relative paths; never navigated to.
const PARSE_BASE = 'https://return-path.invalid';
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const ENCODED_SEPARATORS = /%(2f|5c|2e)/i; // encoded "/", "\" and "."

/**
 * Returns a normalized internal path (`pathname + search`) when `raw` is an allowed return
 * destination, otherwise `null`. The fragment is dropped.
 */
export function sanitizeReturnPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_RETURN_PATH_LENGTH) {
    return null;
  }
  if (raw !== raw.trim() || CONTROL_CHARS.test(raw) || raw.includes('\\')) return null;

  // Must be an absolute path on this origin: exactly one leading slash, no scheme/authority.
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;

  const pathPart = raw.split(/[?#]/, 1)[0] ?? '';
  if (ENCODED_SEPARATORS.test(pathPart)) return null;

  let url: URL;
  try {
    url = new URL(raw, PARSE_BASE);
  } catch {
    return null;
  }

  if (url.origin !== PARSE_BASE || url.username || url.password) return null;
  // Reject anything the parser had to normalize (dot-segments, duplicate slashes, etc.).
  if (url.pathname !== pathPart) return null;
  if (!ALLOWED_RETURN_PATHNAMES.has(url.pathname)) return null;

  return `${url.pathname}${url.search}`;
}

/** Reads and validates `?redirect=` from a query string (e.g. `window.location.search`). */
export function readReturnPath(search: string): string | null {
  return sanitizeReturnPath(new URLSearchParams(search).get(RETURN_PATH_PARAM));
}

/** Builds `/login?redirect=…` (or `/register`) — the return path is included only if it is safe. */
export function withReturnPath(base: '/login' | '/register', returnPath: string | null): string {
  const safe = sanitizeReturnPath(returnPath);
  if (!safe) return base;
  return `${base}?${new URLSearchParams({ [RETURN_PATH_PARAM]: safe }).toString()}`;
}

/** Internal path of the invitation page for a given token (token safely encoded). */
export function invitationPath(token: string): string {
  return `/accept-invite?${new URLSearchParams({ token }).toString()}`;
}
