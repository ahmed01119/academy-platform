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

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.auth.getMe();
      setUser(data.user);
      setActiveTenant(data.activeTenant ?? data.memberships[0] ?? null);
      setMemberships(data.memberships);
      if (data.activeTenant?.tenantId) {
        setActiveTenantIdHeader(data.activeTenant.tenantId);
      }
    } catch {
      setUser(null);
      setActiveTenant(null);
      setMemberships([]);
      setActiveTenantIdHeader(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = async (data: LoginRequest) => {
    const res = await api.auth.login(data);
    setUser(res.user);
    setActiveTenant(res.activeTenant ?? res.memberships[0] ?? null);
    setMemberships(res.memberships);
    if (res.activeTenant?.tenantId) {
      setActiveTenantIdHeader(res.activeTenant.tenantId);
    }
  };

  const register = async (data: RegisterRequest) => {
    const res = await api.auth.register(data);
    setUser(res.user);
    setActiveTenant(res.activeTenant ?? res.memberships[0] ?? null);
    setMemberships(res.memberships);
    if (res.activeTenant?.tenantId) {
      setActiveTenantIdHeader(res.activeTenant.tenantId);
    }
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
    setUser(res.user);
    setActiveTenant(res.activeTenant ?? res.memberships[0] ?? null);
    setMemberships(res.memberships);
    if (res.activeTenant?.tenantId) {
      setActiveTenantIdHeader(res.activeTenant.tenantId);
    }
  };

  const switchTenant = async (tenantId: string) => {
    const updatedMembership = await api.tenancy.switchTenant(tenantId);
    setActiveTenant(updatedMembership);
    setActiveTenantIdHeader(tenantId);
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
