import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { NextFunction, Request, Response } from 'express';

/**
 * Trusted client IP (S1).
 *
 * Browser traffic reaches the API through the Next.js `/v1` proxy, so `req.ip` is the proxy's address. The proxy
 * therefore forwards the real client IP in {@link CLIENT_IP_HEADER} together with a shared secret in
 * {@link PROXY_AUTH_HEADER}. The API accepts the forwarded IP **only** when the secret matches (constant-time) and
 * the value is a syntactically valid IP address. Every other request - including direct calls to the API - uses
 * `req.ip`, which Express derives from the socket address and at most `trust proxy` hops of `X-Forwarded-For`
 * (configured with `TRUST_PROXY_HOPS`, default 0). `X-Forwarded-For` is never parsed here.
 */
export const CLIENT_IP_HEADER = 'x-sportexus-client-ip';
export const PROXY_AUTH_HEADER = 'x-sportexus-proxy-auth';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express' documented request-augmentation pattern
  namespace Express {
    interface Request {
      /** Client IP resolved by {@link createClientIpMiddleware}; use this, never `req.ip` or headers. */
      clientIp?: string;
    }
  }
}

/** Constant-time comparison that never throws on length mismatch or non-string input. */
export function secretMatches(provided: unknown, expected: string | undefined): boolean {
  if (!expected || typeof provided !== 'string' || provided.length === 0) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    // Still spend comparable time so the length is not trivially observable.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/** Returns a canonical IP string, or undefined when the value is not exactly one valid IPv4/IPv6 address. */
export function normalizeIp(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  if (!value || value.length > 45) return undefined;
  const mapped = value.toLowerCase().startsWith('::ffff:') ? value.slice(7) : value;
  if (isIP(mapped) === 4) return mapped;
  if (isIP(value) === 6) return value.toLowerCase();
  return undefined;
}

function headerValue(req: Request, name: string): unknown {
  const value = req.headers[name];
  return Array.isArray(value) ? undefined : value; // duplicated headers are never trusted
}

export function resolveClientIp(req: Request, proxySecret: string | undefined): string {
  if (secretMatches(headerValue(req, PROXY_AUTH_HEADER), proxySecret)) {
    const forwarded = normalizeIp(headerValue(req, CLIENT_IP_HEADER));
    if (forwarded) return forwarded;
  }
  return normalizeIp(req.ip) ?? normalizeIp(req.socket?.remoteAddress) ?? 'unknown';
}

/**
 * Resolves `req.clientIp` once per request and removes the proxy headers so that nothing downstream can read the
 * secret or a client-controlled IP value.
 */
export function createClientIpMiddleware(proxySecret: string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.clientIp = resolveClientIp(req, proxySecret);
    delete req.headers[CLIENT_IP_HEADER];
    delete req.headers[PROXY_AUTH_HEADER];
    next();
  };
}

/**
 * Key for per-IP rate limits. IPv4 addresses are used as-is; IPv6 addresses are grouped by their /64 prefix,
 * because a single client typically controls a whole /64 and could otherwise rotate addresses freely.
 */
export function rateLimitIpKey(ip: string | undefined): string {
  const normalized = normalizeIp(ip);
  if (!normalized) return 'unknown';
  if (isIP(normalized) === 4) return normalized;
  return `${expandIpv6(normalized).slice(0, 4).join(':')}::/64`;
}

function expandIpv6(ip: string): string[] {
  const [head, tail] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const missing = 8 - headParts.length - tailParts.length;
  const parts = ip.includes('::')
    ? [...headParts, ...Array(Math.max(0, missing)).fill('0'), ...tailParts]
    : headParts;
  return parts.map((part) => part.replace(/^0+(?=.)/, '') || '0');
}
