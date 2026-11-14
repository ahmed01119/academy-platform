import type { TenantMembershipSummary, UserSummary } from '@academy/shared';
import { canAccessAdminRoutes, canAccessCoachRoutes, getRoleHomeRoute } from '@/utils/role-routing';

/**
 * Client-side page access rules. These are UX redirects only — every endpoint is
 * authorized again by the API (JwtAuthGuard / TenantGuard / PermissionsGuard).
 *
 * Each rule reproduces, exactly, the redirect logic that pages previously
 * implemented inline (see docs/DEVELOPMENT_STATUS.md, Phase 1 Step 2).
 */
export type AccessRule =
  /** Any signed-in user. Signed out → /login. */
  | 'authenticated'
  /** Academy staff with admin pages (`canAccessAdminRoutes`). Otherwise → role home. */
  | 'admin'
  /** Admin pages OR coach workspace (`canAccessAdminRoutes || canAccessCoachRoutes`). */
  | 'admin-or-coach'
  /** Signed-in users except the COACH role (coaches may not record attendance) → /attendance. */
  | 'no-coach'
  /** Platform Super Admin or Platform Owner. Anyone else (incl. signed out) → /dashboard. */
  | 'platform-staff';

export interface AccessState {
  isLoading: boolean;
  user: UserSummary | null;
  activeTenant: TenantMembershipSummary | null;
}

export type AccessDecision =
  /** Auth is still resolving — never redirect yet. */
  | { status: 'pending' }
  | { status: 'allowed' }
  | {
      status: 'redirect';
      to: string;
      /** `unauthenticated`: no session. `forbidden`: signed in but not allowed here. */
      reason: 'unauthenticated' | 'forbidden';
    };

const LOGIN_ROUTE = '/login';
const ATTENDANCE_ROUTE = '/attendance';
const DASHBOARD_ROUTE = '/dashboard';

export function resolveAccess(rule: AccessRule, state: AccessState): AccessDecision {
  const { isLoading, user, activeTenant } = state;

  if (isLoading) return { status: 'pending' };

  if (rule === 'platform-staff') {
    const isPlatformStaff = Boolean(user?.isPlatformSuperAdmin || user?.isPlatformOwner);
    return isPlatformStaff
      ? { status: 'allowed' }
      : { status: 'redirect', to: DASHBOARD_ROUTE, reason: user ? 'forbidden' : 'unauthenticated' };
  }

  if (!user) return { status: 'redirect', to: LOGIN_ROUTE, reason: 'unauthenticated' };

  switch (rule) {
    case 'authenticated':
      return { status: 'allowed' };

    case 'admin':
      return canAccessAdminRoutes(user, activeTenant)
        ? { status: 'allowed' }
        : { status: 'redirect', to: getRoleHomeRoute(user, activeTenant), reason: 'forbidden' };

    case 'admin-or-coach':
      return canAccessAdminRoutes(user, activeTenant) || canAccessCoachRoutes(user, activeTenant)
        ? { status: 'allowed' }
        : { status: 'redirect', to: getRoleHomeRoute(user, activeTenant), reason: 'forbidden' };

    case 'no-coach':
      return activeTenant?.role === 'COACH'
        ? { status: 'redirect', to: ATTENDANCE_ROUTE, reason: 'forbidden' }
        : { status: 'allowed' };
  }
}
