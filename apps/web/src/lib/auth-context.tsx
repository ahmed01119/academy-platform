'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import type {
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  TenantMembershipSummary,
  UserSummary,
} from '@academy/shared';
import {
  api,
  setActiveTenantIdHeader,
  getActiveTenantIdHeader,
  onAuthEvent,
  ApiError,
} from './api-client';
import { offlineEngine } from './offline-engine';

export type AuthState =
  | 'INITIALIZING'
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'REFRESHING'
  | 'SIGNING_OUT'
  | 'ERROR';

export interface AuthContextValue {
  authState: AuthState;
  isLoading: boolean;
  user: UserSummary | null;
  activeTenant: TenantMembershipSummary | null;
  memberships: TenantMembershipSummary[];
  error: string | null;
  login: (data: LoginRequest) => Promise<{ user: UserSummary; activeTenant: TenantMembershipSummary | null }>;
  register: (data: RegisterRequest) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  refreshToken: (token?: string) => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const BROADCAST_CHANNEL_NAME = 'sportexus_auth_sync';
const LOCAL_STORAGE_SYNC_KEY = 'sportexus_auth_sync_event';

interface AuthSyncPayload {
  type: 'LOGIN' | 'LOGOUT' | 'TENANT_SWITCH';
  tenantId?: string;
  timestamp: number;
}

function broadcastAuthSync(payload: AuthSyncPayload): void {
  if (typeof window === 'undefined') return;
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // Ignore channel broadcast error
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_SYNC_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write error
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('INITIALIZING');
  const [user, setUser] = useState<UserSummary | null>(null);
  const [activeTenant, setActiveTenant] = useState<TenantMembershipSummary | null>(null);
  const [memberships, setMemberships] = useState<TenantMembershipSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isRefreshingRef = useRef(false);

  const applyAuthState = useCallback(
    (data: {
      user: UserSummary;
      activeTenant?: TenantMembershipSummary | null;
      memberships: TenantMembershipSummary[];
    }) => {
      const activeMemberships = data.memberships.filter((m) => m.status === 'ACTIVE');
      const cachedTenantId = getActiveTenantIdHeader();

      // Maintain consistency:
      // 1. If user previously selected a tenant that is still an ACTIVE membership, keep it!
      // 2. Otherwise use server-provided active tenant if valid.
      // 3. Otherwise fall back to first active membership or null.
      const resolvedActive =
        (cachedTenantId ? activeMemberships.find((m) => m.tenantId === cachedTenantId) : null) ??
        (data.activeTenant && data.activeTenant.status === 'ACTIVE'
          ? activeMemberships.find((m) => m.tenantId === data.activeTenant?.tenantId)
          : null) ??
        activeMemberships[0] ??
        null;

      setUser(data.user);
      setActiveTenant(resolvedActive);
      setMemberships(activeMemberships);
      setAuthState('AUTHENTICATED');
      setError(null);

      if (resolvedActive?.tenantId) {
        setActiveTenantIdHeader(resolvedActive.tenantId);
      } else {
        setActiveTenantIdHeader(null);
      }
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      setAuthState((prev) => (prev === 'AUTHENTICATED' ? 'REFRESHING' : prev));
      const data = await api.auth.getMe();
      applyAuthState(data);
    } catch (err: unknown) {
      setUser(null);
      setActiveTenant(null);
      setMemberships([]);
      setActiveTenantIdHeader(null);
      setAuthState('UNAUTHENTICATED');
      if (err instanceof ApiError && err.statusCode !== 401) {
        setError(err.message);
      }
    } finally {
      isRefreshingRef.current = false;
    }
  }, [applyAuthState]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  // Cross-tab synchronization and session-expiration listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSyncPayload = (payload: AuthSyncPayload) => {
      if (payload.type === 'LOGOUT') {
        setUser(null);
        setActiveTenant(null);
        setMemberships([]);
        setActiveTenantIdHeader(null);
        setAuthState('UNAUTHENTICATED');
        setError(null);
        void offlineEngine.purgeAll().catch(() => undefined);
      } else if (payload.type === 'LOGIN' || payload.type === 'TENANT_SWITCH') {
        void refreshUser();
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        channel.onmessage = (event: MessageEvent<AuthSyncPayload>) => {
          if (event.data && event.data.type) {
            handleSyncPayload(event.data);
          }
        };
      }
    } catch {
      // Fallback to storage
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_SYNC_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as AuthSyncPayload;
          handleSyncPayload(parsed);
        } catch {
          // Ignore parse error
        }
      }
    };

    window.addEventListener('storage', onStorage);

    // Also listen to session expiration emitted by api-client (e.g. refresh token expired)
    const unsubscribeAuthEvents = onAuthEvent((event) => {
      if (event === 'SESSION_EXPIRED') {
        setUser(null);
        setActiveTenant(null);
        setMemberships([]);
        setActiveTenantIdHeader(null);
        setAuthState('UNAUTHENTICATED');
      }
    });

    return () => {
      if (channel) {
        channel.close();
      }
      window.removeEventListener('storage', onStorage);
      unsubscribeAuthEvents();
    };
  }, [refreshUser]);

  const login = async (data: LoginRequest) => {
    setActiveTenantIdHeader(null);
    const res = await api.auth.login(data);
    applyAuthState(res);

    const activeMemberships = res.memberships.filter((m) => m.status === 'ACTIVE');
    const resolved =
      (res.activeTenant && res.activeTenant.status === 'ACTIVE' ? res.activeTenant : null) ??
      activeMemberships[0] ??
      null;

    broadcastAuthSync({ type: 'LOGIN', timestamp: Date.now() });

    return { user: res.user, activeTenant: resolved };
  };

  const register = async (data: RegisterRequest): Promise<RegisterResponse> => {
    setActiveTenantIdHeader(null);
    const res = await api.auth.register(data);

    if (res.status === 'APPROVED' && res.user && res.memberships) {
      applyAuthState({
        user: res.user,
        activeTenant: res.activeTenant,
        memberships: res.memberships,
      });
      broadcastAuthSync({ type: 'LOGIN', timestamp: Date.now() });
    }

    return res;
  };

  const logout = async () => {
    setAuthState('SIGNING_OUT');
    try {
      await api.auth.logout();
    } catch {
      // Ignore network error during logout to ensure client cleanup
    } finally {
      setUser(null);
      setActiveTenant(null);
      setMemberships([]);
      setActiveTenantIdHeader(null);
      setAuthState('UNAUTHENTICATED');
      setError(null);
      await offlineEngine.purgeAll().catch(() => undefined);
      broadcastAuthSync({ type: 'LOGOUT', timestamp: Date.now() });
    }
  };

  const refreshToken = async (token?: string) => {
    const res = await api.auth.refresh(token);
    applyAuthState(res);
  };

  const switchTenant = async (tenantId: string) => {
    const updatedMembership = await api.tenancy.switchTenant(tenantId);
    if (updatedMembership.status === 'ACTIVE') {
      setActiveTenant(updatedMembership);
      setActiveTenantIdHeader(tenantId);
      broadcastAuthSync({ type: 'TENANT_SWITCH', tenantId, timestamp: Date.now() });
    } else {
      setActiveTenant(null);
      setActiveTenantIdHeader(null);
    }
    await refreshUser();
  };

  const isLoading = authState === 'INITIALIZING' || authState === 'REFRESHING';

  const value = useMemo(
    () => ({
      authState,
      isLoading,
      user,
      activeTenant,
      memberships,
      error,
      login,
      register,
      logout,
      refreshToken,
      switchTenant,
      refreshUser,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authState, isLoading, user, activeTenant, memberships, error, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
