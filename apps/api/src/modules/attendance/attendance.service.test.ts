import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AttendanceService } from './attendance.service';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { TenantContext } from '@academy/shared';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  withTenantTransaction: MockFn;
  branch: {
    findUnique: MockFn;
  };
  trainingGroup: {
    findUnique: MockFn;
  };
  attendanceSession: {
    create: MockFn;
    findUnique: MockFn;
    findMany: MockFn;
    update: MockFn;
    count: MockFn;
  };
  attendanceRecord: {
    findUnique: MockFn;
    create: MockFn;
    createMany: MockFn;
    update: MockFn;
  };
  attendanceCorrection: {
    create: MockFn;
  };
  attendanceEvent: {
    create: MockFn;
    findMany: MockFn;
  };
  attendanceIdempotency: {
    findUnique: MockFn;
    create: MockFn;
  };
  player: {
    findUnique: MockFn;
    findMany: MockFn;
  };
  playerEnrollment: {
    findFirst: MockFn;
  };
  user: {
    findMany: MockFn;
  };
}

describe('AttendanceService', () => {
  let service: AttendanceService;
  let mockPrisma: MockPrisma;
  let mockAudit: { logEvent: MockFn };

  const tenantContext: TenantContext = {
    tenantId: '00000000-0000-4000-8000-000000000201',
    branchId: '00000000-0000-4000-8000-000000000211',
    actorUserId: '00000000-0000-4000-8000-000000000241',
    locale: 'en',
  };

  beforeEach(() => {
    mockPrisma = {
      withTenantTransaction: vi.fn(async (_opts, fn) => fn(mockPrisma)),
      branch: {
        findUnique: vi.fn(),
      },
      trainingGroup: {
        findUnique: vi.fn(),
      },
      attendanceSession: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      attendanceRecord: {
        findUnique: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
      },
      attendanceCorrection: {
        create: vi.fn(),
      },
      attendanceEvent: {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
      },
      attendanceIdempotency: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      player: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      playerEnrollment: {
        findFirst: vi.fn().mockResolvedValue({ id: 'enr-1', status: 'ACTIVE' }),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    service = new AttendanceService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('createSession', () => {
    it('creates attendance session and populates roster from active group members', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({
        id: tenantContext.branchId,
        status: 'ACTIVE',
      });
      mockPrisma.trainingGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        branchId: tenantContext.branchId,
        status: 'ACTIVE',
        members: [{ playerId: 'p1' }, { playerId: 'p2' }],
      });
      mockPrisma.attendanceSession.create.mockResolvedValue({
        id: 'session-1',
        groupName: 'U14 Boys',
      });

      const result = await service.createSession(tenantContext, {
        branchId: tenantContext.branchId!,
        groupId: 'group-1',
        sport: 'FOOTBALL',
        groupName: 'U14 Boys',
        sessionDate: '2026-10-20',
        startTime: '16:00',
        endTime: '17:30',
      });

      expect(result.id).toBe('session-1');
      expect(mockPrisma.attendanceSession.create).toHaveBeenCalled();
      expect(mockPrisma.attendanceRecord.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ playerId: 'p1', status: 'UNMARKED' }),
            expect.objectContaining({ playerId: 'p2', status: 'UNMARKED' }),
          ]),
        }),
      );
    });

    it('rejects creating session in unauthorized branch', async () => {
      await expect(
        service.createSession(tenantContext, {
          branchId: '00000000-0000-4000-8000-000000000299',
          sport: 'FOOTBALL',
          groupName: 'U14 Boys',
          sessionDate: '2026-10-20',
          startTime: '16:00',
          endTime: '17:30',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('recordAttendance', () => {
    const request = {
      sessionId: 'session-1',
      playerId: 'player-1',
      status: 'PRESENT' as const,
      idempotencyKey: '00000000-0000-4000-8000-000000000401',
    };

    it('records player attendance, writes append-only event, and stores idempotency', async () => {
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'IN_PROGRESS',
      });
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'rec-1',
        sessionId: 'session-1',
        playerId: 'player-1',
        status: 'UNMARKED',
        version: 1,
      });
      mockPrisma.attendanceRecord.update.mockResolvedValue({
        id: 'rec-1',
        sessionId: 'session-1',
        playerId: 'player-1',
        status: 'PRESENT',
        version: 2,
      });

      const res = await service.recordAttendance(tenantContext, request);
      expect(res.record.status).toBe('PRESENT');
      expect(mockPrisma.attendanceEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            newStatus: 'PRESENT',
            source: 'MANUAL',
          }),
        }),
      );
      expect(mockPrisma.attendanceIdempotency.create).toHaveBeenCalled();
    });

    it('returns existing cached response on idempotent retry', async () => {
      mockPrisma.attendanceIdempotency.findUnique.mockResolvedValue({
        response: { record: { id: 'rec-1', status: 'PRESENT' } },
      });

      const res = await service.recordAttendance(tenantContext, request);
      expect(res).toEqual({ record: { id: 'rec-1', status: 'PRESENT' } });
      expect(mockPrisma.attendanceRecord.update).not.toHaveBeenCalled();
    });

    it('rejects recording on closed session', async () => {
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'CLOSED',
      });

      await expect(service.recordAttendance(tenantContext, request)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects on version conflict', async () => {
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'IN_PROGRESS',
      });
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'rec-1',
        sessionId: 'session-1',
        playerId: 'player-1',
        status: 'UNMARKED',
        version: 5,
      });

      await expect(
        service.recordAttendance(tenantContext, {
          ...request,
          expectedVersion: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects recording attendance if player is not actively enrolled in the session branch', async () => {
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'IN_PROGRESS',
      });
      mockPrisma.playerEnrollment.findFirst.mockResolvedValue(null);

      await expect(service.recordAttendance(tenantContext, request)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('bulkRecordAttendance', () => {
    it('marks attendance for multiple records atomically with append-only events', async () => {
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'IN_PROGRESS',
      });
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'rec-1',
        sessionId: 'session-1',
        playerId: 'p1',
        status: 'UNMARKED',
        version: 1,
      });
      mockPrisma.attendanceRecord.update.mockResolvedValue({
        id: 'rec-1',
        sessionId: 'session-1',
        playerId: 'p1',
        status: 'PRESENT',
        version: 2,
      });

      const res = await service.bulkRecordAttendance(tenantContext, {
        sessionId: 'session-1',
        idempotencyKey: 'idemp-bulk-1',
        records: [{ playerId: 'p1', status: 'PRESENT' }],
      });

      expect(res.count).toBe(1);
      expect(mockPrisma.attendanceEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'BULK_MARK',
          }),
        }),
      );
    });

    it('rejects bulk recording if a player is not actively enrolled in the session branch', async () => {
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'IN_PROGRESS',
      });
      mockPrisma.playerEnrollment.findFirst.mockResolvedValue(null);

      await expect(
        service.bulkRecordAttendance(tenantContext, {
          sessionId: 'session-1',
          idempotencyKey: 'idemp-bulk-err',
          records: [{ playerId: 'p-transferred', status: 'PRESENT' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('temporary QR check-in', () => {
    it('generates a secure temporary token with expiry', async () => {
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'IN_PROGRESS',
      });
      mockPrisma.attendanceSession.update.mockResolvedValue({});

      const res = await service.generateQrCode(tenantContext, 'session-1', {
        expiresInSeconds: 60,
      });
      expect(res.token).toBeDefined();
      expect(res.qrPayload).toContain('ACADEMY_CHECKIN');
      expect(res.expiresAt).toBeDefined();
    });

    it('checks in player with valid QR token and writes QR_CHECKIN event', async () => {
      const futureDate = new Date(Date.now() + 60000);
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'IN_PROGRESS',
        qrCodeSecret: 'valid-secret-token',
        qrCodeExpiresAt: futureDate,
      });
      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        firstName: 'Tsubasa',
        lastName: 'Ozora',
        status: 'ACTIVE',
      });
      mockPrisma.playerEnrollment.findFirst.mockResolvedValue({
        id: 'enr-1',
        status: 'ACTIVE',
      });
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'rec-1',
        sessionId: 'session-1',
        playerId: 'player-1',
        status: 'UNMARKED',
        version: 1,
      });
      mockPrisma.attendanceRecord.update.mockResolvedValue({
        id: 'rec-1',
        status: 'PRESENT',
      });

      const res = await service.checkInViaQr(tenantContext, 'session-1', {
        token: 'valid-secret-token',
        playerId: 'player-1',
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.attendanceEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'QR_CHECKIN',
          }),
        }),
      );
    });

    it('rejects QR check-in if player is not actively enrolled in the session branch', async () => {
      const futureDate = new Date(Date.now() + 60000);
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'IN_PROGRESS',
        qrCodeSecret: 'valid-secret-token',
        qrCodeExpiresAt: futureDate,
      });
      mockPrisma.player.findUnique.mockResolvedValue({
        id: 'player-1',
        status: 'ACTIVE',
      });
      mockPrisma.playerEnrollment.findFirst.mockResolvedValue(null);

      await expect(
        service.checkInViaQr(tenantContext, 'session-1', {
          token: 'valid-secret-token',
          playerId: 'player-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects expired QR token', async () => {
      const pastDate = new Date(Date.now() - 5000);
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'IN_PROGRESS',
        qrCodeSecret: 'valid-secret-token',
        qrCodeExpiresAt: pastDate,
      });

      await expect(
        service.checkInViaQr(tenantContext, 'session-1', {
          token: 'valid-secret-token',
          playerId: 'player-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('closeSession', () => {
    it('closes session and records closing actor and timestamp', async () => {
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'SCHEDULED',
      });
      mockPrisma.attendanceSession.update.mockResolvedValue({
        id: 'session-1',
        status: 'CLOSED',
      });

      const result = await service.closeSession(tenantContext, 'session-1');
      expect(result.status).toBe('CLOSED');
      expect(mockPrisma.attendanceSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CLOSED',
            closedByUserId: tenantContext.actorUserId,
          }),
        }),
      );
    });

    it('rejects closing an already closed session', async () => {
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'CLOSED',
      });

      await expect(service.closeSession(tenantContext, 'session-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('correctAttendance', () => {
    it('creates immutable correction record and increments version', async () => {
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'rec-1',
        sessionId: 'session-1',
        playerId: 'player-1',
        version: 2,
        status: 'ABSENT',
        session: { branchId: tenantContext.branchId },
      });
      mockPrisma.attendanceRecord.update.mockResolvedValue({
        id: 'rec-1',
        version: 3,
        status: 'PRESENT',
      });
      mockPrisma.attendanceCorrection.create.mockResolvedValue({
        id: 'corr-1',
        reason: 'Player arrived late from traffic',
      });

      const result = await service.correctAttendance(tenantContext, {
        recordId: '00000000-0000-4000-8000-000000000501',
        newStatus: 'PRESENT',
        reason: 'Player arrived late from traffic',
        expectedVersion: 2,
      });

      expect(result.record.version).toBe(3);
      expect(mockPrisma.attendanceCorrection.create).toHaveBeenCalled();
      expect(mockPrisma.attendanceEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            newStatus: 'PRESENT',
            previousStatus: 'ABSENT',
          }),
        }),
      );
    });
  });

  describe('getAttendanceReports', () => {
    it('aggregates rate and breakdown by group and branch', async () => {
      mockPrisma.attendanceSession.findMany.mockResolvedValue([
        {
          id: 's1',
          branchId: 'b1',
          groupId: 'g1',
          groupName: 'U12',
          branch: { id: 'b1', name: 'Main' },
          records: [
            { status: 'PRESENT' },
            { status: 'PRESENT' },
            { status: 'LATE' },
            { status: 'ABSENT' },
          ],
        },
      ]);

      const report = await service.getAttendanceReports(tenantContext, {});
      expect(report.totalSessions).toBe(1);
      expect(report.totalRecords).toBe(4);
      expect(report.presentCount).toBe(2);
      expect(report.lateCount).toBe(1);
      expect(report.absentCount).toBe(1);
      expect(report.attendanceRate).toBe(75); // (2+1)/4 = 75%
      expect(report.byGroup).toHaveLength(1);
      expect(report.byBranch).toHaveLength(1);
    });
  });
});
