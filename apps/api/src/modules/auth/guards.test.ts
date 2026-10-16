import { describe, expect, it } from 'vitest';
import { TenantGuard } from './guards/tenant.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { Permission, TenantRole } from '@academy/shared';
import { BadRequestException, type ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('TenantGuard & PermissionsGuard', () => {
  describe('TenantGuard', () => {
    const guard = new TenantGuard();

    const createMockContext = (req: Record<string, unknown>) =>
      ({
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      }) as unknown as ExecutionContext;

    it('throws ForbiddenException if unauthenticated', () => {
      const ctx = createMockContext({ user: null });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('throws BadRequestException if tenant header is missing', () => {
      const ctx = createMockContext({
        user: { id: 'u1', memberships: [] },
        headers: {},
        query: {},
        params: {},
      });
      expect(() => guard.canActivate(ctx)).toThrow(BadRequestException);
    });

    it('throws ForbiddenException if user has no membership in requested tenant', () => {
      const ctx = createMockContext({
        user: {
          id: 'u1',
          memberships: [{ tenantId: 'tenant-other', status: 'ACTIVE', role: TenantRole.COACH }],
        },
        headers: { 'x-tenant-id': 'tenant-target' },
        query: {},
        params: {},
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if membership is REVOKED', () => {
      const ctx = createMockContext({
        user: {
          id: 'u1',
          memberships: [{ tenantId: 'tenant-target', status: 'REVOKED', role: TenantRole.COACH }],
        },
        headers: { 'x-tenant-id': 'tenant-target' },
        query: {},
        params: {},
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if branch-scoped role tries to access unauthorized branch', () => {
      const ctx = createMockContext({
        user: {
          id: 'u1',
          memberships: [
            {
              tenantId: 'tenant-target',
              status: 'ACTIVE',
              role: TenantRole.COACH,
              branchId: 'branch-1',
            },
          ],
        },
        headers: { 'x-tenant-id': 'tenant-target', 'x-branch-id': 'branch-2' },
        query: {},
        params: {},
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('activates and attaches tenantContext when membership and branch match', () => {
      const req: Record<string, unknown> = {
        user: {
          id: 'u1',
          memberships: [
            {
              tenantId: 'tenant-target',
              status: 'ACTIVE',
              role: TenantRole.COACH,
              branchId: 'branch-1',
            },
          ],
        },
        headers: { 'x-tenant-id': 'tenant-target' },
        query: {},
        params: {},
      };
      const ctx = createMockContext(req);

      const result = guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(req.tenantContext).toEqual({
        tenantId: 'tenant-target',
        branchId: 'branch-1',
        actorUserId: 'u1',
        locale: 'ar',
      });
    });
  });

  describe('PermissionsGuard', () => {
    it('allows access if handler requires no specific permissions', () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => undefined;
      const guard = new PermissionsGuard(reflector);

      const ctx = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('denies access if user role lacks required permission', () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => [Permission.PAYMENTS_REFUND];
      const guard = new PermissionsGuard(reflector);

      const ctx = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            tenantMembership: { role: TenantRole.COACH }, // Coach cannot manage finances/refunds
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('grants access if user role possesses all required permissions', () => {
      const reflector = new Reflector();
      reflector.getAllAndOverride = () => [Permission.STAFF_MANAGE, Permission.BRANCHES_MANAGE];
      const guard = new PermissionsGuard(reflector);

      const ctx = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            tenantMembership: { role: TenantRole.OWNER }, // Owner has all permissions
          }),
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
