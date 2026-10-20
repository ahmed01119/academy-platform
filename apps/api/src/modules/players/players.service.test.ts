import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlayersService } from './players.service';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { TenantContext } from '@academy/shared';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  player: {
    findMany: MockFn;
    findUnique: MockFn;
    findFirst: MockFn;
    count: MockFn;
    create: MockFn;
    update: MockFn;
  };
  guardian: {
    create: MockFn;
  };
  playerEnrollment: {
    create: MockFn;
  };
  branch: {
    findUnique: MockFn;
  };
  withTenantTransaction: MockFn;
}

interface MockAudit {
  logEvent: MockFn;
}

describe('PlayersService', () => {
  let service: PlayersService;
  let mockPrisma: MockPrisma;
  let mockAudit: MockAudit;

  const mockTenantContext: TenantContext = {
    tenantId: '00000000-0000-4000-8000-000000000001',
    actorUserId: '00000000-0000-4000-8000-000000000099',
    locale: 'ar',
  };

  beforeEach(() => {
    mockPrisma = {
      player: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      guardian: {
        create: vi.fn(),
      },
      playerEnrollment: {
        create: vi.fn(),
      },
      branch: {
        findUnique: vi.fn(),
      },
      withTenantTransaction: vi.fn().mockImplementation((_opts, fn) => fn(mockPrisma)),
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    service = new PlayersService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('createPlayer', () => {
    it('creates player, primary guardian, and active enrollment atomically inside tenant transaction', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-1',
        name: 'الفرع الرئيسي',
        code: 'MAIN',
        status: 'ACTIVE',
      });
      mockPrisma.player.findFirst.mockResolvedValue(null);

      mockPrisma.player.create.mockResolvedValue({
        id: 'player-1',
        tenantId: mockTenantContext.tenantId,
        firstName: 'Tsubasa',
        lastName: 'Ozora',
        gender: 'MALE',
        dateOfBirth: new Date('2014-05-10T00:00:00Z'),
        nationalId: '12345678901234',
        photoUrl: null,
        emergencyContactName: 'Natsuko Ozora',
        emergencyContactPhone: '+201000000001',
        medicalNotes: null,
        status: 'ACTIVE',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });

      mockPrisma.guardian.create.mockResolvedValue({
        id: 'guardian-1',
        tenantId: mockTenantContext.tenantId,
        playerId: 'player-1',
        firstName: 'Natsuko',
        lastName: 'Ozora',
        relationship: 'MOTHER',
        phone: '+201000000001',
        email: 'mother@example.com',
        isPrimary: true,
      });

      mockPrisma.playerEnrollment.create.mockResolvedValue({
        id: 'enrollment-1',
        tenantId: mockTenantContext.tenantId,
        playerId: 'player-1',
        branchId: 'branch-1',
        sport: 'FOOTBALL',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01T00:00:00Z'),
        notes: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        branch: {
          id: 'branch-1',
          name: 'الفرع الرئيسي',
          code: 'MAIN',
        },
      });

      const res = await service.createPlayer(mockTenantContext, {
        firstName: 'Tsubasa',
        lastName: 'Ozora',
        gender: 'MALE',
        dateOfBirth: '2014-05-10',
        nationalId: '12345678901234',
        emergencyContactName: 'Natsuko Ozora',
        emergencyContactPhone: '+201000000001',
        primaryGuardian: {
          firstName: 'Natsuko',
          lastName: 'Ozora',
          relationship: 'MOTHER',
          phone: '+201000000001',
          email: 'mother@example.com',
          isPrimary: true,
        },
        initialBranchId: 'branch-1',
        sport: 'FOOTBALL',
      });

      expect(res.firstName).toBe('Tsubasa');
      expect(res.guardians).toHaveLength(1);
      expect(res.enrollments).toHaveLength(1);
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLAYER_REGISTER',
          resourceType: 'Player',
          resourceId: 'player-1',
        }),
      );
    });

    it('rejects player creation if nationalId is already registered in tenant', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-1',
        status: 'ACTIVE',
      });
      mockPrisma.player.findFirst.mockResolvedValue({ id: 'existing-player' });

      await expect(
        service.createPlayer(mockTenantContext, {
          firstName: 'Duplicate',
          lastName: 'Player',
          gender: 'MALE',
          dateOfBirth: '2014-05-10',
          nationalId: '12345678901234',
          emergencyContactName: 'Contact',
          emergencyContactPhone: '+201000000000',
          primaryGuardian: {
            firstName: 'G',
            lastName: 'L',
            relationship: 'FATHER',
            phone: '+201000000000',
            isPrimary: true,
          },
          initialBranchId: 'branch-1',
          sport: 'FOOTBALL',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects player creation in another branch if actor is branch-scoped', async () => {
      const branchScopedContext: TenantContext = {
        ...mockTenantContext,
        branchId: 'my-branch-id',
      };

      await expect(
        service.createPlayer(branchScopedContext, {
          firstName: 'Tsubasa',
          lastName: 'Ozora',
          gender: 'MALE',
          dateOfBirth: '2014-05-10',
          emergencyContactName: 'Contact',
          emergencyContactPhone: '+201000000000',
          primaryGuardian: {
            firstName: 'G',
            lastName: 'L',
            relationship: 'FATHER',
            phone: '+201000000000',
            isPrimary: true,
          },
          initialBranchId: 'different-branch-id',
          sport: 'FOOTBALL',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listPlayers', () => {
    it('returns paginated players with primary guardian and active enrollment', async () => {
      mockPrisma.player.count.mockResolvedValue(1);
      mockPrisma.player.findMany.mockResolvedValue([
        {
          id: 'player-1',
          tenantId: mockTenantContext.tenantId,
          firstName: 'Tsubasa',
          lastName: 'Ozora',
          gender: 'MALE',
          dateOfBirth: new Date('2014-05-10T00:00:00Z'),
          nationalId: null,
          photoUrl: null,
          emergencyContactName: 'Contact',
          emergencyContactPhone: '+201000000000',
          status: 'ACTIVE',
          guardians: [
            {
              id: 'g1',
              firstName: 'Natsuko',
              lastName: 'Ozora',
              relationship: 'MOTHER',
              phone: '+201000000001',
              email: null,
              isPrimary: true,
            },
          ],
          enrollments: [
            {
              id: 'e1',
              branch: {
                id: 'b1',
                name: 'الفرع الرئيسي',
                code: 'MAIN',
              },
            },
          ],
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);

      const res = await service.listPlayers(mockTenantContext, { page: 1, limit: 10 });
      expect(res.total).toBe(1);
      expect(res.items).toHaveLength(1);
      expect(res.items[0]?.primaryGuardian?.firstName).toBe('Natsuko');
      expect(res.items[0]?.currentBranch?.name).toBe('الفرع الرئيسي');
    });
  });

  describe('getPlayerById', () => {
    it('throws NotFoundException if player does not exist', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(null);

      await expect(service.getPlayerById(mockTenantContext, 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
