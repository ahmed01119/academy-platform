'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  canAccessAdminRoutes,
  canAccessCoachRoutes,
  canAccessPlayerPortal,
  canAccessGuardianPortal,
  getRoleHomeRoute,
} from '@/utils/role-routing';
import { Loader2 } from 'lucide-react';

export type RequiredPermission =
  'authenticated' | 'admin' | 'coach' | 'player' | 'guardian' | 'superadmin';

export interface AuthGuardProps {
  children: React.ReactNode;
  requiredPermission?: RequiredPermission;
  fallbackRoute?: string;
  loadingComponent?: React.ReactNode;
}

export function AuthGuard({
  children,
  requiredPermission = 'authenticated',
  fallbackRoute,
  loadingComponent,
}: AuthGuardProps) {
  const router = useRouter();
  const { user, activeTenant, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    let isAuthorized = true;

    switch (requiredPermission) {
      case 'superadmin':
        isAuthorized = Boolean(user.isPlatformSuperAdmin);
        break;
      case 'admin':
        isAuthorized = canAccessAdminRoutes(user, activeTenant);
        break;
      case 'coach':
        isAuthorized = canAccessCoachRoutes(user, activeTenant);
        break;
      case 'player':
        isAuthorized = canAccessPlayerPortal(user);
        break;
      case 'guardian':
        isAuthorized = canAccessGuardianPortal(user);
        break;
      case 'authenticated':
      default:
        isAuthorized = true;
        break;
    }

    if (!isAuthorized) {
      const destination = fallbackRoute || getRoleHomeRoute(user, activeTenant);
      router.push(destination);
    }
  }, [user, activeTenant, isLoading, requiredPermission, fallbackRoute, router]);

  if (isLoading || !user) {
    if (loadingComponent) return <>{loadingComponent}</>;

    return (
      <div className="min-h-screen flex items-center justify-center bg-(--bg-base) text-(--text-muted) animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-(--accent-primary)" />
          <span className="text-xs font-semibold tracking-wider uppercase opacity-75">
            Verifying Authorization...
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
