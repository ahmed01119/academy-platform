import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CLIENT_IP_HEADER,
  PROXY_AUTH_HEADER,
  createClientIpMiddleware,
  normalizeIp,
  rateLimitIpKey,
  secretMatches,
} from './client-ip';

// Synthetic test value (not a real secret).
const SECRET = 'test-only-proxy-secret-0123456789abcdef';

/** Starts a real Express app with the production middleware and returns what the handler saw. */
async function startApp(trustProxyHops: number, secret: string | undefined = SECRET) {
  const app = express();
  app.set('trust proxy', trustProxyHops);
  app.use(createClientIpMiddleware(secret));
  app.get('/probe', (req, res) => {
    res.json({
      clientIp: req.clientIp,
      sawClientIpHeader: req.headers[CLIENT_IP_HEADER] ?? null,
      sawProxyAuthHeader: req.headers[PROXY_AUTH_HEADER] ?? null,
    });
  });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  const probe = async (headers: Record<string, string>) => {
    const res = await fetch(`http://127.0.0.1:${port}/probe`, { headers });
    return (await res.json()) as {
      clientIp: string;
      sawClientIpHeader: string | null;
      sawProxyAuthHeader: string | null;
    };
  };
  return { server, probe };
}

describe('client IP resolution (S1) - real Express server', () => {
  let server: Server | undefined;
  afterEach(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    server = undefined;
  });

  it('uses the proxy-forwarded IP only when the shared secret matches', async () => {
    const started = await startApp(0);
    server = started.server;
    const seen = await started.probe({
      [CLIENT_IP_HEADER]: '203.0.113.7',
      [PROXY_AUTH_HEADER]: SECRET,
    });
    expect(seen.clientIp).toBe('203.0.113.7');
  });

  it.each([
    ['no secret', {}],
    ['wrong secret', { [PROXY_AUTH_HEADER]: 'wrong-secret-0123456789abcdef0123456' }],
    ['secret of different length', { [PROXY_AUTH_HEADER]: 'short' }],
    ['empty secret', { [PROXY_AUTH_HEADER]: '' }],
  ])(
    'ignores a forged client-IP header with %s (direct call to the API)',
    async (_label, extra) => {
      const started = await startApp(0);
      server = started.server;
      const seen = await started.probe({ [CLIENT_IP_HEADER]: '1.2.3.4', ...extra });
      expect(seen.clientIp).toBe('127.0.0.1');
    },
  );

  it.each([
    '1.2.3.4; drop table',
    '::ffff:999.1.1.1',
    '',
    'not-an-ip',
    '1.2.3.4, 5.6.7.8',
    '1.2.3',
  ])('rejects a malformed forwarded IP %j even with the correct secret', async (bad) => {
    const started = await startApp(0);
    server = started.server;
    const seen = await started.probe({ [CLIENT_IP_HEADER]: bad, [PROXY_AUTH_HEADER]: SECRET });
    expect(seen.clientIp).toBe('127.0.0.1');
  });

  it('never trusts X-Forwarded-For with TRUST_PROXY_HOPS=0', async () => {
    const started = await startApp(0);
    server = started.server;
    const seen = await started.probe({ 'x-forwarded-for': '1.2.3.4' });
    expect(seen.clientIp).toBe('127.0.0.1');
  });

  it('with TRUST_PROXY_HOPS=1 uses only the entry added by the trusted hop (right-most)', async () => {
    const started = await startApp(1);
    server = started.server;
    // Client forged "1.2.3.4"; the trusted load balancer appended the real peer "198.51.100.20".
    const seen = await started.probe({ 'x-forwarded-for': '1.2.3.4, 198.51.100.20' });
    expect(seen.clientIp).toBe('198.51.100.20');
  });

  it('removes both proxy headers before handlers run', async () => {
    const started = await startApp(0);
    server = started.server;
    const seen = await started.probe({
      [CLIENT_IP_HEADER]: '203.0.113.7',
      [PROXY_AUTH_HEADER]: SECRET,
    });
    expect(seen.sawClientIpHeader).toBeNull();
    expect(seen.sawProxyAuthHeader).toBeNull();
  });

  it('without a configured secret, no forwarded IP is ever trusted', async () => {
    const started = await startApp(0, undefined);
    server = started.server;
    const seen = await started.probe({
      [CLIENT_IP_HEADER]: '203.0.113.7',
      [PROXY_AUTH_HEADER]: '',
    });
    expect(seen.clientIp).toBe('127.0.0.1');
  });
});

describe('secretMatches', () => {
  it('compares in constant time and never throws', () => {
    expect(secretMatches(SECRET, SECRET)).toBe(true);
    expect(secretMatches(SECRET.slice(0, -1), SECRET)).toBe(false);
    expect(secretMatches(`${SECRET}x`, SECRET)).toBe(false);
    expect(secretMatches(undefined, SECRET)).toBe(false);
    expect(secretMatches(['a', 'b'], SECRET)).toBe(false);
    expect(secretMatches(SECRET, undefined)).toBe(false);
  });
});

describe('normalizeIp', () => {
  it('accepts exactly one IPv4/IPv6 address and unwraps IPv4-mapped IPv6', () => {
    expect(normalizeIp(' 203.0.113.7 ')).toBe('203.0.113.7');
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp('2001:DB8::1')).toBe('2001:db8::1');
    expect(normalizeIp('203.0.113.7, 10.0.0.1')).toBeUndefined();
    expect(normalizeIp(42)).toBeUndefined();
  });
});

describe('rateLimitIpKey', () => {
  it('keeps IPv4 and groups IPv6 by /64', () => {
    expect(rateLimitIpKey('203.0.113.7')).toBe('203.0.113.7');
    expect(rateLimitIpKey('2001:db8:aaaa:bbbb:1:2:3:4')).toBe('2001:db8:aaaa:bbbb::/64');
    expect(rateLimitIpKey('2001:db8:aaaa:bbbb::9')).toBe('2001:db8:aaaa:bbbb::/64');
    expect(rateLimitIpKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(rateLimitIpKey(undefined)).toBe('unknown');
  });
});
