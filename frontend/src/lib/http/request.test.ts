import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Owner report 2026-11-27 (second): with the session left idle until the access token expired, "Change Password"
 * spun forever and the app then signed out. The change itself came back 401; its refresh waited for the password
 * change to answer, which was waiting for that refresh. Only the network exchange may hold other refreshes back.
 */
describe('changing the password with an expired access token', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function openTab() {
    let accessValid = false; // the access token expired while the page sat open
    let refreshCookie = 'rt-1';
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      const sentRefresh = refreshCookie;
      const path = new URL(url, 'http://web').pathname.replace(/^\/v1/, '');
      calls.push(path);
      await new Promise((r) => setTimeout(r, 5));
      if (path === '/auth/refresh') {
        if (sentRefresh === 'revoked') return new Response('{}', { status: 401 });
        accessValid = true;
        refreshCookie = 'rt-2';
        return Response.json({ accessToken: '', user: { id: 'u1' } });
      }
      if (!accessValid) return Response.json({ code: 'UNAUTHORIZED' }, { status: 401 });
      if (path === '/auth/change-password') {
        refreshCookie = 'rt-3'; // the server replaces this device's cookies
        return Response.json({ message: 'Password changed' });
      }
      return Response.json({ ok: true });
    });
    const storage = new Map<string, string>();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    });
    vi.stubGlobal('navigator', {});
    vi.resetModules();
    const { request } = await import('./request');
    const { authApi } = await import('@/features/auth/api');
    const events = await import('./auth-events');
    const seen: string[] = [];
    events.onAuthEvent((e) => seen.push(e));
    return { request, authApi, calls, seen };
  }

  it('a password change sent with an expired access token refreshes, retries and succeeds', async () => {
    const { authApi, calls, seen } = await openTab();

    const change = authApi.changePassword({
      currentPassword: 'Old-pass1',
      newPassword: 'New-pass1',
      confirmPassword: 'New-pass1',
    } as Parameters<typeof authApi.changePassword>[0]);
    const settled = await Promise.race([
      change.then((r) => r.message),
      new Promise((r) => setTimeout(() => r('still waiting'), 1_000)),
    ]);

    expect(settled).toBe('Password changed');
    expect(calls).toEqual(['/auth/change-password', '/auth/refresh', '/auth/change-password']);
    expect(seen).not.toContain('SESSION_EXPIRED');
  });

  it('a request that fails during the change does not stop the change from answering', async () => {
    const { request, authApi, seen } = await openTab();

    const [change, other] = await Promise.all([
      authApi.changePassword({
        currentPassword: 'Old-pass1',
        newPassword: 'New-pass1',
        confirmPassword: 'New-pass1',
      } as Parameters<typeof authApi.changePassword>[0]),
      request<{ ok: boolean }>('/notifications/unread-count', { skipCache: true }),
    ]);

    expect(change.message).toBe('Password changed');
    expect(other.ok).toBe(true);
    expect(seen).not.toContain('SESSION_EXPIRED');
  });
});
