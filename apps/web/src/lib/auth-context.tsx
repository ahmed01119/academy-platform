'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type {
  LoginRequest,
  RegisterRequest,
  TenantMembershipSummary,
  UserSummary,
} from '@academy/shared';
import { api, setActiveTenantIdHeader } from './api-client';

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
      const resolvedActive =
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
    const res = await api.auth.login(data);
    applyAuthState(res);
  };

  const register = async (data: RegisterRequest) => {
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
