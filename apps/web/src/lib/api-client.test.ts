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
});
