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
