import { z } from 'zod';

export const TenantRole = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  BRANCH_MANAGER: 'BRANCH_MANAGER',
  RECEPTIONIST: 'RECEPTIONIST',
  COACH: 'COACH',
  ACCOUNTANT: 'ACCOUNTANT',
  VIEWER: 'VIEWER',
} as const;

export type TenantRole = (typeof TenantRole)[keyof typeof TenantRole];

export const TenantRoleSchema = z.nativeEnum(TenantRole);

/**
 * The academy roles in use (owner decision 2026-11-24): OWNER (everything, money included), MANAGER (the admin: sporting
 * side and staff, no money) and COACH (own groups only). BRANCH_MANAGER, RECEPTIONIST, ACCOUNTANT and VIEWER are retired:
 * they remain in the database enum but nobody holds them and they cannot be assigned.
 */
export const ACTIVE_TENANT_ROLES = [
  TenantRole.OWNER,
  TenantRole.MANAGER,
  TenantRole.COACH,
] as const;
export const ActiveTenantRoleSchema = z.enum(ACTIVE_TENANT_ROLES);
export type ActiveTenantRole = z.infer<typeof ActiveTenantRoleSchema>;

export const MembershipStatus = {
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  REVOKED: 'REVOKED',
} as const;

export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const MembershipStatusSchema = z.nativeEnum(MembershipStatus);

export const InvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const;

export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

export const InvitationStatusSchema = z.nativeEnum(InvitationStatus);

