import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { api, setActiveTenantIdHeader, getActiveTenantIdHeader, ApiError } from './api-client';

describe('api-client', () => {
  beforeEach(() => {
    setActiveTenantIdHeader(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('manages active tenant ID header state', () => {
    expect(getActiveTenantIdHeader()).toBeNull();
    setActiveTenantIdHeader('tenant-uuid-123');
    expect(getActiveTenantIdHeader()).toBe('tenant-uuid-123');
    setActiveTenantIdHeader(null);
    expect(getActiveTenantIdHeader()).toBeNull();
  });

  it('handles successful auth.refresh and updates active tenant', async () => {
    const mockAuthResponse = {
      user: {
        id: 'u1',
        email: 'user@example.com',
        name: 'Test User',
        isEmailVerified: true,
      },
      activeTenant: {
        tenantId: 'tenant-active-456',
        tenantName: 'Active Academy',
        role: 'OWNER',
        status: 'ACTIVE',
      },
      memberships: [],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockAuthResponse,
    } as Response);

    const res = await api.auth.refresh();
    expect(res).toEqual(mockAuthResponse);
    expect(getActiveTenantIdHeader()).toBe('tenant-active-456');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
  });

  it('switches tenant and attaches x-tenant-id to subsequent requests', async () => {
    const mockSwitchResponse = {
      tenantId: 'switched-tenant-789',
      tenantName: 'Switched Academy',
      role: 'ADMIN',
      status: 'ACTIVE',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockSwitchResponse,
    } as Response);

    const res = await api.tenancy.switchTenant('switched-tenant-789');
    expect(res).toEqual(mockSwitchResponse);
    expect(getActiveTenantIdHeader()).toBe('switched-tenant-789');

    // Make another request and verify x-tenant-id is attached
    await api.tenancy.listBranches();
    expect(fetchSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('/tenants/branches'),
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const lastHeaders = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1][1]?.headers as Headers;
    expect(lastHeaders.get('x-tenant-id')).toBe('switched-tenant-789');
  });

  it('clears active tenant ID on logout', async () => {
    setActiveTenantIdHeader('tenant-to-clear');
    expect(getActiveTenantIdHeader()).toBe('tenant-to-clear');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'Logged out' }),
    } as Response);

    await api.auth.logout();
    expect(getActiveTenantIdHeader()).toBeNull();
  });

  it('throws structured ApiError on non-ok responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      }),
    } as Response);

    await expect(api.auth.login({ email: 'bad@example.com', password: 'wrong' })).rejects.toThrow(
      ApiError,
    );
  });

  it('calls branches.list and branches.create correctly', async () => {
    const mockBranches = [
      { id: 'b1', name: 'فرع المعادي', code: 'MAADI', status: 'ACTIVE', _count: { players: 10 } },
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockBranches,
    } as Response);

    const list = await api.branches.list({ search: 'معادي', status: 'ACTIVE' });
    expect(list).toEqual(mockBranches);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/branches?search=%D9%85%D8%B9%D8%A7%D8%AF%D9%8A&status=ACTIVE'),
      expect.objectContaining({ method: 'GET' }),
    );

    const newBranch = { name: 'فرع التجمع', city: 'القاهرة' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 'b2', ...newBranch }),
    } as Response);

    const created = await api.branches.create(newBranch);
    expect(created.id).toBe('b2');
  });

  it('calls players.list and players.get correctly', async () => {
    const mockPlayers = {
      items: [{ id: 'p1', firstName: 'كريم', lastName: 'حسام', status: 'ACTIVE' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockPlayers,
    } as Response);

    const result = await api.players.list({ search: 'كريم', page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/players?search=%D9%83%D8%B1%D9%8A%D9%85&page=1&limit=20'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('calls enrollments.transfer and tenancy.getProfile correctly', async () => {
    const mockTransfer = { id: 'e1', branchId: 'b2', status: 'ACTIVE' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockTransfer,
    } as Response);

    const transferred = await api.enrollments.transfer('e1', {
      targetBranchId: 'b2',
      notes: 'نقل فرع',
    });
    expect(transferred.branchId).toBe('b2');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/enrollments/e1/transfer'),
      expect.objectContaining({ method: 'POST' }),
    );

    const mockProfile = { id: 't1', name: 'أكاديمية النجوم', slug: 'stars' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockProfile,
    } as Response);

    const profile = await api.tenancy.getProfile();
    expect(profile.name).toBe('أكاديمية النجوم');
  });

  it('performs single-flight refresh on concurrent 401 responses and retries both requests', async () => {
    let refreshCallCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        // Small delay to simulate async network roundtrip
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            user: { id: 'u1', email: 'test@example.com' },
            activeTenant: { tenantId: 'refreshed-tenant-123', status: 'ACTIVE' },
            memberships: [],
          }),
        } as Response;
      }

      if (url.includes('/branches')) {
        // If not retried yet, simulate expired access token (401)
        if (refreshCallCount === 0) {
          return {
            ok: false,
            status: 401,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ message: 'Token expired' }),
          } as Response;
        }
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => [{ id: 'b1', name: 'Branch 1' }],
        } as Response;
      }

      if (url.includes('/players')) {
        if (refreshCallCount === 0) {
          return {
            ok: false,
            status: 401,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ message: 'Token expired' }),
          } as Response;
        }
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ items: [{ id: 'p1', firstName: 'Sami' }], total: 1 }),
        } as Response;
      }

      return {
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      } as Response;
    });

    // Fire two concurrent requests while access token is expired
    const [branchesRes, playersRes] = await Promise.all([
      api.branches.list(),
      api.players.list(),
    ]);

    expect(branchesRes).toHaveLength(1);
    expect(playersRes.items).toHaveLength(1);
    // EXACTLY one refresh call must have occurred despite 2 concurrent 401s
    expect(refreshCallCount).toBe(1);
  });

  it('fetches storage metrics successfully via platform.getStorageMetrics', async () => {
    const mockStorageMetrics = {
      databaseSizeBytes: 13596351,
      formattedDatabaseSize: '13 MB',
      totalTables: 34,
      tables: [],
      auditLogsCount: 376,
      auditLogsSizeBytes: 237568,
      mediaStorageBytes: 0,
      cacheStatus: 'IN_MEMORY',
      redisAvailable: false,
      estimatedMonthlyGrowthBytes: 664000,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockStorageMetrics,
    } as Response);

    const result = await api.platform.getStorageMetrics();
    expect(result).toEqual(mockStorageMetrics);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/platform/storage/metrics'),
      expect.objectContaining({ method: 'GET' }),
    );
  });
  it('accepts an academy invitation and updates active tenant header', async () => {
    const mockAcceptResponse = {
      message: 'Successfully joined Stars Academy',
      tenantId: 'tenant-accepted-999',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockAcceptResponse,
    } as Response);

    const result = await api.tenancy.acceptInvitation({ token: 'invitation-token-123' });
    expect(result).toEqual(mockAcceptResponse);
    expect(getActiveTenantIdHeader()).toBe('tenant-accepted-999');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/tenants/invitations/accept'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'invitation-token-123' }),
      }),
    );
  });

  it('submits email verification request via api.auth.verifyEmail', async () => {
    const mockResponse = { message: 'Email address verified successfully' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    } as Response);

    const result = await api.auth.verifyEmail('token-xyz-456');
    expect(result).toEqual(mockResponse);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/verify-email'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'token-xyz-456' }),
      }),
    );
  });

  it('resends email verification request via api.auth.resendVerification', async () => {
    const mockResponse = { message: 'Verification email sent' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    } as Response);

    const result = await api.auth.resendVerification('user@sportexus.com');
    expect(result).toEqual(mockResponse);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/resend-verification'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@sportexus.com' }),
      }),
    );
  });
});
