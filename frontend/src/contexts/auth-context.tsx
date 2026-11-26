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
} from '../api/client';
import { offlineEngine } from '../utils/offline-engine';

export type AuthState =
  'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'REFRESHING' | 'SIGNING_OUT' | 'ERROR';

export interface AuthContextValue {
  authState: AuthState;
  isLoading: boolean;
  user: UserSummary | null;
  activeTenant: TenantMembershipSummary | null;
  memberships: TenantMembershipSummary[];
  error: string | null;
  login: (
    data: LoginRequest,
  ) => Promise<{ user: UserSummary; activeTenant: TenantMembershipSummary | null }>;
  register: (data: RegisterRequest) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  refreshToken: (token?: string) => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const BROADCAST_CHANNEL_NAME = 'sportexus_auth_sync';
const LOCAL_STORAGE_SYNC_KEY = 'sportexus_auth_sync_event';
const TAB_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2);

function getInitialStoredSession(): {
  hasSession: boolean;
  cachedUser: UserSummary | null;
} {
  if (typeof window === 'undefined') {
    return { hasSession: false, cachedUser: null };
  }
  try {
    const isAuthRoute =
      window.location.pathname === '/login' ||
      window.location.pathname === '/register' ||
      window.location.pathname === '/reset-password';

    if (isAuthRoute) {
      return { hasSession: false, cachedUser: null };
    }

    // The access token lasts 15 minutes and is renewed by the refresh cookie on the next request, so its expiry
    // says nothing about the session: only the server decides (GET /auth/me, refreshed on 401).
    const hasSession = localStorage.getItem('sportexus_has_session') === 'true';
    if (!hasSession) {
      return { hasSession: false, cachedUser: null };
    }

    const cachedUserStr = localStorage.getItem('sportexus_auth_user');
    const cachedUser = cachedUserStr ? (JSON.parse(cachedUserStr) as UserSummary) : null;
    return { hasSession: true, cachedUser };
  } catch {
    return { hasSession: false, cachedUser: null };
  }
}

interface AuthSyncPayload {
  type: 'LOGIN' | 'LOGOUT' | 'TENANT_SWITCH';
  tenantId?: string;
  sourceTabId?: string;
  timestamp: number;
}

function broadcastAuthSync(payload: AuthSyncPayload): void {
  if (typeof window === 'undefined') return;
  const enriched: AuthSyncPayload = { ...payload, sourceTabId: TAB_ID };
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage(enriched);
      channel.close();
    }
  } catch {
    // Ignore channel broadcast error
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_SYNC_KEY, JSON.stringify(enriched));
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

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('sportexus_has_session', 'true');
          localStorage.setItem('sportexus_auth_user', JSON.stringify(data.user));
        } catch {
          // Ignore
        }
      }

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
      const sessionRefused =
        err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403);
      if (!sessionRefused) {
        // Offline, a slow database or a server error: keep the user signed in; the next request retries.
        setAuthState((prev) => (prev === 'REFRESHING' ? 'AUTHENTICATED' : prev));
        if (err instanceof ApiError) setError(err.message);
        return;
      }
      setUser(null);
      setActiveTenant(null);
      setMemberships([]);
      setActiveTenantIdHeader(null);
      setAuthState('UNAUTHENTICATED');
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('sportexus_has_session');
          localStorage.removeItem('sportexus_auth_expiry');
          localStorage.removeItem('sportexus_auth_user');
        } catch {
          // Ignore
        }
      }
      if (err instanceof ApiError && err.statusCode !== 401) {
        setError(err.message);
      }
    } finally {
      isRefreshingRef.current = false;
    }
  }, [applyAuthState]);

  useEffect(() => {
    const session = getInitialStoredSession();
    if (session.hasSession && session.cachedUser) {
      setUser(session.cachedUser);
      setAuthState('AUTHENTICATED');
      void refreshUser();
    } else {
      setAuthState('UNAUTHENTICATED');
    }
  }, [refreshUser]);

  // Cross-tab synchronization and session-expiration listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSyncPayload = (payload: AuthSyncPayload) => {
      // Ignore broadcast events originating from the current tab to prevent duplicate requests
      if (payload.sourceTabId === TAB_ID) return;

      if (payload.type === 'LOGOUT') {
        setUser(null);
        setActiveTenant(null);
        setMemberships([]);
        setActiveTenantIdHeader(null);
        setAuthState('UNAUTHENTICATED');
        setError(null);
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('sportexus_has_session');
            localStorage.removeItem('sportexus_auth_expiry');
            localStorage.removeItem('sportexus_auth_user');
          } catch {
            // Ignore
          }
        }
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

    // Save token duration and session flags in storage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('sportexus_has_session', 'true');
        localStorage.removeItem('sportexus_auth_expiry');
        localStorage.setItem('sportexus_auth_user', JSON.stringify(res.user));
      } catch {
        // Ignore storage error
      }
    }

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
    // 1. Immediately wipe local auth state synchronously with zero delay
    setUser(null);
    setActiveTenant(null);
    setMemberships([]);
    setActiveTenantIdHeader(null);
    setAuthState('UNAUTHENTICATED');
    setError(null);

    // 2. Clear local/session storage & purge offline sync cache
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('academy_active_tenant_id');
        localStorage.removeItem('sportexus_auth_user');
        localStorage.removeItem('sportexus_has_session');
        localStorage.removeItem('sportexus_auth_expiry');
        sessionStorage.clear();
      } catch {
        // Ignore storage access errors
      }
    }
    offlineEngine.purgeAll().catch(() => undefined);
    broadcastAuthSync({ type: 'LOGOUT', timestamp: Date.now() });

    // 3. Fire-and-forget network revocation
    const revokePromise = api.auth.logout().catch(() => undefined);

    // 4. Immediately redirect replacing current history entry to prevent back-button access
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }

    await revokePromise;
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
