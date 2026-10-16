import { describe, expect, it, vi } from 'vitest';
import { TenantGuard } from './guards/tenant.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { Permission, TenantRole } from '@academy/shared';
import { BadRequestException, type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';

const TENANT_A = '00000000-0000-4000-8000-000000000201';
const TENANT_B = '00000000-0000-4000-8000-000000000202';
const BRANCH_1 = '00000000-0000-4000-8000-000000000211';
const BRANCH_2 = '00000000-0000-4000-8000-000000000212';

describe('TenantGuard & PermissionsGuard', () => {
  describe('TenantGuard', () => {
    const mockPrisma = {
      withAuthLookupTransaction: vi.fn().mockImplementation((_options, operation) =>
        operation({
          tenantMembership: {
            findUnique: vi.fn().mockImplementation(({ where }) => {
              const memberships = currentRequest?.user?.memberships ?? [];
              return (
                memberships.find(
                  (m: { tenantId: string }) => m.tenantId === where.tenantId_userId.tenantId,
                ) ?? null
              );
            }),
          },
        }),
      ),
    } as unknown as PrismaService;
    const guard = new TenantGuard(mockPrisma);
    let currentRequest: { user?: { memberships?: Array<{ tenantId: string }> } } | null = null;

    const createMockContext = (req: Record<string, unknown>) => {
      currentRequest = req;
      return ({
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      }) as unknown as ExecutionContext;
    };

    it('throws ForbiddenException if unauthenticated', async () => {
      const ctx = createMockContext({ user: null });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if tenant header is missing', async () => {
      const ctx = createMockContext({
        user: { id: 'u1', memberships: [] },
        headers: {},
        query: {},
        params: {},
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException if user has no membership in requested tenant', async () => {
      const ctx = createMockContext({
        user: {
          id: 'u1',
          memberships: [{ tenantId: TENANT_B, status: 'ACTIVE', role: TenantRole.COACH }],
        },
        headers: { 'x-tenant-id': TENANT_A },
        query: {},
        params: {},
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if membership is REVOKED', async () => {
      const ctx = createMockContext({
        user: {
          id: 'u1',
          memberships: [{ tenantId: TENANT_A, status: 'REVOKED', role: TenantRole.COACH }],
        },
        headers: { 'x-tenant-id': TENANT_A },
        query: {},
        params: {},
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if membership is SUSPENDED', async () => {
      const ctx = createMockContext({
        user: {
          id: 'u1',
          memberships: [{ tenantId: TENANT_A, status: 'SUSPENDED', role: TenantRole.COACH }],
        },
        headers: { 'x-tenant-id': TENANT_A },
        query: {},
        params: {},
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if branch-scoped role tries to access unauthorized branch', async () => {
      const ctx = createMockContext({
        user: {
          id: 'u1',
          memberships: [
            {
              tenantId: TENANT_A,
              status: 'ACTIVE',
              role: TenantRole.COACH,
              branchId: BRANCH_1,
            },
          ],
        },
        headers: { 'x-tenant-id': TENANT_A, 'x-branch-id': BRANCH_2 },
        query: {},
        params: {},
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('activates and attaches tenantContext when membership and branch match', async () => {
      const req: Record<string, unknown> = {
        user: {
          id: 'u1',
          memberships: [
            {
              tenantId: TENANT_A,
              status: 'ACTIVE',
              role: TenantRole.COACH,
              branchId: BRANCH_1,
            },
          ],
        },
        headers: { 'x-tenant-id': TENANT_A },
        query: {},
        params: {},
      };
      const ctx = createMockContext(req);

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(req.tenantContext).toEqual({
        tenantId: TENANT_A,
        branchId: BRANCH_1,
        actorUserId: 'u1',
        locale: 'ar',
      });
    });

    it('denies a revoked database membership even when JWT membership is stale', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        id: 'm1',
        tenantId: TENANT_A,
        userId: 'u1',
        role: TenantRole.COACH,
        status: 'REVOKED',
        branchId: BRANCH_1,
      });
      const withAuthLookupTransaction = vi
        .fn()
        .mockImplementation((_options, operation) =>
          operation({ tenantMembership: { findUnique } }),
        );
      const dbGuard = new TenantGuard({ withAuthLookupTransaction } as unknown as PrismaService);
      const ctx = createMockContext({
        user: {
          id: 'u1',
          memberships: [{ tenantId: TENANT_A, status: 'ACTIVE', role: TenantRole.COACH }],
        },
        headers: { 'x-tenant-id': TENANT_A },
      });

      await expect(dbGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      expect(withAuthLookupTransaction).toHaveBeenCalledWith(
        { actorUserId: 'u1' },
        expect.any(Function),
      );
    });

    it('queries database when PrismaService is injected', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        id: 'm1',
        tenantId: TENANT_A,
        userId: 'u1',
        role: 'OWNER',
        status: 'ACTIVE',
        branchId: null,
      });
      const withAuthLookupTransaction = vi
        .fn()
        .mockImplementation((_options, operation) =>
          operation({ tenantMembership: { findUnique } }),
        );
      const mockPrisma = { withAuthLookupTransaction } as unknown as PrismaService;

      const dbGuard = new TenantGuard(mockPrisma);
      const req: Record<string, unknown> = {
        user: { id: 'u1' },
        headers: { 'x-tenant-id': TENANT_A },
      };
      const ctx = createMockContext(req);

      const result = await dbGuard.canActivate(ctx);
      expect(result).toBe(true);
      expect(req.tenantMembership).toBeDefined();
      expect(withAuthLookupTransaction).toHaveBeenCalledWith(
        { actorUserId: 'u1' },
        expect.any(Function),
      );
      expect(findUnique).toHaveBeenCalledWith({
        where: { tenantId_userId: { tenantId: TENANT_A, userId: 'u1' } },
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
