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
  PLATFORM_MANAGE: 'platform.manage',
  PLAYER_APPLICATION_REVIEW: 'player.application.review',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const PermissionSchema = z.nativeEnum(Permission);

export const ROLE_PERMISSIONS: Record<TenantRole, readonly Permission[]> = {
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
    Permission.REPORTS_READ,
    Permission.GROUPS_READ,
    Permission.GROUPS_MANAGE,
    Permission.SESSIONS_READ,
    Permission.SESSIONS_MANAGE,
    Permission.EVALUATIONS_READ,
    Permission.EVALUATIONS_CREATE,
    Permission.EVALUATIONS_MANAGE,
  ],
  [TenantRole.MANAGER]: [
    Permission.BRANCHES_MANAGE,
    Permission.BRANCHES_READ,
    Permission.STAFF_MANAGE,
    Permission.STAFF_READ,
    Permission.PLAYERS_READ,
    Permission.PLAYERS_CREATE,
    Permission.PLAYERS_UPDATE,
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
    Permission.REPORTS_READ,
    Permission.GROUPS_READ,
    Permission.GROUPS_MANAGE,
    Permission.SESSIONS_READ,
    Permission.SESSIONS_MANAGE,
    Permission.EVALUATIONS_READ,
    Permission.EVALUATIONS_CREATE,
    Permission.EVALUATIONS_MANAGE,
  ],
  [TenantRole.BRANCH_MANAGER]: [
    Permission.BRANCHES_READ,
    Permission.STAFF_READ,
    Permission.PLAYERS_READ,
    Permission.PLAYERS_CREATE,
    Permission.PLAYERS_UPDATE,
    Permission.PLAYERS_SENSITIVE_READ,
    Permission.PLAYER_APPLICATION_REVIEW,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_MARK,
    Permission.ATTENDANCE_CORRECT,
    Permission.ATTENDANCE_CLOSE,
    Permission.PAYMENTS_READ,
    Permission.PAYMENTS_CREATE,
    Permission.SESSION_EXPENSES_READ,
    Permission.SESSION_EXPENSES_CREATE,
    Permission.SESSION_EXPENSES_APPROVE,
    Permission.REPORTS_READ,
    Permission.GROUPS_READ,
    Permission.GROUPS_MANAGE,
    Permission.SESSIONS_READ,
    Permission.SESSIONS_MANAGE,
    Permission.EVALUATIONS_READ,
    Permission.EVALUATIONS_CREATE,
  ],
  [TenantRole.RECEPTIONIST]: [
    Permission.BRANCHES_READ,
    Permission.PLAYERS_READ,
    Permission.PLAYERS_CREATE,
    Permission.PLAYERS_UPDATE,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_MARK,
    Permission.ATTENDANCE_CORRECT,
    Permission.PAYMENTS_CREATE,
    Permission.PAYMENTS_READ,
    Permission.SESSION_EXPENSES_READ,
    Permission.GROUPS_READ,
    Permission.SESSIONS_READ,
  ],
  [TenantRole.COACH]: [
    Permission.BRANCHES_READ,
    Permission.PLAYERS_READ,
    Permission.ATTENDANCE_READ, // Coaches can view attendance, but are strictly prohibited from marking/recording attendance
    Permission.SESSION_EXPENSES_READ,
    Permission.SESSION_EXPENSES_CREATE,
    Permission.GROUPS_READ,
    Permission.SESSIONS_READ,
    Permission.EVALUATIONS_READ,
    Permission.EVALUATIONS_CREATE,
  ],
  [TenantRole.ACCOUNTANT]: [
    Permission.BRANCHES_READ,
    Permission.PLAYERS_READ,
    Permission.PAYMENTS_READ,
    Permission.PAYMENTS_CREATE,
    Permission.PAYMENTS_REFUND,
    Permission.SESSION_EXPENSES_READ,
    Permission.SESSION_EXPENSES_CREATE,
    Permission.SESSION_EXPENSES_APPROVE,
    Permission.REPORTS_READ,
    Permission.GROUPS_READ,
    Permission.SESSIONS_READ,
  ],
  [TenantRole.VIEWER]: [
    Permission.BRANCHES_READ,
    Permission.PLAYERS_READ,
    Permission.ATTENDANCE_READ,
    Permission.SESSION_EXPENSES_READ,
    Permission.REPORTS_READ,
    Permission.GROUPS_READ,
    Permission.SESSIONS_READ,
  ],
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
