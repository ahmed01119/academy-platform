import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from './api';
import { tenancyApi } from '@/features/tenancy/api';
import { portalApi } from '@/features/portal/api';
import { clearApiCache } from '@/lib/http/request';
import { setActiveTenantIdHeader } from '@/lib/http/active-tenant';

/**
 * Request contracts used by the public/auth pages, checked against the NestJS routes
 * (backend/src/modules/{auth,tenancy,portal}/*.controller.ts). Bodies must match the
 * shared Zod schemas the API parses.
 */
type Call = { url: string; init: RequestInit };
let calls: Call[];

beforeEach(() => {
  calls = [];
  clearApiCache();
  setActiveTenantIdHeader('11111111-1111-4111-8111-111111111111');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  setActiveTenantIdHeader(null);
});

const last = () => {
  const c = calls[calls.length - 1]!;
  return {
    path: new URL(c.url).pathname,
    method: c.init.method ?? 'GET',
    body: c.init.body ? JSON.parse(String(c.init.body)) : undefined,
    headers: new Headers(c.init.headers),
    credentials: c.init.credentials,
  };
};

describe('auth/public page API contracts', () => {
  it('forgot password: POST /v1/auth/forgot-password {email}, no tenant header', async () => {
    await authApi.forgotPassword({ email: 'a@b.co' });
    const c = last();
    expect([c.method, c.path, c.body]).toEqual([
      'POST',
      '/v1/auth/forgot-password',
      { email: 'a@b.co' },
    ]);
    expect(c.headers.has('x-tenant-id')).toBe(false);
    expect(c.credentials).toBe('include');
  });

  it('reset password: POST /v1/auth/reset-password {token,newPassword}, no tenant header', async () => {
    await authApi.resetPassword({ token: '123456', newPassword: 'Str0ng!Pass' });
    const c = last();
    expect([c.method, c.path, c.body]).toEqual([
      'POST',
      '/v1/auth/reset-password',
      { token: '123456', newPassword: 'Str0ng!Pass' },
    ]);
    expect(c.headers.has('x-tenant-id')).toBe(false);
  });

  it('verify email: POST /v1/auth/verify-email {token}', async () => {
    await authApi.verifyEmail('tok');
    expect(last()).toMatchObject({
      method: 'POST',
      path: '/v1/auth/verify-email',
      body: { token: 'tok' },
    });
  });

  it('resend verification: POST /v1/auth/resend-verification {email}', async () => {
    await authApi.resendVerification('a@b.co');
    expect(last()).toMatchObject({
      method: 'POST',
      path: '/v1/auth/resend-verification',
      body: { email: 'a@b.co' },
    });
  });

  it('login: POST /v1/auth/login with credentials, cookies included, no tenant header', async () => {
    await authApi.login({ email: 'a@b.co', password: 'Str0ng!Pass', rememberMe: true });
    const c = last();
    expect([c.method, c.path, c.body]).toEqual([
      'POST',
      '/v1/auth/login',
      { email: 'a@b.co', password: 'Str0ng!Pass', rememberMe: true },
    ]);
    expect(c.headers.has('x-tenant-id')).toBe(false);
    expect(c.credentials).toBe('include');
  });

  it('accept invitation: POST /v1/tenants/invitations/accept {token}', async () => {
    await tenancyApi.acceptInvitation({ token: 'invite-token-123' });
    expect(last()).toMatchObject({
      method: 'POST',
      path: '/v1/tenants/invitations/accept',
      body: { token: 'invite-token-123' },
    });
  });

  it('public academies: GET /v1/portal/academies', async () => {
    await portalApi.listPublicAcademies();
    expect(last()).toMatchObject({ method: 'GET', path: '/v1/portal/academies' });
  });

  it('player join request: POST /v1/portal/player-join-requests with contract fields only', async () => {
    const payload = {
      tenantId: '22222222-2222-4222-8222-222222222222',
      requesterType: 'GUARDIAN' as const,
      playerName: 'Omar Ali',
      contactEmail: 'p@x.co',
      contactPhone: '0100',
      dateOfBirth: '2012-01-01',
      guardianName: 'Ali',
    };
    await portalApi.submitPlayerJoinRequest(payload);
    expect(last()).toMatchObject({
      method: 'POST',
      path: '/v1/portal/player-join-requests',
      body: payload,
    });
  });

  it('my join requests: GET /v1/portal/my-join-requests', async () => {
    await portalApi.listMyJoinRequests();
    expect(last()).toMatchObject({ method: 'GET', path: '/v1/portal/my-join-requests' });
  });

  it('never puts credentials or tokens into the URL', async () => {
    await authApi.resetPassword({ token: '123456', newPassword: 'Str0ng!Pass' });
    await authApi.login({ email: 'a@b.co', password: 'Str0ng!Pass' });
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      const url = new URL(c.url);
      expect(url.search).toBe(''); // secrets travel only in the JSON body
      expect(c.url).not.toContain('123456');
      expect(c.url).not.toContain('Str0ng');
      expect(c.url).not.toContain('a@b.co');
    }
  });
});
