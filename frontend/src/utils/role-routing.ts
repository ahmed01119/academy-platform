import type { TenantMembershipSummary, UserSummary } from '@academy/shared';

/**
 * Returns the primary home route for a user based on their active role, profile, and tenant membership.
 * Enforces strict role landing segregation per SaaS architecture.
 */
export function getRoleHomeRoute(
  user: UserSummary | null | undefined,
  activeTenant: TenantMembershipSummary | null | undefined,
): string {
  if (!user) return '/login';

  // 1. Platform Super Admin must land in Platform Operations Console
  if (user.isPlatformSuperAdmin) {
    return '/platform';
  }

  // 2. Active Tenant Membership determines experience
  if (activeTenant && activeTenant.status === 'ACTIVE') {
    if (activeTenant.role === 'COACH') {
      return '/coach';
    }
    // Academy Owner, Manager, Branch Manager, Accountant, Receptionist
    if (
      activeTenant.role === 'OWNER' ||
      activeTenant.role === 'MANAGER' ||
      activeTenant.role === 'BRANCH_MANAGER' ||
      activeTenant.role === 'ACCOUNTANT' ||
      activeTenant.role === 'RECEPTIONIST'
    ) {
      return '/dashboard';
    }
  }

  // 3. Player Portal
  if (user.hasPlayerProfile) {
    return '/player';
  }

  // 4. Guardian Portal
  if (user.hasGuardianProfile) {
    return '/guardian';
  }

  // Default fallback for staff accounts without selected tenant or general dashboard
  return '/dashboard';
}

/**
 * Checks whether the current user is authorized to view administrative academy pages
 * (such as /players, /branches, /settings, /attendance/reports).
 * Strictly forbids Player, Guardian, and non-administrative Coach accounts from viewing admin controls.
 */
export function canAccessAdminRoutes(
  user: UserSummary | null | undefined,
  activeTenant: TenantMembershipSummary | null | undefined,
): boolean {
  if (!user) return false;
  if (user.isPlatformSuperAdmin) return true;

  if (!activeTenant || activeTenant.status !== 'ACTIVE') {
    return false;
  }

  const adminRoles = ['OWNER', 'MANAGER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'];
  return adminRoles.includes(activeTenant.role);
}

/**
 * Checks whether the current user is authorized to view Coach workspace (/coach).
 */
export function canAccessCoachRoutes(
  user: UserSummary | null | undefined,
  activeTenant: TenantMembershipSummary | null | undefined,
): boolean {
  if (!user) return false;
  if (user.isPlatformSuperAdmin) return true;

  if (!activeTenant || activeTenant.status !== 'ACTIVE') {
    return false;
  }

  const coachRoles = ['COACH', 'OWNER', 'MANAGER', 'BRANCH_MANAGER'];
  return coachRoles.includes(activeTenant.role);
}

/**
 * Checks whether the current user is authorized to view Player portal (/player).
 */
export function canAccessPlayerPortal(user: UserSummary | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.isPlatformSuperAdmin || user.hasPlayerProfile);
}

/**
 * Checks whether the current user is authorized to view Guardian portal (/guardian).
 */
export function canAccessGuardianPortal(user: UserSummary | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.isPlatformSuperAdmin || user.hasGuardianProfile);
}
