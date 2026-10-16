import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AttendanceService } from './attendance.service';
import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
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

  describe('attendance mutations fail closed until enrollment is implemented', () => {
    const request = {
      sessionId: 'session-1',
      playerId: '00000000-0000-4000-8000-000000000301',
      status: 'PRESENT' as const,
      idempotencyKey: '00000000-0000-4000-8000-000000000401',
    };

    it('rejects individual marking without verified player roster', async () => {
      await expect(service.recordAttendance(tenantContext, request)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(mockPrisma.withTenantTransaction).not.toHaveBeenCalled();
      expect(mockPrisma.attendanceRecord.create).not.toHaveBeenCalled();
      expect(mockPrisma.attendanceRecord.update).not.toHaveBeenCalled();
      expect(mockAudit.logEvent).not.toHaveBeenCalled();
    });

    it('rejects bulk marking without verified player roster', async () => {
      await expect(
        service.bulkRecordAttendance(tenantContext, {
          sessionId: request.sessionId,
          records: [{ playerId: request.playerId, status: 'PRESENT' }],
          idempotencyKey: request.idempotencyKey,
        }),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(mockPrisma.withTenantTransaction).not.toHaveBeenCalled();
      expect(mockPrisma.attendanceRecord.create).not.toHaveBeenCalled();
      expect(mockPrisma.attendanceRecord.update).not.toHaveBeenCalled();
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
