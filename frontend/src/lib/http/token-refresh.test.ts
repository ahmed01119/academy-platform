import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Two tabs (two separate module instances) share the browser's cookie jar, localStorage and Web Locks. The fake server
 * rotates the refresh token like the API does: a second use of an already-rotated token revokes the whole family.
 */
function createBrowser() {
  let cookieToken = 'rt-1';
  const revoked = new Set<string>();
  let familyRevoked = false;
  let rotations = 0;
  const storage = new Map<string, string>();

  let lockTail: Promise<unknown> = Promise.resolve();
  const locks = {
    request: (_name: string, task: () => Promise<unknown>) => {
      const run = lockTail.then(task, task);
      lockTail = run.catch(() => undefined);
      return run;
    },
  };

  const me = { user: { id: 'u1' }, activeTenant: null, memberships: [] };
  const fetchMock = vi.fn(async (url: string) => {
    const sent = cookieToken; // the cookie value at the moment the request leaves the browser
    await new Promise((r) => setTimeout(r, 5)); // network latency lets requests overlap
    if (url.endsWith('/auth/refresh')) {
      if (familyRevoked || revoked.has(sent)) {
        familyRevoked = true; // reuse detection
        return new Response('{"code":"UNAUTHORIZED"}', { status: 401 });
      }
      revoked.add(sent);
      rotations += 1;
      cookieToken = `rt-${rotations + 1}`;
      return Response.json({ accessToken: 'at', ...me });
    }
    if (url.endsWith('/auth/me')) {
      return familyRevoked ? new Response('{}', { status: 401 }) : Response.json(me);
    }
    return new Response('{}', { status: 404 });
  });

  return {
    fetchMock,
    locks,
    storage,
    state: () => ({ familyRevoked, rotations }),
  };
}

async function openTab() {
  vi.resetModules();
  return import('./token-refresh');
}

