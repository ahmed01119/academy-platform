import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasPermission,
  isBranchScopedRole,
  Permission,
  ROLE_PERMISSIONS,
  TenantRole,
} from './roles-permissions';

/**
 * docs/security/ROLE_PERMISSION_MATRIX.md is the source of truth for tenant permissions. Reads its table: one row per
 * permission, one column per role. "Delegated*" (COACH application review) is granted per membership by
 * PermissionsGuard, so it counts as not in the static map; "Self only" counts as granted (scoped in the service).
 */
function documentedMatrix(): Map<string, Record<string, boolean>> {
  const doc = readFileSync(
    join(__dirname, '../../../../docs/security/ROLE_PERMISSION_MATRIX.md'),
    'utf8',
  );
  const lines = doc.split('\n');
  const header = lines.find((l) => l.startsWith('| Permission Key'));
  if (!header) throw new Error('matrix header not found');
  const roles = header
    .split('|')
    .slice(3, -1)
    .map((c) => c.trim());
  const rows = new Map<string, Record<string, boolean>>();
  for (const line of lines) {
    const m = /^\| `([a-z_.]+)`/.exec(line);
    if (!m?.[1]) continue;
    const cells = line
      .split('|')
      .slice(3, -1)
      .map((c) => c.trim());
    const grants: Record<string, boolean> = {};
    roles.forEach((role, i) => {
      const cell = cells[i] ?? '';
      grants[role] = cell === '✅' || cell === 'Self only';
    });
    rows.set(m[1], grants);
  }
  return rows;
}

describe('ROLE_PERMISSIONS matches docs/security/ROLE_PERMISSION_MATRIX.md', () => {
  const doc = documentedMatrix();

  it('documents every tenant permission except platform.manage', () => {
    const codePermissions = Object.values(Permission).filter(
      (p) => p !== Permission.PLATFORM_MANAGE,
    );
    expect([...doc.keys()].sort()).toEqual([...codePermissions].sort());
  });

  it.each(Object.values(TenantRole))('%s has exactly the documented permissions', (role) => {
    const documented = [...doc.entries()].filter(([, grants]) => grants[role]).map(([p]) => p);
    expect([...ROLE_PERMISSIONS[role]].sort()).toEqual(documented.sort());
  });
});
import { EmailSchema, PasswordSchema } from '../schemas/auth';

describe('roles and permissions', () => {
  it('owner has all operational and tenant administrative permissions', () => {
    expect(hasPermission(TenantRole.OWNER, Permission.TENANT_UPDATE)).toBe(true);
    expect(hasPermission(TenantRole.OWNER, Permission.STAFF_MANAGE)).toBe(true);
    expect(hasPermission(TenantRole.OWNER, Permission.ATTENDANCE_MARK)).toBe(true);
    expect(hasPermission(TenantRole.OWNER, Permission.PAYMENTS_REFUND)).toBe(true);
  });

  it('coach marks attendance (own sessions, checked in the service) but has no admin or money rights', () => {
    expect(hasPermission(TenantRole.COACH, Permission.ATTENDANCE_READ)).toBe(true);
    expect(hasPermission(TenantRole.COACH, Permission.ATTENDANCE_MARK)).toBe(true);
    expect(hasPermission(TenantRole.COACH, Permission.ATTENDANCE_CLOSE)).toBe(false);
    expect(hasPermission(TenantRole.COACH, Permission.PLAYERS_READ)).toBe(true);
    expect(hasPermission(TenantRole.COACH, Permission.PAYMENTS_CREATE)).toBe(false);
    expect(hasPermission(TenantRole.COACH, Permission.STAFF_MANAGE)).toBe(false);
    expect(hasPermission(TenantRole.COACH, Permission.TENANT_UPDATE)).toBe(false);
  });

  it('accountant has financial and report permissions but cannot modify staff or mark attendance', () => {
    expect(hasPermission(TenantRole.ACCOUNTANT, Permission.PAYMENTS_READ)).toBe(true);
    expect(hasPermission(TenantRole.ACCOUNTANT, Permission.PAYMENTS_CREATE)).toBe(true);
    expect(hasPermission(TenantRole.ACCOUNTANT, Permission.PAYMENTS_REFUND)).toBe(true);
    expect(hasPermission(TenantRole.ACCOUNTANT, Permission.REPORTS_READ)).toBe(true);
    expect(hasPermission(TenantRole.ACCOUNTANT, Permission.ATTENDANCE_MARK)).toBe(false);
    expect(hasPermission(TenantRole.ACCOUNTANT, Permission.STAFF_MANAGE)).toBe(false);
  });

  it('K8: only management and the accountant close a session cashier', () => {
    const closers = Object.values(TenantRole).filter((r) =>
      hasPermission(r, Permission.SESSION_CASHIER_CLOSE),
    );
    expect(closers.sort()).toEqual(['ACCOUNTANT', 'BRANCH_MANAGER', 'MANAGER', 'OWNER']);
  });

  it('correctly identifies branch-scoped roles', () => {
    expect(isBranchScopedRole(TenantRole.BRANCH_MANAGER)).toBe(true);
    expect(isBranchScopedRole(TenantRole.RECEPTIONIST)).toBe(true);
    expect(isBranchScopedRole(TenantRole.COACH)).toBe(true);
    expect(isBranchScopedRole(TenantRole.OWNER)).toBe(false);
    expect(isBranchScopedRole(TenantRole.MANAGER)).toBe(false);
  });

  it('validates password complexity', () => {
    expect(PasswordSchema.safeParse('Weak1').success).toBe(false); // too short
    expect(PasswordSchema.safeParse('alllowercase1').success).toBe(false); // no uppercase
    expect(PasswordSchema.safeParse('ALLUPPERCASE1').success).toBe(false); // no lowercase
    expect(PasswordSchema.safeParse('NoNumbersHere!').success).toBe(false); // no digit
    expect(PasswordSchema.safeParse('NoSpecialChar123').success).toBe(false); // no special char
    expect(PasswordSchema.safeParse('StrongPass123!').success).toBe(true);
  });

  it('normalizes and validates email addresses', () => {
    const parsed = EmailSchema.parse('  User.Test@Academy.com ');
    expect(parsed).toBe('user.test@academy.com');
  });
});
