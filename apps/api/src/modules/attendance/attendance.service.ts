import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ErrorCode,
  type AttendanceCorrection,
  type AttendanceMutation,
  type BulkAttendanceSubmission,
  type CreateAttendanceSession,
  type TenantContext,
} from '@academy/shared';

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /**
   * Creates an attendance training session in a branch.
   */
  async createSession(tenantContext: TenantContext, dto: CreateAttendanceSession) {
    if (tenantContext.branchId && tenantContext.branchId !== dto.branchId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access restricted to your assigned branch',
      });
    }

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        // Verify branch belongs to tenant
        const branch = await tx.branch.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: dto.branchId,
            },
          },
        });

        if (!branch) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Branch not found in this academy',
          });
        }

        const session = await tx.attendanceSession.create({
          data: {
            tenantId: tenantContext.tenantId,
            branchId: dto.branchId,
            sport: dto.sport,
            groupName: dto.groupName.trim(),
            sessionDate: new Date(`${dto.sessionDate}T00:00:00.000Z`),
            startTime: dto.startTime,
            endTime: dto.endTime,
            status: 'SCHEDULED',
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'ATTENDANCE_SESSION_CREATED',
            resourceType: 'AttendanceSession',
            resourceId: session.id,
            metadata: {
              branchId: dto.branchId,
              groupName: dto.groupName,
              sessionDate: dto.sessionDate,
            },
          },
          tx,
        );

        return session;
      },
    );
  }

  /**
   * Retrieves a session by ID with its attendance records.
   */
  async getSession(tenantContext: TenantContext, sessionId: string) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const session = await tx.attendanceSession.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: sessionId,
            },
          },
          include: {
            branch: { select: { id: true, name: true, code: true } },
            records: {
              orderBy: { createdAt: 'asc' },
              include: { corrections: { orderBy: { createdAt: 'desc' } } },
            },
          },
        });

        if (!session) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Attendance session not found',
          });
        }

        if (tenantContext.branchId && session.branchId !== tenantContext.branchId) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Access restricted to your assigned branch',
          });
        }

        return session;
      },
    );
  }

  /**
   * Lists sessions in the academy, optionally filtered by branch and date.
   */
  async listSessions(tenantContext: TenantContext, branchId?: string, sessionDate?: string) {
    const effectiveBranchId = tenantContext.branchId || branchId;

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        return tx.attendanceSession.findMany({
          where: {
            tenantId: tenantContext.tenantId,
            ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
            ...(sessionDate ? { sessionDate: new Date(`${sessionDate}T00:00:00.000Z`) } : {}),
          },
          include: {
            branch: { select: { id: true, name: true, code: true } },
            _count: { select: { records: true } },
          },
          orderBy: [{ sessionDate: 'desc' }, { startTime: 'asc' }],
        });
      },
    );
  }

  /**
   * Closes an attendance session.
   * Permission-controlled: Records cannot be directly modified once session is CLOSED.
   */
  async closeSession(tenantContext: TenantContext, sessionId: string) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const session = await tx.attendanceSession.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: sessionId,
            },
          },
        });

        if (!session) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Attendance session not found',
          });
        }

        if (tenantContext.branchId && session.branchId !== tenantContext.branchId) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Access restricted to your assigned branch',
          });
        }

        if (session.status === 'CLOSED') {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Attendance session is already closed',
          });
        }

        const updated = await tx.attendanceSession.update({
          where: { id: sessionId },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closedByUserId: tenantContext.actorUserId,
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'ATTENDANCE_SESSION_CLOSED',
            resourceType: 'AttendanceSession',
            resourceId: sessionId,
          },
          tx,
        );

        return updated;
      },
    );
  }

  /**
   * Records attendance for a single player with idempotency and optimistic concurrency.
   */
  async recordAttendance(_tenantContext: TenantContext, _dto: AttendanceMutation): Promise<never> {
    // Fail closed: there is no verified player registry or session enrollment yet.
    throw new ServiceUnavailableException(
      'Attendance marking requires verified player enrollment and session roster',
    );
  }

  /**
   * Bulk records attendance for multiple players in a session.
   * Enforces idempotency and ensures no unregistered players are marked.
   */
  async bulkRecordAttendance(
    _tenantContext: TenantContext,
    _dto: BulkAttendanceSubmission,
  ): Promise<never> {
    // Fail closed: there is no verified player registry or session enrollment yet.
    throw new ServiceUnavailableException(
      'Attendance marking requires verified player enrollment and session roster',
    );
  }

  /**
   * Corrects attendance record after session closure or for auditable mistake corrections.
   * Inserts immutable audit history into attendance_corrections table.
   */
  async correctAttendance(tenantContext: TenantContext, dto: AttendanceCorrection) {
    if (!dto.reason || dto.reason.trim().length < 3) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'A valid correction reason is required (minimum 3 characters)',
      });
    }

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const record = await tx.attendanceRecord.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: dto.recordId,
            },
          },
          include: { session: true },
        });

        if (!record) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Attendance record not found in this academy',
          });
        }

        if (tenantContext.branchId && record.session.branchId !== tenantContext.branchId) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Access restricted to your assigned branch',
          });
        }

        // Optimistic concurrency check
        if (record.version !== dto.expectedVersion) {
          throw new ConflictException({
            code: ErrorCode.VERSION_CONFLICT,
            message: `Concurrency conflict on correction: expected version ${dto.expectedVersion} but current is ${record.version}`,
          });
        }

        const previousStatus = record.status;

        // 1. Update the record status and increment version
        const updatedRecord = await tx.attendanceRecord.update({
          where: { id: record.id },
          data: {
            status: dto.newStatus,
            version: record.version + 1,
            markedByUserId: tenantContext.actorUserId,
          },
        });

        // 2. Insert into immutable attendance_corrections history
        const correction = await tx.attendanceCorrection.create({
          data: {
            tenantId: tenantContext.tenantId,
            recordId: record.id,
            previousStatus,
            newStatus: dto.newStatus,
            reason: dto.reason.trim(),
            correctedByUserId: tenantContext.actorUserId,
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'ATTENDANCE_CORRECTED',
            resourceType: 'AttendanceCorrection',
            resourceId: correction.id,
            metadata: {
              recordId: record.id,
              previousStatus,
              newStatus: dto.newStatus,
              reason: dto.reason,
            },
          },
          tx,
        );

        return {
          record: updatedRecord,
          correction,
        };
      },
    );
  }
}
