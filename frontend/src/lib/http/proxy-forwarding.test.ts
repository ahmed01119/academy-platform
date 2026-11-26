import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  CLIENT_IP_HEADER,
  PROXY_AUTH_HEADER,
  buildUpstreamHeaders,
  clientIpFromForwardedFor,
  resolveProxyConfig,
} from './proxy-forwarding';

// Synthetic test value (not a real secret).
const SECRET = 'test-only-proxy-secret-0123456789abcdef';

const FORGED = {
  'x-real-ip': '6.6.6.6',
  forwarded: 'for=6.6.6.6',
  'true-client-ip': '6.6.6.6',
  'cf-connecting-ip': '6.6.6.6',
  'x-client-ip': '6.6.6.6',
  'x-cluster-client-ip': '6.6.6.6',
  'fastly-client-ip': '6.6.6.6',
  [CLIENT_IP_HEADER]: '6.6.6.6',
  [PROXY_AUTH_HEADER]: 'attacker-guess',
};

describe('S1 proxy header policy', () => {
  it('never forwards client-supplied identity headers or a client-supplied proxy secret', () => {
    const inbound = new Headers({
      ...FORGED,
      'x-forwarded-for': '6.6.6.6, 198.51.100.20',
      'content-type': 'application/json',
      cookie: 'access_token=x',
    });
    const out = buildUpstreamHeaders(inbound, { secret: SECRET, trustedHops: 1 }, 'https');

    for (const name of Object.keys(FORGED).filter(
      (n) => n !== CLIENT_IP_HEADER && n !== PROXY_AUTH_HEADER,
    )) {
      expect(out.has(name), name).toBe(false);
    }
    expect(out.has('x-forwarded-for')).toBe(false);
    // The values the API receives are the proxy's own, not the forged ones.
    expect(out.get(CLIENT_IP_HEADER)).toBe('198.51.100.20');
    expect(out.get(PROXY_AUTH_HEADER)).toBe(SECRET);
    // Ordinary headers still pass through.
    expect(out.get('content-type')).toBe('application/json');
    expect(out.get('cookie')).toBe('access_token=x');
    expect(out.get('x-forwarded-proto')).toBe('https');
  });

  it('takes the entry added by the trusted hop, ignoring forged left-most entries', () => {
    expect(clientIpFromForwardedFor('1.2.3.4, 198.51.100.20', 1)).toBe('198.51.100.20');
    expect(clientIpFromForwardedFor('1.2.3.4, 5.6.7.8, 198.51.100.20', 2)).toBe('5.6.7.8');
    expect(clientIpFromForwardedFor('198.51.100.20', 2)).toBeUndefined(); // fewer entries than trusted hops
    expect(clientIpFromForwardedFor('1.2.3.4', 0)).toBeUndefined(); // no trusted hop => no forwarded IP
    expect(clientIpFromForwardedFor('1.2.3.4, not-an-ip', 1)).toBeUndefined();
    expect(clientIpFromForwardedFor(null, 1)).toBeUndefined();
  });

  it('sends no client IP and no secret when the IP cannot be determined (development, 0 hops)', () => {
    const out = buildUpstreamHeaders(
      new Headers({ 'x-forwarded-for': '1.2.3.4', ...FORGED }),
      { secret: SECRET, trustedHops: 0 },
      'http',
    );
    expect(out.has(CLIENT_IP_HEADER)).toBe(false);
    expect(out.has(PROXY_AUTH_HEADER)).toBe(false);
  });

  it('30 requests with 30 different forged headers resolve to one client IP (one rate-limit bucket)', () => {
    const ips = new Set<string | null>();
    for (let i = 0; i < 30; i++) {
      const inbound = new Headers({
        'x-forwarded-for': `10.0.0.${i}, 198.51.100.20`,
        [CLIENT_IP_HEADER]: `10.1.1.${i}`,
        'x-real-ip': `10.2.2.${i}`,
      });
      ips.add(
        buildUpstreamHeaders(inbound, { secret: SECRET, trustedHops: 1 }, 'https').get(
          CLIENT_IP_HEADER,
        ),
      );
    }
    expect([...ips]).toEqual(['198.51.100.20']);
  });
});

describe('S1 proxy configuration (fail-safe)', () => {
  it('requires a strong secret and an explicit hop count in production (staging included)', () => {
    expect(resolveProxyConfig({ NODE_ENV: 'production', WEB_TRUSTED_PROXY_HOPS: '1' }).ok).toBe(
      false,
    );
    expect(
      resolveProxyConfig({
        NODE_ENV: 'production',
        INTERNAL_PROXY_SECRET: 'short',
        WEB_TRUSTED_PROXY_HOPS: '1',
      }).ok,
    ).toBe(false);
    expect(resolveProxyConfig({ NODE_ENV: 'production', INTERNAL_PROXY_SECRET: SECRET }).ok).toBe(
      false,
    );
    expect(
      resolveProxyConfig({
        NODE_ENV: 'production',
        INTERNAL_PROXY_SECRET: SECRET,
        WEB_TRUSTED_PROXY_HOPS: '1',
      }),
    ).toEqual({ ok: true, config: { secret: SECRET, trustedHops: 1 } });
  });

  it('rejects an invalid hop count everywhere and needs nothing in development', () => {
    for (const bad of ['-1', '4', '1.5', 'x']) {
      expect(resolveProxyConfig({ NODE_ENV: 'development', WEB_TRUSTED_PROXY_HOPS: bad }).ok).toBe(
        false,
      );
    }
    expect(resolveProxyConfig({ NODE_ENV: 'development' })).toEqual({
      ok: true,
      config: { secret: undefined, trustedHops: 0 },
    });
  });
});

describe('S1 route integration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('forwards only the trusted-hop IP and the configured secret upstream', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_API_URL', 'https://api.internal.test');
    vi.stubEnv('INTERNAL_PROXY_SECRET', SECRET);
    vi.stubEnv('WEB_TRUSTED_PROXY_HOPS', '1');
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    vi.stubGlobal('fetch', mockFetch);
    const { GET } = await import('../../app/v1/[...path]/route');

    const req = new NextRequest('https://app.test/v1/auth/me', {
      headers: { ...FORGED, 'x-forwarded-for': '6.6.6.6, 198.51.100.20' },
    });
    await GET(req, { params: Promise.resolve({ path: ['auth', 'me'] }) });

    const sent = mockFetch.mock.calls[0]?.[1]?.headers as Headers;
    expect(sent.get(CLIENT_IP_HEADER)).toBe('198.51.100.20');
    expect(sent.get(PROXY_AUTH_HEADER)).toBe(SECRET);
    expect(sent.has('x-real-ip')).toBe(false);
    expect(sent.has('x-forwarded-for')).toBe(false);
  });

  it('refuses to proxy in production when the security configuration is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_API_URL', 'https://api.internal.test');
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { GET } = await import('../../app/v1/[...path]/route');

    const res = await GET(new NextRequest('https://app.test/v1/health'), {
      params: Promise.resolve({ path: ['health'] }),
    });
    expect(res.status).toBe(500);
    expect(mockFetch).not.toHaveBeenCalled();
    // The error message never contains the secret.
    expect(JSON.stringify(await res.json())).not.toContain(SECRET);
  });
});
