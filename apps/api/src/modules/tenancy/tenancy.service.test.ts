import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TenancyService } from './tenancy.service';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TenantRole } from '@academy/shared';
import type { PrismaService } from '../database/prisma.service';
import type { TokenService } from '../auth/token.service';
import type { PasswordService } from '../auth/password.service';
import type { AuditService } from '../audit/audit.service';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  tenantMembership: {
    findMany: MockFn;
    findFirst: MockFn;
    update: MockFn;
    upsert: MockFn;
  };
  branch: {
    findFirst: MockFn;
    findMany: MockFn;
  };
  invitation: {
    findFirst: MockFn;
    create: MockFn;
    update: MockFn;
  };
  user: {
    findUnique: MockFn;
    create: MockFn;
  };
  $transaction: MockFn;
  withTenantTransaction: MockFn;
  withAuthLookupTransaction: MockFn;
}

interface MockToken {
  generateSecureRandomString: MockFn;
  hashToken: MockFn;
  revokeAllUserTokens: MockFn;
}

interface MockPassword {
  hash: MockFn;
}

interface MockAudit {
  logEvent: MockFn;
}

describe('TenancyService', () => {
  let service: TenancyService;
  let mockPrisma: MockPrisma;
  let mockToken: MockToken;
  let mockPassword: MockPassword;
  let mockAudit: MockAudit;

  beforeEach(() => {
    mockPrisma = {
      tenantMembership: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      branch: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      invitation: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation((fn) => fn(mockPrisma)),
      withTenantTransaction: vi.fn().mockImplementation((_opts, fn) => fn(mockPrisma)),
      withAuthLookupTransaction: vi.fn().mockImplementation((_opts, fn) => fn(mockPrisma)),
    };

    mockToken = {
      generateSecureRandomString: vi.fn().mockReturnValue('invitation-token-32-chars-long'),
      hashToken: vi.fn().mockReturnValue('hashed-invitation-token'),
      revokeAllUserTokens: vi.fn().mockResolvedValue(undefined),
    };

    mockPassword = {
      hash: vi.fn().mockResolvedValue('argon2id$mock$hash'),
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    service = new TenancyService(
      mockPrisma as unknown as PrismaService,
      mockToken as unknown as TokenService,
      mockPassword as unknown as PasswordService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('switchTenant', () => {
    it('throws ForbiddenException if user has no active membership in target tenant', async () => {
      mockPrisma.tenantMembership.findFirst.mockResolvedValue(null);

      await expect(service.switchTenant('user-1', 'tenant-unauthorized')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns membership summary on valid tenant switch', async () => {
      mockPrisma.tenantMembership.findFirst.mockResolvedValue({
        id: 'mem-1',
        tenantId: 'tenant-1',
        role: TenantRole.COACH,
        status: 'ACTIVE',
        branchId: 'branch-1',
        tenant: { name: 'Al Ahly Academy', slug: 'al-ahly' },
        branch: { name: 'Nasr City Branch' },
      });

      const result = await service.switchTenant('user-1', 'tenant-1');
      expect(result.tenantName).toBe('Al Ahly Academy');
      expect(result.role).toBe(TenantRole.COACH);
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TENANT_SWITCH',
        }),
      );
    });
  });

  describe('inviteStaff', () => {
    it('throws ConflictException if invitee is already an active member', async () => {
      mockPrisma.tenantMembership.findFirst.mockResolvedValue({
        id: 'mem-existing',
        status: 'ACTIVE',
      });

      await expect(
        service.inviteStaff(
          { tenantId: 'tenant-1', actorUserId: 'owner-1' },
          { email: 'existing@example.com', role: TenantRole.COACH },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('creates an invitation with secure hashed token', async () => {
      mockPrisma.tenantMembership.findFirst.mockResolvedValue(null);
      mockPrisma.invitation.create.mockResolvedValue({
        id: 'inv-1',
        email: 'newcoach@example.com',
        role: TenantRole.COACH,
        expiresAt: new Date(),
      });

      const result = await service.inviteStaff(
        { tenantId: 'tenant-1', actorUserId: 'owner-1' },
        { email: 'newcoach@example.com', role: TenantRole.COACH },
      );

      expect(result.email).toBe('newcoach@example.com');
      expect(result.token).toBe('invitation-token-32-chars-long');
      expect(mockPrisma.invitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            token: 'hashed-invitation-token',
          }),
        }),
      );
    });
  });

  describe('revokeMembership', () => {
    it('forbids revoking an OWNER membership', async () => {
      mockPrisma.tenantMembership.findFirst.mockResolvedValue({
        id: 'mem-owner',
        tenantId: 'tenant-1',
        role: TenantRole.OWNER,
      });

      await expect(
        service.revokeMembership({ tenantId: 'tenant-1', actorUserId: 'owner-1' }, 'mem-owner'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('revokes membership and invalidates all active sessions for the user', async () => {
      mockPrisma.tenantMembership.findFirst.mockResolvedValue({
        id: 'mem-coach',
        tenantId: 'tenant-1',
        userId: 'coach-1',
        role: TenantRole.COACH,
      });

      const res = await service.revokeMembership(
        { tenantId: 'tenant-1', actorUserId: 'owner-1' },
        'mem-coach',
      );

      expect(res.message).toContain('revoked');
      expect(mockPrisma.tenantMembership.update).toHaveBeenCalledWith({
        where: { id: 'mem-coach' },
        data: { status: 'REVOKED' },
      });
      expect(mockToken.revokeAllUserTokens).toHaveBeenCalledWith('coach-1');
    });
  });
});
