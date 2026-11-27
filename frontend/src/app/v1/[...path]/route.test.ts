import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resolveBackendBaseUrl, GET, POST } from './route';

describe('V1 API Proxy Runtime Route Handler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('resolveBackendBaseUrl() security and configuration invariants', () => {
    it('uses INTERNAL_API_URL when provided', () => {
      process.env.INTERNAL_API_URL = 'https://sportexus-backend-staging.hostless.app/v1';
      vi.stubEnv('NODE_ENV', 'production');
      expect(resolveBackendBaseUrl()).toBe('https://sportexus-backend-staging.hostless.app');
    });

    it('strips trailing slashes and /v1 correctly', () => {
      process.env.INTERNAL_API_URL = 'https://api.sportexus.com/v1/';
      expect(resolveBackendBaseUrl()).toBe('https://api.sportexus.com');
    });

    it('falls back to NEXT_PUBLIC_API_BASE_URL if INTERNAL_API_URL is unset', () => {
      delete process.env.INTERNAL_API_URL;
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://public-api.sportexus.com/v1';
      expect(resolveBackendBaseUrl()).toBe('https://public-api.sportexus.com');
    });

    it('NEVER proxies to localhost or 127.0.0.1 in production when URL is missing', () => {
      delete process.env.INTERNAL_API_URL;
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
      vi.stubEnv('NODE_ENV', 'production');

      expect(() => resolveBackendBaseUrl()).toThrowError(
        /INTERNAL_API_URL is required in production mode\. Refusing to proxy to localhost\./,
      );
    });

    it('allows 127.0.0.1:3001 ONLY in development mode', () => {
      delete process.env.INTERNAL_API_URL;
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
      vi.stubEnv('NODE_ENV', 'development');
      expect(resolveBackendBaseUrl()).toBe('http://127.0.0.1:3001');
    });
  });

  describe('HTTP Proxying and Header / Cookie Handling', () => {
    it('returns HTTP 500 with clear message when backend URL is missing in production', async () => {
      delete process.env.INTERNAL_API_URL;
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
      vi.stubEnv('NODE_ENV', 'production');

      const req = new NextRequest('http://localhost:3000/v1/auth/login', {
        method: 'POST',
      });

      const res = await POST(req, {
        params: Promise.resolve({ path: ['auth', 'login'] }),
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Configuration Error');
      expect(json.message).toContain('INTERNAL_API_URL');
    });

    it('successfully forwards POST request, body, and captures Set-Cookie headers', async () => {
      process.env.INTERNAL_API_URL = 'https://sportexus-backend-staging.hostless.app';
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('INTERNAL_PROXY_SECRET', 'test-only-proxy-secret-0123456789abcdef');
      vi.stubEnv('WEB_TRUSTED_PROXY_HOPS', '1');

      const mockSetCookies = [
        'access_token=jwt.token.here; Path=/; HttpOnly; SameSite=Lax; Secure; Domain=sportexus-backend-staging.hostless.app',
        'refresh_token=refresh.token.here; Path=/v1/auth; HttpOnly; SameSite=Lax; Secure',
      ];

      const mockHeaders = new Headers();
      mockHeaders.set('content-type', 'application/json');
      mockSetCookies.forEach((c) => mockHeaders.append('set-cookie', c));

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: mockHeaders,
        arrayBuffer: async () =>
          new TextEncoder().encode(
            JSON.stringify({ user: { id: 'usr-1', email: 'test@academy.com' } }),
          ),
      });
      global.fetch = mockFetch;

      const req = new NextRequest(
        'https://sportexus-web-staging.hostless.app/v1/auth/login?source=web',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': 'tenant-uuid-1234',
          },
          body: JSON.stringify({ email: 'test@academy.com', password: 'password123' }),
        },
      );

      const res = await POST(req, {
        params: Promise.resolve({ path: ['auth', 'login'] }),
      });

      expect(res.status).toBe(200);

      // Verify upstream URL called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://sportexus-backend-staging.hostless.app/v1/auth/login?source=web',
        expect.objectContaining({
          method: 'POST',
        }),
      );

      // Verify Set-Cookie headers are forwarded and sanitized of cross-domain attributes
      const responseCookies = res.headers.getSetCookie();
      expect(responseCookies.length).toBe(2);
      expect(responseCookies[0]).toContain('access_token=jwt.token.here');
      expect(responseCookies[0]).not.toContain('Domain='); // Domain must be stripped so cookie binds to frontend
      expect(responseCookies[1]).toContain('refresh_token=refresh.token.here');
    });

    it('does not pass on the encoding of a body fetch() already decompressed', async () => {
      process.env.INTERNAL_API_URL = 'https://api.example.test';
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('INTERNAL_PROXY_SECRET', 'test-only-proxy-secret-0123456789abcdef');
      vi.stubEnv('WEB_TRUSTED_PROXY_HOPS', '1');
      const body = new TextEncoder().encode('{"ok":true}');
      const upstreamHeaders = new Headers({
        'content-type': 'application/json',
        'content-encoding': 'gzip',
        'content-length': '31',
        etag: 'W/"abc"',
      });
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: upstreamHeaders,
        arrayBuffer: async () => body,
      });

      const res = await POST(
        new NextRequest('https://web.example.test/v1/auth/login', { method: 'POST', body: '{}' }),
        { params: Promise.resolve({ path: ['auth', 'login'] }) },
      );

      expect(res.headers.get('content-encoding')).toBeNull();
      expect(res.headers.get('content-length')).not.toBe('31');
      expect(res.headers.get('content-type')).toBe('application/json');
      expect(res.headers.get('etag')).toBe('W/"abc"');
      expect(await res.text()).toBe('{"ok":true}');
    });

    it('returns HTTP 502 Bad Gateway when upstream fetch fails', async () => {
      process.env.INTERNAL_API_URL = 'https://sportexus-backend-staging.hostless.app';
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('INTERNAL_PROXY_SECRET', 'test-only-proxy-secret-0123456789abcdef');
      vi.stubEnv('WEB_TRUSTED_PROXY_HOPS', '1');

      global.fetch = vi.fn().mockRejectedValue(new Error('Connection timeout to backend'));

      const req = new NextRequest('https://sportexus-web-staging.hostless.app/v1/tenants/profile', {
        method: 'GET',
      });

      const res = await GET(req, {
        params: Promise.resolve({ path: ['tenants', 'profile'] }),
      });

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toBe('Bad Gateway');
      expect(json.message).toContain('unavailable or unreachable');
    });
  });
});
