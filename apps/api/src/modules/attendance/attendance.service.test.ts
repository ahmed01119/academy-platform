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
  attendanceSession: {
    create: MockFn;
    findUnique: MockFn;
    findMany: MockFn;
    update: MockFn;
  };
  attendanceRecord: {
    findUnique: MockFn;
    create: MockFn;
    update: MockFn;
  };
  attendanceCorrection: {
    create: MockFn;
  };
  attendanceIdempotency: {
    findUnique: MockFn;
    create: MockFn;
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
      attendanceSession: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      attendanceRecord: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      attendanceCorrection: {
        create: vi.fn(),
      },
      attendanceIdempotency: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
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
    it('creates attendance session when branch is valid and accessible', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue({ id: tenantContext.branchId });
      mockPrisma.attendanceSession.create.mockResolvedValue({
        id: 'session-1',
        groupName: 'U14 Boys',
      });

      const result = await service.createSession(tenantContext, {
        branchId: tenantContext.branchId!,
        sport: 'FOOTBALL',
        groupName: 'U14 Boys',
        sessionDate: '2026-10-20',
        startTime: '16:00',
        endTime: '17:30',
      });

      expect(result.id).toBe('session-1');
      expect(mockPrisma.attendanceSession.create).toHaveBeenCalled();
    });

    it('rejects creating session in unauthorized branch', async () => {
      await expect(
        service.createSession(tenantContext, {
          branchId: '00000000-0000-4000-8000-000000000299', // Different branch
          sport: 'FOOTBALL',
          groupName: 'U14 Boys',
          sessionDate: '2026-10-20',
          startTime: '16:00',
          endTime: '17:30',
        }),
      ).rejects.toThrow(ForbiddenException);
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

  describe('recordAttendance', () => {
    it('returns cached result when idempotency key was previously processed', async () => {
      const cachedResponse = { id: 'rec-1', status: 'PRESENT' };
      mockPrisma.attendanceIdempotency.findUnique.mockResolvedValue({
        response: cachedResponse,
      });

      const result = await service.recordAttendance(tenantContext, {
        sessionId: 'session-1',
        playerId: '00000000-0000-4000-8000-000000000301',
        status: 'PRESENT',
        idempotencyKey: '00000000-0000-4000-8000-000000000401',
      });

      expect(result).toBe(cachedResponse);
      expect(mockPrisma.attendanceRecord.create).not.toHaveBeenCalled();
      expect(mockPrisma.attendanceRecord.update).not.toHaveBeenCalled();
    });

    it('rejects direct attendance modification when session is CLOSED', async () => {
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'CLOSED',
      });

      await expect(
        service.recordAttendance(tenantContext, {
          sessionId: 'session-1',
          playerId: '00000000-0000-4000-8000-000000000301',
          status: 'PRESENT',
          idempotencyKey: '00000000-0000-4000-8000-000000000401',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects update on optimistic concurrency version conflict', async () => {
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'SCHEDULED',
      });
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'rec-1',
        version: 3, // Current DB version is 3
        status: 'PRESENT',
      });

      await expect(
        service.recordAttendance(tenantContext, {
          sessionId: 'session-1',
          playerId: '00000000-0000-4000-8000-000000000301',
          status: 'LATE',
          expectedVersion: 2, // Client expects version 2 (stale!)
          idempotencyKey: '00000000-0000-4000-8000-000000000402',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates record and increments version upon valid mutation', async () => {
      mockPrisma.attendanceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        branchId: tenantContext.branchId,
        status: 'SCHEDULED',
      });
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'rec-1',
        version: 1,
        status: 'UNMARKED',
      });
      mockPrisma.attendanceRecord.update.mockResolvedValue({
        id: 'rec-1',
        version: 2,
        status: 'PRESENT',
      });

      const result = (await service.recordAttendance(tenantContext, {
        sessionId: 'session-1',
        playerId: '00000000-0000-4000-8000-000000000301',
        status: 'PRESENT',
        expectedVersion: 1,
        idempotencyKey: '00000000-0000-4000-8000-000000000403',
      })) as { id: string; version: number; status: string };

      expect(result.version).toBe(2);
      expect(mockPrisma.attendanceRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 2,
            status: 'PRESENT',
          }),
        }),
      );
      expect(mockPrisma.attendanceIdempotency.create).toHaveBeenCalled();
    });
  });

  describe('correctAttendance', () => {
    it('requires a reason of at least 3 characters', async () => {
      await expect(
        service.correctAttendance(tenantContext, {
          recordId: '00000000-0000-4000-8000-000000000501',
          newStatus: 'PRESENT',
          reason: '  ',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates immutable correction record and increments version', async () => {
      mockPrisma.attendanceRecord.findUnique.mockResolvedValue({
        id: 'rec-1',
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
      expect(mockPrisma.attendanceCorrection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousStatus: 'ABSENT',
            newStatus: 'PRESENT',
            reason: 'Player arrived late from traffic',
            correctedByUserId: tenantContext.actorUserId,
          }),
        }),
      );
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ATTENDANCE_CORRECTED',
        }),
        expect.anything(),
      );
    });
  });
});
