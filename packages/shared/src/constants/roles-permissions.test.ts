import { describe, expect, it } from 'vitest';
import { hasPermission, isBranchScopedRole, Permission, TenantRole } from './roles-permissions';
import { EmailSchema, PasswordSchema } from '../schemas/auth';

describe('roles and permissions', () => {
  it('owner has all operational and tenant administrative permissions', () => {
    expect(hasPermission(TenantRole.OWNER, Permission.TENANT_UPDATE)).toBe(true);
    expect(hasPermission(TenantRole.OWNER, Permission.STAFF_MANAGE)).toBe(true);
    expect(hasPermission(TenantRole.OWNER, Permission.ATTENDANCE_MARK)).toBe(true);
    expect(hasPermission(TenantRole.OWNER, Permission.PAYMENTS_REFUND)).toBe(true);
  });

  it('coach only has attendance and player read access', () => {
    expect(hasPermission(TenantRole.COACH, Permission.ATTENDANCE_READ)).toBe(true);
    expect(hasPermission(TenantRole.COACH, Permission.ATTENDANCE_MARK)).toBe(true);
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
    expect(PasswordSchema.safeParse('StrongPass123!').success).toBe(true);
  });

  it('normalizes and validates email addresses', () => {
    const parsed = EmailSchema.parse('  User.Test@Academy.com ');
    expect(parsed).toBe('user.test@academy.com');
  });
});
