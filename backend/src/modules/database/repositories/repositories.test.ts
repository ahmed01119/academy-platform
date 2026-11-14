import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UserRepository,
  TenantRepository,
  PlayerRepository,
  FinanceRepository,
  AttendanceRepository,
} from './index';
import type { PrismaService } from '../prisma.service';

describe('Repository Layer Unit Tests', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      tenantMembership: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      player: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      playerSubscriptionPlan: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      playerSubscription: {
        findFirst: vi.fn(),
      },
      academyFinancialTransaction: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      attendanceSession: {
        findFirst: vi.fn(),
      },
      attendanceRecord: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
    };
  });

  describe('UserRepository', () => {
    it('finds user by email in lowercase and trimmed format', async () => {
      const repo = new UserRepository(mockPrisma as unknown as PrismaService);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'test@example.com' });

      const result = await repo.findByEmail('  TEST@Example.com  ');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result?.id).toBe('u1');
    });

    it('updates password hash and resets recovery tokens', async () => {
      const repo = new UserRepository(mockPrisma as unknown as PrismaService);
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', passwordHash: 'new-hash' });

      const result = await repo.updatePassword('u1', 'new-hash');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          passwordHash: 'new-hash',
          mustResetPassword: false,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      });
      expect(result.passwordHash).toBe('new-hash');
    });
  });

  describe('TenantRepository', () => {
    it('finds tenant by slug in lowercase trimmed format', async () => {
      const repo = new TenantRepository(mockPrisma as unknown as PrismaService);
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1', slug: 'academy-one' });

      const result = await repo.findBySlug('  Academy-One  ');
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: 'academy-one' },
      });
      expect(result?.id).toBe('t1');
    });
  });

  describe('PlayerRepository', () => {
    it('queries players with tenant scoping and search terms', async () => {
      const repo = new PlayerRepository(mockPrisma as unknown as PrismaService);
      mockPrisma.player.findMany.mockResolvedValue([{ id: 'p1', firstName: 'Youssef' }]);

      const result = await repo.findMany('tenant-1', {
        search: 'Youssef',
        limit: 10,
        offset: 0,
      });

      expect(mockPrisma.player.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          OR: [
            { firstName: { contains: 'Youssef', mode: 'insensitive' } },
            { lastName: { contains: 'Youssef', mode: 'insensitive' } },
            { nationalId: { contains: 'Youssef', mode: 'insensitive' } },
          ],
        },
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('FinanceRepository', () => {
    it('fetches subscription plan within tenant boundary', async () => {
      const repo = new FinanceRepository(mockPrisma as unknown as PrismaService);
      mockPrisma.playerSubscriptionPlan.findFirst.mockResolvedValue({ id: 'plan-1' });

      const result = await repo.findPlanById('tenant-1', 'plan-1');
      expect(mockPrisma.playerSubscriptionPlan.findFirst).toHaveBeenCalledWith({
        where: { id: 'plan-1', tenantId: 'tenant-1' },
      });
      expect(result?.id).toBe('plan-1');
    });
  });

  describe('AttendanceRepository', () => {
    it('upserts attendance record with version increment and check-in timestamp', async () => {
      const repo = new AttendanceRepository(mockPrisma as unknown as PrismaService);
      mockPrisma.attendanceRecord.upsert.mockResolvedValue({
        id: 'rec-1',
        status: 'PRESENT',
      });

      const result = await repo.upsertAttendance(
        'tenant-1',
        'sess-1',
        'play-1',
        'PRESENT' as any,
        'user-1',
        'On time',
      );

      expect(mockPrisma.attendanceRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sessionId_playerId: {
              sessionId: 'sess-1',
              playerId: 'play-1',
            },
          },
        }),
      );
      expect(result.status).toBe('PRESENT');
    });
  });
});

