import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlayersService } from './players.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { Permission, type TenantContext } from '@academy/shared';

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
    count: MockFn;
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
    permissions: [Permission.PLAYERS_SENSITIVE_READ],
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
        count: vi.fn().mockResolvedValue(0),
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
        capacity: 100,
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
        expect.anything(),
      );
    });

    it('rejects player creation if branch is at capacity', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: 'branch-1',
        status: 'ACTIVE',
        capacity: 10,
      });
      mockPrisma.playerEnrollment.count.mockResolvedValue(10);

      await expect(
        service.createPlayer(mockTenantContext, {
          firstName: 'Cap',
          lastName: 'Full',
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
          initialBranchId: 'branch-1',
          sport: 'FOOTBALL',
        }),
      ).rejects.toThrow(BadRequestException);
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

    it('minimizes sensitive data (nationalId, medicalNotes) when user lacks PLAYERS_SENSITIVE_READ', async () => {
      const restrictedContext: TenantContext = {
        tenantId: mockTenantContext.tenantId,
        actorUserId: 'coach-user-id',
        permissions: [],
      };

      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        tenantId: mockTenantContext.tenantId,
        firstName: 'Tsubasa',
        lastName: 'Ozora',
        gender: 'MALE',
        dateOfBirth: new Date('2014-05-10T00:00:00Z'),
        nationalId: '29901011234567',
        medicalNotes: 'Asthma inhaler required',
        emergencyContactName: 'Natsuko',
        emergencyContactPhone: '+201000000000',
        status: 'ACTIVE',
        guardians: [],
        enrollments: [],
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });

      const player = await service.getPlayerById(restrictedContext, 'player-1');
      expect(player.nationalId).toBeNull();
      expect(player.medicalNotes).toBeNull();
      expect(player.firstName).toBe('Tsubasa');
    });

    it('returns sensitive data when user has PLAYERS_SENSITIVE_READ', async () => {
      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        tenantId: mockTenantContext.tenantId,
        firstName: 'Tsubasa',
        lastName: 'Ozora',
        gender: 'MALE',
        dateOfBirth: new Date('2014-05-10T00:00:00Z'),
        nationalId: '29901011234567',
        medicalNotes: 'Asthma inhaler required',
        emergencyContactName: 'Natsuko',
        emergencyContactPhone: '+201000000000',
        status: 'ACTIVE',
        guardians: [],
        enrollments: [],
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });

      const player = await service.getPlayerById(mockTenantContext, 'player-1');
      expect(player.nationalId).toBe('29901011234567');
      expect(player.medicalNotes).toBe('Asthma inhaler required');
    });

    it('rejects branch-scoped user access if player only had a historical/transferred enrollment in their branch', async () => {
      const branchScopedContext: TenantContext = {
        tenantId: mockTenantContext.tenantId,
        actorUserId: 'staff-branch-1',
        branchId: 'branch-1',
        permissions: [],
      };

      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        tenantId: mockTenantContext.tenantId,
        firstName: 'Tsubasa',
        lastName: 'Ozora',
        status: 'ACTIVE',
        guardians: [],
        enrollments: [
          {
            id: 'old-enr',
            branchId: 'branch-1',
            status: 'TRANSFERRED', // Historical, not active
            branch: { id: 'branch-1', name: 'Branch 1', code: 'B1' },
          },
          {
            id: 'current-enr',
            branchId: 'branch-2',
            status: 'ACTIVE',
            branch: { id: 'branch-2', name: 'Branch 2', code: 'B2' },
          },
        ],
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });

      await expect(service.getPlayerById(branchScopedContext, 'player-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updatePlayer', () => {
    it('rejects modifying medicalNotes when actor lacks PLAYERS_SENSITIVE_READ', async () => {
      const restrictedContext: TenantContext = {
        tenantId: mockTenantContext.tenantId,
        actorUserId: 'staff-user',
        permissions: [],
      };

      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        tenantId: mockTenantContext.tenantId,
        medicalNotes: 'Original notes',
        enrollments: [],
      });

      await expect(
        service.updatePlayer(restrictedContext, 'player-1', {
          medicalNotes: 'Altered notes',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects update if nationalId belongs to another player in tenant', async () => {
      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        tenantId: mockTenantContext.tenantId,
        nationalId: '11111111111111',
        enrollments: [],
      });

      mockPrisma.player.findFirst.mockResolvedValue({
        id: 'player-2-other',
      });

      await expect(
        service.updatePlayer(mockTenantContext, 'player-1', {
          nationalId: '22222222222222',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Player QR Card Management', () => {
    const mockPlayer = {
      id: '00000000-0000-4000-8000-000000000101',
      tenantId: mockTenantContext.tenantId,
      firstName: 'كريم',
      lastName: 'محمود',
      membershipNumber: 'ACAD-2026-000101',
      photoUrl: null,
      qrCardCode: 'abc123def456',
      qrCardIssuedAt: new Date('2026-10-20T10:00:00Z'),
      qrCardRevokedAt: null,
      tenant: { id: mockTenantContext.tenantId, name: 'أكاديمية الفرسان', slug: 'forsan' },
      enrollments: [{ branchId: 'branch-1', status: 'ACTIVE' }],
    };

    it('returns existing QR card if already issued', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);

      const card = await service.getPlayerQrCard(mockTenantContext, mockPlayer.id);

      expect(card.playerId).toBe(mockPlayer.id);
      expect(card.qrCardCode).toBe('abc123def456');
      expect(card.isRevoked).toBe(false);
      expect(card.revokedAt).toBeNull();
      expect(card.membershipNumber).toBe('ACAD-2026-000101');
    });

    it('issues default QR card if qrCardCode is null', async () => {
      const playerWithoutCard = {
        ...mockPlayer,
        qrCardCode: null,
        qrCardIssuedAt: null,
        membershipNumber: null,
      };
      mockPrisma.player.findUnique.mockResolvedValue(playerWithoutCard);
      mockPrisma.player.update.mockResolvedValue({
        ...playerWithoutCard,
        membershipNumber: 'FORS-2026-000101',
        qrCardCode: 'newlygeneratedcode123',
        qrCardIssuedAt: new Date(),
        qrCardRevokedAt: null,
      });

      const card = await service.getPlayerQrCard(mockTenantContext, mockPlayer.id);

      expect(card.qrCardCode).toBe('newlygeneratedcode123');
      expect(card.isRevoked).toBe(false);
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLAYER_QR_CARD_ISSUED',
          resourceId: mockPlayer.id,
        }),
        expect.anything(),
      );
    });

    it('rotates player QR card code and logs audit event', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
      mockPrisma.player.update.mockResolvedValue({
        ...mockPlayer,
        qrCardCode: 'rotatedcode987654321',
        qrCardIssuedAt: new Date(),
        qrCardRevokedAt: null,
      });

      const card = await service.rotatePlayerQrCard(mockTenantContext, mockPlayer.id, {
        reason: 'Lost physical badge',
      });

      expect(card.qrCardCode).toBe('rotatedcode987654321');
      expect(card.isRevoked).toBe(false);
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLAYER_QR_CARD_ROTATED',
          resourceId: mockPlayer.id,
          metadata: expect.objectContaining({
            reason: 'Lost physical badge',
          }),
        }),
        expect.anything(),
      );
    });

    it('revokes player QR card and marks isRevoked true', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
      const revokedAt = new Date();
      mockPrisma.player.update.mockResolvedValue({
        ...mockPlayer,
        qrCardRevokedAt: revokedAt,
      });

      const card = await service.revokePlayerQrCard(mockTenantContext, mockPlayer.id, {
        reason: 'Membership suspended due to non-payment',
      });

      expect(card.isRevoked).toBe(true);
      expect(card.revokedAt).toBeTruthy();
      expect(new Date(card.revokedAt!).getTime()).not.toBeNaN();
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLAYER_QR_CARD_REVOKED',
          resourceId: mockPlayer.id,
        }),
        expect.anything(),
      );
    });

    it('enforces branch isolation on QR card operations', async () => {
      const branchScopedContext: TenantContext = {
        ...mockTenantContext,
        branchId: 'other-branch-99',
      };
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);

      await expect(service.getPlayerQrCard(branchScopedContext, mockPlayer.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
