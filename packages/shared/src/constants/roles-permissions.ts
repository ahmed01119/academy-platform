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
  ATTENDANCE_READ: 'attendance.read',
  ATTENDANCE_MARK: 'attendance.mark',
  ATTENDANCE_CORRECT: 'attendance.correct',
  ATTENDANCE_CLOSE: 'attendance.close',
  PAYMENTS_READ: 'payments.read',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_REFUND: 'payments.refund',
  REPORTS_READ: 'reports.read',
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
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_MARK,
    Permission.ATTENDANCE_CORRECT,
    Permission.ATTENDANCE_CLOSE,
    Permission.PAYMENTS_READ,
    Permission.PAYMENTS_CREATE,
    Permission.PAYMENTS_REFUND,
    Permission.REPORTS_READ,
  ],
  [TenantRole.MANAGER]: [
    Permission.BRANCHES_MANAGE,
    Permission.BRANCHES_READ,
    Permission.STAFF_MANAGE,
    Permission.STAFF_READ,
    Permission.PLAYERS_READ,
    Permission.PLAYERS_CREATE,
    Permission.PLAYERS_UPDATE,
    Permission.PLAYERS_DELETE,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_MARK,
    Permission.ATTENDANCE_CORRECT,
    Permission.ATTENDANCE_CLOSE,
    Permission.PAYMENTS_READ,
    Permission.PAYMENTS_CREATE,
    Permission.PAYMENTS_REFUND,
    Permission.REPORTS_READ,
  ],
  [TenantRole.BRANCH_MANAGER]: [
    Permission.BRANCHES_READ,
    Permission.STAFF_READ,
    Permission.PLAYERS_READ,
    Permission.PLAYERS_CREATE,
    Permission.PLAYERS_UPDATE,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_MARK,
    Permission.ATTENDANCE_CORRECT,
    Permission.ATTENDANCE_CLOSE,
    Permission.PAYMENTS_READ,
    Permission.PAYMENTS_CREATE,
    Permission.REPORTS_READ,
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
  ],
  [TenantRole.COACH]: [
    Permission.BRANCHES_READ,
    Permission.PLAYERS_READ,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_MARK,
  ],
  [TenantRole.ACCOUNTANT]: [
    Permission.BRANCHES_READ,
    Permission.PLAYERS_READ,
    Permission.PAYMENTS_READ,
    Permission.PAYMENTS_CREATE,
    Permission.PAYMENTS_REFUND,
    Permission.REPORTS_READ,
  ],
  [TenantRole.VIEWER]: [
    Permission.BRANCHES_READ,
    Permission.PLAYERS_READ,
    Permission.ATTENDANCE_READ,
    Permission.REPORTS_READ,
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