export const Permission = {
  TENANT_UPDATE: 'tenant.update',
  BRANCHES_MANAGE: 'branches.manage',
  BRANCHES_READ: 'branches.read',
  STAFF_MANAGE: 'staff.manage',
  STAFF_READ: 'staff.read',
  PLAYERS_READ: 'players.read',
  PLAYERS_CREATE: 'players.create',
  PLAYERS_UPDATE: 'players.update',
  PLAYERS_DELETE: 'players.delete',
  PLAYERS_SENSITIVE_READ: 'players.sensitive.read',
  ATTENDANCE_READ: 'attendance.read',
  ATTENDANCE_MARK: 'attendance.mark',
  ATTENDANCE_CORRECT: 'attendance.correct',
  ATTENDANCE_CLOSE: 'attendance.close',
  PAYMENTS_READ: 'payments.read',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_REFUND: 'payments.refund',
  REPORTS_READ: 'reports.read',
  GROUPS_READ: 'groups.read',
  GROUPS_MANAGE: 'groups.manage',
  SESSIONS_READ: 'sessions.read',
  SESSIONS_MANAGE: 'sessions.manage',
  EVALUATIONS_READ: 'evaluations.read',
  EVALUATIONS_CREATE: 'evaluations.create',
  EVALUATIONS_MANAGE: 'evaluations.manage',
  SESSION_EXPENSES_READ: 'session_expenses.read',
  SESSION_EXPENSES_CREATE: 'session_expenses.create',
  SESSION_EXPENSES_APPROVE: 'session_expenses.approve',
  /** Close (reconcile) a session's cashier; a closed cashier cannot be closed again (K8). */
  SESSION_CASHIER_CLOSE: 'session_cashier.close',
  PLATFORM_MANAGE: 'platform.manage',
  PLAYER_APPLICATION_REVIEW: 'player.application.review',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const PermissionSchema = z.nativeEnum(Permission);

/**
 * Tenant RBAC matrix. Source of truth: docs/security/ROLE_PERMISSION_MATRIX.md (owner decisions 2026-11-16 and
 * 2026-11-24), plus `session_cashier.close` (K8). The API enforces it (PermissionsGuard); the web app uses the same map to decide what each
 * role sees, so a role is never shown a page or button it cannot use.
 *
 * Narrower rules that a permission alone cannot express are enforced in the services:
 *  - COACH: only their own groups, those groups' sessions and active players (common/coach-scope.ts in the API);
 *    `attendance.mark` only for sessions the coach is assigned to (session coach or group coach);
 *  - COACH `player.application.review`: only when the membership has `canReviewApplications` (PermissionsGuard);
 *  - COACH: pinned to their branch (TenantGuard).
 */
export const ROLE_PERMISSIONS: Record<TenantRole, readonly Permission[]> = {
  // Academy owner: everything in the academy.
  [TenantRole.OWNER]: [
    Permission.TENANT_UPDATE,
    Permission.BRANCHES_MANAGE,
    Permission.BRANCHES_READ,
    Permission.STAFF_MANAGE,
    Permission.STAFF_READ,
    Permission.PLAYERS_READ,
    Permission.PLAYERS_CREATE,
    Permission.PLAYERS_UPDATE,
    Permission.PLAYERS_DELETE,
    Permission.PLAYERS_SENSITIVE_READ,
    Permission.PLAYER_APPLICATION_REVIEW,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_MARK,
    Permission.ATTENDANCE_CORRECT,
    Permission.ATTENDANCE_CLOSE,
    Permission.PAYMENTS_READ,
    Permission.PAYMENTS_CREATE,
    Permission.PAYMENTS_REFUND,
    Permission.SESSION_EXPENSES_READ,
    Permission.SESSION_EXPENSES_CREATE,
    Permission.SESSION_EXPENSES_APPROVE,
    Permission.SESSION_CASHIER_CLOSE,
    Permission.REPORTS_READ,
    Permission.GROUPS_READ,
    Permission.GROUPS_MANAGE,
    Permission.SESSIONS_READ,
    Permission.SESSIONS_MANAGE,
    Permission.EVALUATIONS_READ,
    Permission.EVALUATIONS_CREATE,
    Permission.EVALUATIONS_MANAGE,
  ],
  // Admin (إداري, owner decision 2026-11-24): runs the sporting side (branches, groups, players, sessions, attendance,
  // evaluations, join requests) and the staff; no money at all (payments, refunds, session expenses and the cashier are
  // the owner's), and not the academy profile.
  [TenantRole.MANAGER]: [
    Permission.BRANCHES_MANAGE,
    Permission.BRANCHES_READ,
    Permission.STAFF_MANAGE,
    Permission.STAFF_READ,
    Permission.PLAYERS_READ,
    Permission.PLAYERS_CREATE,
    Permission.PLAYERS_UPDATE,
    Permission.PLAYERS_DELETE,
    Permission.PLAYERS_SENSITIVE_READ,
    Permission.PLAYER_APPLICATION_REVIEW,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_MARK,
    Permission.ATTENDANCE_CORRECT,
    Permission.ATTENDANCE_CLOSE,
    Permission.REPORTS_READ,
    Permission.GROUPS_READ,
    Permission.GROUPS_MANAGE,
    Permission.SESSIONS_READ,
    Permission.SESSIONS_MANAGE,
    Permission.EVALUATIONS_READ,
    Permission.EVALUATIONS_CREATE,
    Permission.EVALUATIONS_MANAGE,
  ],
  // Retired roles (owner decision 2026-11-24): their members became MANAGER (VIEWER members were revoked) by migration
  // 20261124110000_simplify_tenant_roles. Kept only because the database enum still has the values; they grant nothing
  // and cannot be assigned.
  [TenantRole.BRANCH_MANAGER]: [],
  [TenantRole.RECEPTIONIST]: [],
  // Coach (owner decision 2026-11-24): only their own groups, those groups' sessions and players (narrowed in the
  // services, common/coach-scope.ts); marks attendance and writes evaluations / comments. No money, no administration.
  [TenantRole.COACH]: [
    Permission.BRANCHES_READ,
    Permission.STAFF_READ,
    Permission.PLAYERS_READ,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_MARK,
    Permission.GROUPS_READ,
    Permission.SESSIONS_READ,
    Permission.EVALUATIONS_READ,
    Permission.EVALUATIONS_CREATE,
  ],
  [TenantRole.ACCOUNTANT]: [],
  [TenantRole.VIEWER]: [],
};

export function hasPermission(role: TenantRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return permissions.includes(permission);
}

export function isBranchScopedRole(role: TenantRole): boolean {
  return (
    role === TenantRole.BRANCH_MANAGER ||
    role === TenantRole.RECEPTIONIST ||
    role === TenantRole.COACH
  );
}
