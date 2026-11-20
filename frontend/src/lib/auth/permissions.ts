import {
  hasPermission,
  Permission,
  type TenantMembershipSummary,
  type TenantRole,
  type UserSummary,
} from '@academy/shared';

/**
 * What the signed-in user may do in the active academy, from the same RBAC matrix the API enforces
 * (`ROLE_PERMISSIONS`, documented in docs/security/ROLE_PERMISSION_MATRIX.md).
 *
 * Use it to decide what to SHOW (menu items, pages, buttons). It is never a security boundary: every request is
 * authorized again by the API (PermissionsGuard), so hiding something here only spares the user a 403.
 *
 *  - Platform super admins / owners: allowed (they reach academies through the platform console).
 *  - Academy members: their role's permissions; a COACH also reviews join requests when the membership is delegated
 *    (`canReviewApplications`), exactly like PermissionsGuard.
 *  - Players, guardians, signed-out users: no academy permissions.
 */
export function can(
  user: UserSummary | null | undefined,
  activeTenant: TenantMembershipSummary | null | undefined,
  permission: Permission,
): boolean {
  if (!user) return false;
  if (user.isPlatformSuperAdmin || user.isPlatformOwner) return true;
  if (!activeTenant || activeTenant.status !== 'ACTIVE') return false;
  const role = activeTenant.role as TenantRole;
  if (
    permission === Permission.PLAYER_APPLICATION_REVIEW &&
    role === 'COACH' &&
    Boolean(activeTenant.canReviewApplications)
  ) {
    return true;
  }
  return hasPermission(role, permission);
}

/** True when the user holds at least one of the permissions. */
export function canAny(
  user: UserSummary | null | undefined,
  activeTenant: TenantMembershipSummary | null | undefined,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => can(user, activeTenant, permission));
}

/** True when the user holds every one of the permissions (a page whose data needs two permissions). */
export function canAll(
  user: UserSummary | null | undefined,
  activeTenant: TenantMembershipSummary | null | undefined,
  permissions: readonly Permission[],
): boolean {
  return permissions.every((permission) => can(user, activeTenant, permission));
}
