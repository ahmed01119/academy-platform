import { isIP } from 'node:net';

/**
 * Server-side header policy for the `/v1` → API proxy (S1). Used only by the route handler
 * `app/v1/[...path]/route.ts`; never imported by client components (the secret is not a `NEXT_PUBLIC_` value and is
 * never sent to browsers or logged).
 */
export const CLIENT_IP_HEADER = 'x-sportexus-client-ip';
export const PROXY_AUTH_HEADER = 'x-sportexus-proxy-auth';

/** Hop-by-hop headers that must not be forwarded upstream. */
export const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

/** Client-supplied identity headers: always removed, so a browser can never inject an IP or the proxy secret. */
export const CLIENT_IDENTITY_HEADERS = new Set([
  'x-forwarded-for',
  'x-forwarded-host',
  'x-real-ip',
  'forwarded',
  'true-client-ip',
  'cf-connecting-ip',
  'x-client-ip',
  'x-cluster-client-ip',
  'fastly-client-ip',
  CLIENT_IP_HEADER,
  PROXY_AUTH_HEADER,
]);

export interface ProxyConfig {
  /** Shared secret authenticating this proxy to the API; undefined in development when not configured. */
  secret?: string;
  /** Number of trusted reverse proxies in front of the web app (Caddy / Render LB = 1; local development = 0). */
  trustedHops: number;
}

export type ProxyConfigResult = { ok: true; config: ProxyConfig } | { ok: false; message: string };

/**
 * Reads the proxy configuration. Production (which includes staging) fails safe: a missing or short secret, or an
 * unset/invalid hop count, is a configuration error and the proxy refuses to forward requests.
 */
export function resolveProxyConfig(env: NodeJS.ProcessEnv): ProxyConfigResult {
  const isProduction = env.NODE_ENV === 'production';
  const secret = env.INTERNAL_PROXY_SECRET?.trim() || undefined;
  const rawHops = env.WEB_TRUSTED_PROXY_HOPS?.trim();

  if (isProduction && (!secret || secret.length < 32)) {
    return {
      ok: false,
      message:
        'INTERNAL_PROXY_SECRET (at least 32 characters) is required in production. Set the same value on the web and API services.',
    };
  }

  let trustedHops = 0;
  if (rawHops !== undefined && rawHops !== '') {
    if (!/^[0-3]$/.test(rawHops)) {
      return { ok: false, message: 'WEB_TRUSTED_PROXY_HOPS must be an integer between 0 and 3.' };
    }
    trustedHops = Number(rawHops);
  } else if (isProduction) {
    return {
      ok: false,
      message:
        'WEB_TRUSTED_PROXY_HOPS is required in production (number of reverse proxies in front of the web app).',
    };
  }

  return { ok: true, config: { secret, trustedHops } };
}

/** Exactly one valid IPv4/IPv6 address (IPv4-mapped IPv6 unwrapped), otherwise undefined. */
export function normalizeIp(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value || value.length > 45) return undefined;
  const mapped = value.toLowerCase().startsWith('::ffff:') ? value.slice(7) : value;
  if (isIP(mapped) === 4) return mapped;
  if (isIP(value) === 6) return value.toLowerCase();
  return undefined;
}

/**
 * The client IP as observed by the trusted proxy closest to this server: the entry `trustedHops` positions from the
 * right of `X-Forwarded-For`. Entries further left were supplied by the client and are never used.
 */
export function clientIpFromForwardedFor(
  forwardedFor: string | null,
  trustedHops: number,
): string | undefined {
  if (!forwardedFor || trustedHops <= 0) return undefined;
  const entries = forwardedFor.split(',').map((entry) => entry.trim());
  if (entries.length < trustedHops) return undefined;
  return normalizeIp(entries[entries.length - trustedHops]);
}

/** Builds the upstream request headers from the inbound browser request. */
export function buildUpstreamHeaders(
  inbound: Headers,
  config: ProxyConfig,
  protocol: string,
): Headers {
  const forwarded = new Headers();
  inbound.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lower) && !CLIENT_IDENTITY_HEADERS.has(lower)) {
      forwarded.set(key, value);
    }
  });

  const clientIp = clientIpFromForwardedFor(inbound.get('x-forwarded-for'), config.trustedHops);
  if (clientIp && config.secret) {
    forwarded.set(CLIENT_IP_HEADER, clientIp);
    forwarded.set(PROXY_AUTH_HEADER, config.secret);
  }
  forwarded.set('x-forwarded-proto', protocol);
  return forwarded;
}
