'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type {
  LoginRequest,
  RegisterRequest,
  TenantMembershipSummary,
  UserSummary,
} from '@academy/shared';
import { api, setActiveTenantIdHeader, getActiveTenantIdHeader } from './api-client';
import { offlineEngine } from './offline-engine';

interface AuthContextValue {
  user: UserSummary | null;
  activeTenant: TenantMembershipSummary | null;
  memberships: TenantMembershipSummary[];
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: (token?: string) => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [activeTenant, setActiveTenant] = useState<TenantMembershipSummary | null>(null);
  const [memberships, setMemberships] = useState<TenantMembershipSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      if (resolvedActive?.tenantId) {
        setActiveTenantIdHeader(resolvedActive.tenantId);
      } else {
        setActiveTenantIdHeader(null);
      }
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.auth.getMe();
      applyAuthState(data);
    } catch {
      setUser(null);
      setActiveTenant(null);
      setMemberships([]);
      setActiveTenantIdHeader(null);
    } finally {
      setIsLoading(false);
    }
  }, [applyAuthState]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = async (data: LoginRequest) => {
    setActiveTenantIdHeader(null);
    const res = await api.auth.login(data);
    applyAuthState(res);
  };

  const register = async (data: RegisterRequest) => {
    setActiveTenantIdHeader(null);
    const res = await api.auth.register(data);
    applyAuthState(res);
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
      setActiveTenant(null);
      setMemberships([]);
      setActiveTenantIdHeader(null);
      await offlineEngine.purgeAll().catch(() => undefined);
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
    } else {
      setActiveTenant(null);
      setActiveTenantIdHeader(null);
    }
    await refreshUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeTenant,
        memberships,
        isLoading,
        login,
        register,
        logout,
        refreshToken,
        switchTenant,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
