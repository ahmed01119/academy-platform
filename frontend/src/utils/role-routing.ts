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

  // 1. Platform Super Admin lands on Dashboard
  if (user.isPlatformSuperAdmin) {
    return '/dashboard';
  }

  // 2. Active Tenant Membership determines experience
  if (activeTenant && activeTenant.status === 'ACTIVE') {
    if (activeTenant.role === 'COACH') {
      return '/coach';
    }
    // Academy owner and admin (the retired roles no longer exist: owner decision 2026-11-24)
    if (activeTenant.role === 'OWNER' || activeTenant.role === 'MANAGER') {
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
 * Whether a signed-in user has a page of their own inside the app (platform staff, an active academy role, a player
 * or guardian profile). Such users never see the landing page: it sends them to their home (owner decision
 * 2026-11-27). A user with none of these (e.g. a join request still under review) keeps the landing page, the only
 * place they can apply from.
 */
export function hasSignedInHome(
  user: UserSummary | null | undefined,
  memberships: readonly TenantMembershipSummary[],
): boolean {
  if (!user) return false;
  return Boolean(
    user.isPlatformSuperAdmin ||
    user.isPlatformOwner ||
    user.hasPlayerProfile ||
    user.hasGuardianProfile ||
    memberships.some((m) => m.status === 'ACTIVE'),
  );
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

  // Academy staff with a dashboard: the owner and the admin.
  const adminRoles = ['OWNER', 'MANAGER'];
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

  const coachRoles = ['COACH', 'OWNER', 'MANAGER'];
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