describe('executeSingleFlightTokenRefresh across tabs', () => {
  let browser: ReturnType<typeof createBrowser>;

  beforeEach(() => {
    browser = createBrowser();
    vi.stubGlobal('fetch', browser.fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => browser.storage.get(k) ?? null,
      setItem: (k: string, v: string) => void browser.storage.set(k, v),
      removeItem: (k: string) => void browser.storage.delete(k),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('two tabs refreshing at once keep the session (one rotation, no reuse)', async () => {
    vi.stubGlobal('navigator', { locks: browser.locks });
    const tabA = await openTab();
    const tabB = await openTab();

    const [a, b] = await Promise.all([
      tabA.executeSingleFlightTokenRefresh(),
      tabB.executeSingleFlightTokenRefresh(),
    ]);

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(browser.state()).toEqual({ familyRevoked: false, rotations: 1 });
  });

  it('documents the failure the lock prevents: without it the second tab trips reuse detection', async () => {
    vi.stubGlobal('navigator', {});
    const tabA = await openTab();
    const tabB = await openTab();

    const results = await Promise.all([
      tabA.executeSingleFlightTokenRefresh(),
      tabB.executeSingleFlightTokenRefresh(),
    ]);

    expect(results.filter((r) => r === null)).toHaveLength(1);
    expect(browser.state().familyRevoked).toBe(true);
  });

  it('a single tab still rotates normally and shares one request between concurrent callers', async () => {
    vi.stubGlobal('navigator', { locks: browser.locks });
    const tab = await openTab();

    const [a, b] = await Promise.all([
      tab.executeSingleFlightTokenRefresh(),
      tab.executeSingleFlightTokenRefresh(),
    ]);

    expect(a).toBe(b);
    expect(browser.state()).toEqual({ familyRevoked: false, rotations: 1 });
  });
});

describe('executeSingleFlightTokenRefresh on temporary failures (owner report: sudden sign-outs)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function tabWith(fetchImpl: () => Promise<Response>) {
    vi.stubGlobal('fetch', vi.fn(fetchImpl));
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    vi.stubGlobal('navigator', {});
    vi.resetModules();
    const tab = await import('./token-refresh');
    const events = await import('./auth-events');
    const seen: string[] = [];
    events.onAuthEvent((e) => seen.push(e));
    return { tab, seen };
  }

  it.each([
    ['a server error', () => Promise.resolve(new Response('{}', { status: 503 }))],
    ['a rate limit', () => Promise.resolve(new Response('{}', { status: 429 }))],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])(
    '%s keeps the session (no SESSION_EXPIRED) and reports a retryable error',
    async (_l, impl) => {
      const { tab, seen } = await tabWith(impl);
      await expect(tab.executeSingleFlightTokenRefresh()).rejects.toBeInstanceOf(
        tab.TransientRefreshError,
      );
      expect(seen).not.toContain('SESSION_EXPIRED');
    },
  );

  it('a refused refresh token still ends the session', async () => {
    const { tab, seen } = await tabWith(() => Promise.resolve(new Response('{}', { status: 401 })));
    await expect(tab.executeSingleFlightTokenRefresh()).resolves.toBeNull();
    expect(seen).toContain('SESSION_EXPIRED');
  });
});

/**
 * Owner report 2026-11-27: changing the password signed the owner out right after "password changed". The server
 * revokes every older token and answers the change with new cookies; a request already on its way with the old
 * cookie came back 401, its refresh sent the revoked refresh token, and the app ended the session it had just renewed.
 */
describe('executeSingleFlightTokenRefresh during a password change', () => {
  function createServer(changeLatencyMs: number) {
    let cookie = 'old';
    const fetchMock = vi.fn(async (url: string) => {
      const sent = cookie;
      if (url.endsWith('/auth/change-password')) {
        await new Promise((r) => setTimeout(r, changeLatencyMs));
        cookie = 'new';
        return Response.json({ message: 'ok' });
      }
      await new Promise((r) => setTimeout(r, 5));
      if (url.endsWith('/auth/refresh')) {
        // The old token was revoked by the change (not reuse): refused, the new session is left alone.
        return sent === 'new'
          ? Response.json({ accessToken: '', user: { id: 'u1' } })
          : new Response('{}', { status: 401 });
      }
      if (url.endsWith('/auth/me')) {
        return sent === 'new'
          ? Response.json({ user: { id: 'u1' } })
          : new Response('{}', { status: 401 });
      }
      return new Response('{}', { status: 404 });
    });
    return { fetchMock };
  }

  async function openTabWith(fetchMock: ReturnType<typeof vi.fn>) {
    const storage = new Map<string, string>();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    });
    vi.stubGlobal('navigator', {});
    vi.resetModules();
    const tab = await import('./token-refresh');
    const events = await import('./auth-events');
    const seen: string[] = [];
    events.onAuthEvent((e) => seen.push(e));
    return { tab, seen };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a refresh started while the change is answering waits for it and keeps the new session', async () => {
    const { fetchMock } = createServer(40);
    const { tab, seen } = await openTabWith(fetchMock);

    const change = tab.runSessionReplacement(() => fetch('/v1/auth/change-password'));
    const refresh = tab.executeSingleFlightTokenRefresh(); // the 401 of a request sent with the old cookie
    await change;

    await expect(refresh).resolves.not.toBeNull();
    expect(seen).not.toContain('SESSION_EXPIRED');
  });

  it('a refused refresh is not the end when the browser already holds newer cookies', async () => {
    const { fetchMock } = createServer(0);
    const { tab, seen } = await openTabWith(fetchMock);

    // The old refresh token leaves before the new cookies arrive; by the time it is refused they are there.
    const refresh = tab.executeSingleFlightTokenRefresh();
    await fetch('/v1/auth/change-password');

    await expect(refresh).resolves.not.toBeNull();
    expect(seen).not.toContain('SESSION_EXPIRED');
  });
});
