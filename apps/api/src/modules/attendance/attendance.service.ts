import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ErrorCode,
  type AttendanceCorrection,
  type AttendanceEventSummary,
  type AttendanceMutation,
  type AttendanceReportQuery,
  type AttendanceReportSummary,
  type BulkAttendanceSubmission,
  type CreateAttendanceSession,
  type GenerateQrRequest,
  type GenerateQrResponse,
  type QrCheckInRequest,
  type ScanPlayerQrRequest,
  type ScanPlayerQrResponse,
  type OfflineAttendanceBatchSyncRequest,
  type OfflineAttendanceBatchSyncResponse,
  type SessionDetails,
  type SessionQuery,
  type SessionSummary,
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
   * If groupId is provided, automatically populates the session roster with all active group members.
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

        if (!branch || branch.status !== 'ACTIVE') {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Branch not found or inactive',
          });
        }

        // If groupId is provided, verify it exists and belongs to the same branch
        let activeGroupMembers: Array<{ playerId: string }> = [];
        if (dto.groupId) {
          const group = await tx.trainingGroup.findUnique({
            where: {
              tenantId_id: {
                tenantId: tenantContext.tenantId,
                id: dto.groupId,
              },
            },
            include: {
              members: {
                where: { status: 'ACTIVE' },
                select: { playerId: true },
              },
            },
          });

          if (!group || group.status !== 'ACTIVE') {
            throw new NotFoundException({
              code: ErrorCode.NOT_FOUND,
              message: 'Training group not found or inactive',
            });
          }

          if (group.branchId !== dto.branchId) {
            throw new BadRequestException({
              code: ErrorCode.VALIDATION_FAILED,
              message: 'Training group does not belong to the selected branch',
            });
          }

          activeGroupMembers = group.members;
        }

        const session = await tx.attendanceSession.create({
          data: {
            tenantId: tenantContext.tenantId,
            branchId: dto.branchId,
            groupId: dto.groupId || null,
            coachUserId: dto.coachUserId || null,
            sport: dto.sport,
            groupName: dto.groupName.trim(),
            sessionDate: new Date(`${dto.sessionDate}T00:00:00.000Z`),
            startTime: dto.startTime,
            endTime: dto.endTime,
            status: 'SCHEDULED',
          },
        });

        // Initialize roster records for all active group members as UNMARKED
        if (activeGroupMembers.length > 0) {
          await tx.attendanceRecord.createMany({
            data: activeGroupMembers.map((m) => ({
              tenantId: tenantContext.tenantId,
              sessionId: session.id,
              playerId: m.playerId,
              status: 'UNMARKED',
              version: 1,
            })),
          });
        }

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'ATTENDANCE_SESSION_CREATED',
            resourceType: 'AttendanceSession',
            resourceId: session.id,
            metadata: {
              branchId: dto.branchId,
              groupId: dto.groupId,
              groupName: dto.groupName,
              sessionDate: dto.sessionDate,
              initialRosterCount: activeGroupMembers.length,
            },
          },
          tx,
        );

        return session;
      },
    );
  }

  /**
   * Retrieves a session by ID with its full attendance roster and counts.
   */
  async getSession(tenantContext: TenantContext, sessionId: string): Promise<SessionDetails> {
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
            group: { select: { id: true, name: true } },
            coachUser: { select: { id: true, name: true } },
            records: {
              include: {
                corrections: { orderBy: { createdAt: 'desc' } },
              },
              orderBy: { createdAt: 'asc' },
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

        // Fetch player names and active subscriptions for records
        const playerIds = session.records.map((r) => r.playerId);
        const [players, subscriptions] = await Promise.all([
          tx.player.findMany({
            where: {
              tenantId: tenantContext.tenantId,
              id: { in: playerIds },
            },
            select: { id: true, firstName: true, lastName: true, photoUrl: true },
          }),
          tx.playerSubscription.findMany({
            where: {
              tenantId: tenantContext.tenantId,
              playerId: { in: playerIds },
            },
            orderBy: { createdAt: 'desc' },
          }),
        ]);

        const playerMap = new Map(players.map((p) => [p.id, p]));
        const subMap = new Map();
        for (const sub of subscriptions) {
          if (!subMap.has(sub.playerId)) {
            subMap.set(sub.playerId, sub);
          }
        }

        let present = 0;
        let late = 0;
        let absent = 0;
        let excused = 0;
        let unmarked = 0;

        const roster = session.records.map((r) => {
          if (r.status === 'PRESENT') present++;
          else if (r.status === 'LATE') late++;
          else if (r.status === 'ABSENT') absent++;
          else if (r.status === 'EXCUSED') excused++;
          else unmarked++;

          const p = playerMap.get(r.playerId);
          const s = subMap.get(r.playerId);

          return {
            recordId: r.id,
            playerId: r.playerId,
            playerName: p ? `${p.firstName} ${p.lastName}` : 'لاعب غير معروف',
            photoUrl: p?.photoUrl || null,
            status: r.status,
            checkInTime: r.checkInTime ? r.checkInTime.toISOString() : null,
            remarks: r.remarks,
            version: r.version,
            subscriptionStatus: (s?.status as any) ?? 'OVERDUE',
            outstandingBalance: s?.outstandingBalance ?? 0,
            amountDue: s?.outstandingBalance ?? 0,
            nextPaymentDate: s?.dueDate ? s.dueDate.toISOString().slice(0, 10) : null,
            lastPaymentDate: s?.lastPaymentDate ? s.lastPaymentDate.toISOString() : null,
            subscriptionId: s?.id ?? null,
          };
        });

        const hasActiveQr = Boolean(
          session.qrCodeSecret &&
          session.qrCodeExpiresAt &&
          new Date(session.qrCodeExpiresAt) > new Date(),
        );

        return {
          id: session.id,
          tenantId: session.tenantId,
          branchId: session.branchId,
          branchName: session.branch.name,
          groupId: session.groupId,
          groupName: session.groupName,
          coachUserId: session.coachUserId,
          coachName: session.coachUser?.name || null,
          sport: session.sport,
          sessionDate: session.sessionDate.toISOString().slice(0, 10),
          startTime: session.startTime,
          endTime: session.endTime,
          status: session.status,
          totalExpected: session.records.length,
          totalPresent: present,
          totalLate: late,
          totalAbsent: absent,
          totalExcused: excused,
          totalUnmarked: unmarked,
          hasActiveQr,
          closedAt: session.closedAt ? session.closedAt.toISOString() : null,
          createdAt: session.createdAt.toISOString(),
          roster,
        };
      },
    );
  }

  /**
   * Lists sessions in the academy with summary metrics.
   */
  async listSessions(tenantContext: TenantContext, query?: SessionQuery) {
    const effectiveBranchId = tenantContext.branchId || query?.branchId;

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const whereClause = {
          tenantId: tenantContext.tenantId,
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
          ...(query?.groupId ? { groupId: query.groupId } : {}),
          ...(query?.coachUserId ? { coachUserId: query.coachUserId } : {}),
          ...(query?.status ? { status: query.status } : {}),
          ...(query?.dateFrom || query?.dateTo
            ? {
                sessionDate: {
                  ...(query?.dateFrom ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) } : {}),
                  ...(query?.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {}),
                },
              }
            : {}),
        };

        const page = query?.page || 1;
        const limit = query?.limit || 20;
        const skip = (page - 1) * limit;

        const total = await tx.attendanceSession.count({ where: whereClause });

        const sessions = await tx.attendanceSession.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: [{ sessionDate: 'desc' }, { startTime: 'asc' }],
          include: {
            branch: { select: { id: true, name: true, code: true } },
            coachUser: { select: { id: true, name: true } },
            records: {
              select: { status: true },
            },
          },
        });

        const items: SessionSummary[] = sessions.map((s) => {
          let present = 0;
          let late = 0;
          let absent = 0;
          let excused = 0;
          let unmarked = 0;

          for (const r of s.records) {
            if (r.status === 'PRESENT') present++;
            else if (r.status === 'LATE') late++;
            else if (r.status === 'ABSENT') absent++;
            else if (r.status === 'EXCUSED') excused++;
            else unmarked++;
          }

          const hasActiveQr = Boolean(
            s.qrCodeSecret && s.qrCodeExpiresAt && new Date(s.qrCodeExpiresAt) > new Date(),
          );

          return {
            id: s.id,
            tenantId: s.tenantId,
            branchId: s.branchId,
            branchName: s.branch.name,
            groupId: s.groupId,
            groupName: s.groupName,
            coachUserId: s.coachUserId,
            coachName: s.coachUser?.name || null,
            sport: s.sport,
            sessionDate: s.sessionDate.toISOString().slice(0, 10),
            startTime: s.startTime,
            endTime: s.endTime,
            status: s.status,
            totalExpected: s.records.length,
            totalPresent: present,
            totalLate: late,
            totalAbsent: absent,
            totalExcused: excused,
            totalUnmarked: unmarked,
            hasActiveQr,
            closedAt: s.closedAt ? s.closedAt.toISOString() : null,
            createdAt: s.createdAt.toISOString(),
          };
        });

        return {
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        };
      },
    );
  }

  /**
   * Closes an attendance session.
   * Records cannot be directly modified once session is CLOSED.
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
            qrCodeSecret: null,
            qrCodeExpiresAt: null,
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
   * Writes append-only AttendanceEvent for audit stream.
   */
  async recordAttendance(tenantContext: TenantContext, dto: AttendanceMutation) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        // Idempotency check
        const existingIdempotency = await tx.attendanceIdempotency.findUnique({
          where: {
            tenantId_key: {
              tenantId: tenantContext.tenantId,
              key: dto.idempotencyKey,
            },
          },
        });

        if (existingIdempotency?.response) {
          return existingIdempotency.response;
        }

        const session = await tx.attendanceSession.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: dto.sessionId,
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
            message:
              'Cannot record attendance on a closed session. Use correction workflow instead.',
          });
        }

        // Verify player has active enrollment in the session branch (prevents stale access after transfers)
        const activeEnrollment = await tx.playerEnrollment.findFirst({
          where: {
            tenantId: tenantContext.tenantId,
            playerId: dto.playerId,
            branchId: session.branchId,
            status: 'ACTIVE',
          },
        });

        if (!activeEnrollment) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'اللاعب غير مسجل بنشاط في هذا الفرع (Player is not actively enrolled in this branch)',
          });
        }

        // Find or create attendance record for this player
        let record = await tx.attendanceRecord.findUnique({
          where: {
            sessionId_playerId: {
              sessionId: dto.sessionId,
              playerId: dto.playerId,
            },
          },
        });

        if (!record) {
          // Verify player exists in tenant
          const player = await tx.player.findUnique({
            where: {
              tenantId_id: {
                tenantId: tenantContext.tenantId,
                id: dto.playerId,
              },
            },
          });

          if (!player) {
            throw new NotFoundException({
              code: ErrorCode.NOT_FOUND,
              message: 'Player not found in this academy',
            });
          }

          record = await tx.attendanceRecord.create({
            data: {
              tenantId: tenantContext.tenantId,
              sessionId: dto.sessionId,
              playerId: dto.playerId,
              status: 'UNMARKED',
              version: 1,
            },
          });
        }

        // Optimistic concurrency check if provided
        if (dto.expectedVersion !== undefined && record.version !== dto.expectedVersion) {
          throw new ConflictException({
            code: ErrorCode.VERSION_CONFLICT,
            message: `Version conflict: expected ${dto.expectedVersion} but record version is ${record.version}`,
          });
        }

        const previousStatus = record.status;
        const isPresentOrLate = dto.status === 'PRESENT' || dto.status === 'LATE';

        const updatedRecord = await tx.attendanceRecord.update({
          where: { id: record.id },
          data: {
            status: dto.status,
            version: record.version + 1,
            checkInTime: isPresentOrLate ? record.checkInTime || new Date() : null,
            markedByUserId: tenantContext.actorUserId,
            remarks: dto.reason?.trim() || record.remarks,
          },
        });

        // Write append-only attendance event
        await tx.attendanceEvent.create({
          data: {
            tenantId: tenantContext.tenantId,
            recordId: updatedRecord.id,
            sessionId: dto.sessionId,
            playerId: dto.playerId,
            actorUserId: tenantContext.actorUserId,
            previousStatus,
            newStatus: dto.status,
            source: 'MANUAL',
            reason: dto.reason?.trim() || null,
          },
        });

        // Fetch player identity for complete roster item contract
        const player = await tx.player.findUnique({
          where: { id: dto.playerId },
          select: { firstName: true, lastName: true, photoUrl: true },
        });

        const rosterItem = {
          recordId: updatedRecord.id,
          playerId: updatedRecord.playerId,
          playerName: player ? `${player.firstName} ${player.lastName}` : 'لاعب غير معروف',
          photoUrl: player?.photoUrl || null,
          status: updatedRecord.status,
          checkInTime: updatedRecord.checkInTime ? updatedRecord.checkInTime.toISOString() : null,
          remarks: updatedRecord.remarks,
          version: updatedRecord.version,
        };

        const responsePayload = {
          record: rosterItem,
          previousStatus,
        };

        // Save idempotency key
        await tx.attendanceIdempotency.create({
          data: {
            tenantId: tenantContext.tenantId,
            key: dto.idempotencyKey,
            sessionId: dto.sessionId,
            response: responsePayload,
          },
        });

        return responsePayload;
      },
    );
  }

  /**
   * Bulk records attendance for multiple players in a session with idempotency.
   */
  async bulkRecordAttendance(tenantContext: TenantContext, dto: BulkAttendanceSubmission) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        // Idempotency check
        const existingIdempotency = await tx.attendanceIdempotency.findUnique({
          where: {
            tenantId_key: {
              tenantId: tenantContext.tenantId,
              key: dto.idempotencyKey,
            },
          },
        });

        if (existingIdempotency?.response) {
          return existingIdempotency.response;
        }

        const session = await tx.attendanceSession.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: dto.sessionId,
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
            message: 'Cannot record attendance on a closed session',
          });
        }

        const updatedRecords = [];

        for (const item of dto.records) {
          const activeEnrollment = await tx.playerEnrollment.findFirst({
            where: {
              tenantId: tenantContext.tenantId,
              playerId: item.playerId,
              branchId: session.branchId,
              status: 'ACTIVE',
            },
          });

          if (!activeEnrollment) {
            throw new BadRequestException({
              code: ErrorCode.VALIDATION_FAILED,
              message: `اللاعب ${item.playerId} غير مسجل بنشاط في هذا الفرع (Player is not actively enrolled in this branch)`,
            });
          }

          let record = await tx.attendanceRecord.findUnique({
            where: {
              sessionId_playerId: {
                sessionId: dto.sessionId,
                playerId: item.playerId,
              },
            },
          });

          if (!record) {
            record = await tx.attendanceRecord.create({
              data: {
                tenantId: tenantContext.tenantId,
                sessionId: dto.sessionId,
                playerId: item.playerId,
                status: 'UNMARKED',
                version: 1,
              },
            });
          }

          if (item.expectedVersion !== undefined && record.version !== item.expectedVersion) {
            throw new ConflictException({
              code: ErrorCode.VERSION_CONFLICT,
              message: `Version conflict for player ${item.playerId}: expected ${item.expectedVersion} but is ${record.version}`,
            });
          }

          const previousStatus = record.status;
          const isPresentOrLate = item.status === 'PRESENT' || item.status === 'LATE';

          const updated = await tx.attendanceRecord.update({
            where: { id: record.id },
            data: {
              status: item.status,
              version: record.version + 1,
              checkInTime: isPresentOrLate ? record.checkInTime || new Date() : null,
              markedByUserId: tenantContext.actorUserId,
              remarks: item.remarks?.trim() || record.remarks,
            },
          });

          await tx.attendanceEvent.create({
            data: {
              tenantId: tenantContext.tenantId,
              recordId: updated.id,
              sessionId: dto.sessionId,
              playerId: item.playerId,
              actorUserId: tenantContext.actorUserId,
              previousStatus,
              newStatus: item.status,
              source: 'BULK_MARK',
              reason: item.remarks?.trim() || 'Bulk attendance submission',
            },
          });

          updatedRecords.push(updated);
        }

        const responsePayload = {
          count: updatedRecords.length,
          records: updatedRecords,
        };

        await tx.attendanceIdempotency.create({
          data: {
            tenantId: tenantContext.tenantId,
            key: dto.idempotencyKey,
            sessionId: dto.sessionId,
            response: responsePayload,
          },
        });

        return responsePayload;
      },
    );
  }

  /**
   * Generates a short-lived temporary QR code token for a session.
   */
  async generateQrCode(
    tenantContext: TenantContext,
    sessionId: string,
    dto: GenerateQrRequest,
  ): Promise<GenerateQrResponse> {
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
            message: 'Cannot generate QR code for a closed session',
          });
        }

        const token = crypto.randomBytes(24).toString('hex');
        const expiresInSeconds = dto.expiresInSeconds || 60;
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

        await tx.attendanceSession.update({
          where: { id: sessionId },
          data: {
            qrCodeSecret: token,
            qrCodeExpiresAt: expiresAt,
          },
        });

        const qrPayload = JSON.stringify({
          type: 'ACADEMY_CHECKIN',
          sessionId,
          token,
          expiresAt: expiresAt.toISOString(),
        });

        return {
          sessionId,
          token,
          qrPayload,
          expiresAt: expiresAt.toISOString(),
        };
      },
    );
  }

  /**
   * Checks in a player using a temporary QR code token.
   */
  async checkInViaQr(tenantContext: TenantContext, sessionId: string, dto: QrCheckInRequest) {
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

        if (session.status === 'CLOSED') {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Attendance session is closed',
          });
        }

        if (!session.qrCodeSecret || !session.qrCodeExpiresAt) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'QR check-in is not active for this session',
          });
        }

        if (new Date() > new Date(session.qrCodeExpiresAt)) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'QR code has expired. Please ask the coach for a new QR code',
          });
        }

        // Constant-time token comparison
        const expectedBuffer = Buffer.from(session.qrCodeSecret);
        const actualBuffer = Buffer.from(dto.token);
        if (
          expectedBuffer.length !== actualBuffer.length ||
          !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
        ) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Invalid QR code token',
          });
        }

        // Verify player exists and is active
        const player = await tx.player.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: dto.playerId,
            },
          },
        });

        if (!player || player.status !== 'ACTIVE') {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Player is not registered or not active',
          });
        }

        const activeEnrollment = await tx.playerEnrollment.findFirst({
          where: {
            tenantId: tenantContext.tenantId,
            playerId: dto.playerId,
            branchId: session.branchId,
            status: 'ACTIVE',
          },
        });

        if (!activeEnrollment) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'اللاعب غير مسجل بنشاط في هذا الفرع (Player is not actively enrolled in this branch)',
          });
        }

        let record = await tx.attendanceRecord.findUnique({
          where: {
            sessionId_playerId: {
              sessionId,
              playerId: dto.playerId,
            },
          },
        });

        const checkInTime = new Date();
        const previousStatus = record ? record.status : 'UNMARKED';

        if (!record) {
          record = await tx.attendanceRecord.create({
            data: {
              tenantId: tenantContext.tenantId,
              sessionId,
              playerId: dto.playerId,
              status: 'PRESENT',
              checkInTime,
              markedByUserId: tenantContext.actorUserId,
              version: 1,
            },
          });
        } else {
          record = await tx.attendanceRecord.update({
            where: { id: record.id },
            data: {
              status: 'PRESENT',
              checkInTime: record.checkInTime || checkInTime,
              version: record.version + 1,
              markedByUserId: tenantContext.actorUserId,
            },
          });
        }

        // Log append-only event
        await tx.attendanceEvent.create({
          data: {
            tenantId: tenantContext.tenantId,
            recordId: record.id,
            sessionId,
            playerId: dto.playerId,
            actorUserId: tenantContext.actorUserId,
            previousStatus,
            newStatus: 'PRESENT',
            source: 'QR_CHECKIN',
            reason: 'QR Code instant check-in',
          },
        });

        return {
          success: true,
          message: `تم تسجيل حضور اللاعب ${player.firstName} ${player.lastName} بنجاح عبر رمز QR`,
          playerId: player.id,
          playerName: `${player.firstName} ${player.lastName}`,
          checkInTime: checkInTime.toISOString(),
          status: 'PRESENT',
        };
      },
    );
  }

  /**
   * Corrects attendance record after session closure or for auditable mistake corrections.
   * Inserts immutable audit history into attendance_corrections table and attendance_events.
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

        // 3. Insert into immutable attendance_events log
        await tx.attendanceEvent.create({
          data: {
            tenantId: tenantContext.tenantId,
            recordId: record.id,
            sessionId: record.sessionId,
            playerId: record.playerId,
            actorUserId: tenantContext.actorUserId,
            previousStatus,
            newStatus: dto.newStatus,
            source: 'MANUAL',
            reason: dto.reason.trim(),
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

  /**
   * Retrieves the immutable append-only event stream for a session.
   */
  async getSessionEvents(
    tenantContext: TenantContext,
    sessionId: string,
  ): Promise<AttendanceEventSummary[]> {
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

        const events = await tx.attendanceEvent.findMany({
          where: {
            tenantId: tenantContext.tenantId,
            sessionId,
          },
          orderBy: { eventAt: 'desc' },
          include: {
            player: { select: { firstName: true, lastName: true } },
          },
        });

        // Get actor names
        const actorIds = events.map((e) => e.actorUserId).filter((id): id is string => Boolean(id));
        const actors = await tx.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        });
        const actorMap = new Map(actors.map((a) => [a.id, a.name]));

        return events.map((e) => ({
          id: e.id,
          tenantId: e.tenantId,
          recordId: e.recordId,
          sessionId: e.sessionId,
          playerId: e.playerId,
          playerName: `${e.player.firstName} ${e.player.lastName}`,
          actorUserId: e.actorUserId,
          actorName: e.actorUserId ? actorMap.get(e.actorUserId) || null : null,
          previousStatus: e.previousStatus,
          newStatus: e.newStatus,
          source: e.source,
          reason: e.reason,
          metadata: e.metadata as Record<string, unknown> | null,
          eventAt: e.eventAt.toISOString(),
        }));
      },
    );
  }

  /**
   * Generates aggregated attendance reports across branches and groups.
   */
  async getAttendanceReports(
    tenantContext: TenantContext,
    query: AttendanceReportQuery,
  ): Promise<AttendanceReportSummary> {
    const effectiveBranchId = tenantContext.branchId || query.branchId;

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const sessionWhere = {
          tenantId: tenantContext.tenantId,
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
          ...(query.groupId ? { groupId: query.groupId } : {}),
          ...(query.dateFrom || query.dateTo
            ? {
                sessionDate: {
                  ...(query.dateFrom ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) } : {}),
                  ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {}),
                },
              }
            : {}),
        };

        const sessions = await tx.attendanceSession.findMany({
          where: sessionWhere,
          include: {
            branch: { select: { id: true, name: true } },
            records: {
              where: query.playerId ? { playerId: query.playerId } : {},
              select: { status: true },
            },
          },
        });

        let totalRecords = 0;
        let presentCount = 0;
        let lateCount = 0;
        let absentCount = 0;
        let excusedCount = 0;

        const groupMap = new Map<
          string,
          { groupName: string; totalSessions: number; totalRecords: number; presentRecords: number }
        >();
        const branchMap = new Map<
          string,
          {
            branchName: string;
            totalSessions: number;
            totalRecords: number;
            presentRecords: number;
          }
        >();

        for (const s of sessions) {
          // Branch aggregation
          const branchKey = s.branchId;
          const bEntry = branchMap.get(branchKey) || {
            branchName: s.branch.name,
            totalSessions: 0,
            totalRecords: 0,
            presentRecords: 0,
          };
          bEntry.totalSessions++;

          // Group aggregation
          const groupKey = s.groupId || 'no_group';
          const gEntry = groupMap.get(groupKey) || {
            groupName: s.groupName,
            totalSessions: 0,
            totalRecords: 0,
            presentRecords: 0,
          };
          gEntry.totalSessions++;

          for (const r of s.records) {
            totalRecords++;
            bEntry.totalRecords++;
            gEntry.totalRecords++;

            if (r.status === 'PRESENT') {
              presentCount++;
              bEntry.presentRecords++;
              gEntry.presentRecords++;
            } else if (r.status === 'LATE') {
              lateCount++;
              bEntry.presentRecords++;
              gEntry.presentRecords++;
            } else if (r.status === 'ABSENT') {
              absentCount++;
            } else if (r.status === 'EXCUSED') {
              excusedCount++;
            }
          }

          branchMap.set(branchKey, bEntry);
          groupMap.set(groupKey, gEntry);
        }

        const attendedCount = presentCount + lateCount;
        const eligibleRecords = presentCount + lateCount + absentCount + excusedCount;
        const unmarkedCount = totalRecords - eligibleRecords;
        const attendanceRate =
          eligibleRecords > 0 ? Math.round((attendedCount / eligibleRecords) * 100) : 0;
        const onTimeRate =
          eligibleRecords > 0 ? Math.round((presentCount / eligibleRecords) * 100) : 0;
        const lateRate =
          eligibleRecords > 0 ? Math.round((lateCount / eligibleRecords) * 100) : 0;
        const absenceRate =
          eligibleRecords > 0 ? Math.round(((absentCount + excusedCount) / eligibleRecords) * 100) : 0;
        const excusedRate =
          eligibleRecords > 0 ? Math.round((excusedCount / eligibleRecords) * 100) : 0;

        const byGroup = Array.from(groupMap.entries()).map(([k, v]) => ({
          groupId: k === 'no_group' ? null : k,
          groupName: v.groupName,
          totalSessions: v.totalSessions,
          totalRecords: v.totalRecords,
          attendanceRate:
            v.totalRecords > 0 ? Math.round((v.presentRecords / v.totalRecords) * 100) : 0,
        }));

        const byBranch = Array.from(branchMap.entries()).map(([k, v]) => ({
          branchId: k,
          branchName: v.branchName,
          totalSessions: v.totalSessions,
          totalRecords: v.totalRecords,
          attendanceRate:
            v.totalRecords > 0 ? Math.round((v.presentRecords / v.totalRecords) * 100) : 0,
        }));

        return {
          totalSessions: sessions.length,
          totalRecords,
          eligibleRecords,
          presentCount,
          lateCount,
          absentCount,
          excusedCount,
          unmarkedCount,
          attendanceRate,
          onTimeRate,
          lateRate,
          absenceRate,
          excusedRate,
          byGroup,
          byBranch,
        };
      },
    );
  }

  /**
   * Helper to compute lateness comparing check-in timestamp against scheduled start + grace minutes.
   */
  private computeLateness(
    sessionDate: Date,
    startTime: string,
    checkInTime: Date,
    graceMinutes: number,
    timezone: string = 'Africa/Cairo',
  ): { isLate: boolean; latenessMinutes: number } {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone || 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      const sessionDateStr = sessionDate.toISOString().slice(0, 10);
      const parts = formatter.formatToParts(checkInTime);
      const partMap: Record<string, string> = {};
      for (const part of parts) {
        partMap[part.type] = part.value;
      }
      const checkInDateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
      const checkInHours = parseInt(partMap.hour ?? '0', 10);
      const checkInMinutes = parseInt(partMap.minute ?? '0', 10);

      const [startH, startM] = startTime.split(':').map((s) => parseInt(s, 10));
      const scheduledMinutes = (startH || 0) * 60 + (startM || 0);
      const actualMinutes = checkInHours * 60 + checkInMinutes;

      const dayDiffMs =
        new Date(`${checkInDateStr}T00:00:00Z`).getTime() -
        new Date(`${sessionDateStr}T00:00:00Z`).getTime();
      const dayDiffMinutes = Math.round(dayDiffMs / (1000 * 60));

      const totalDiffMinutes = dayDiffMinutes + (actualMinutes - scheduledMinutes);

      if (totalDiffMinutes > graceMinutes) {
        return {
          isLate: true,
          latenessMinutes: totalDiffMinutes,
        };
      }
      return {
        isLate: false,
        latenessMinutes: 0,
      };
    } catch {
      return { isLate: false, latenessMinutes: 0 };
    }
  }

  /**
   * Scans a physical/digital player QR card code for attendance check-in.
   * Compares check-in time against scheduled start time + latenessGraceMinutes.
   * Emits append-only AttendanceEvent and returns rich scan response.
   */
  async scanPlayerQr(
    tenantContext: TenantContext,
    sessionId: string,
    dto: ScanPlayerQrRequest,
  ): Promise<ScanPlayerQrResponse> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        if (dto.idempotencyKey) {
          const existingIdempotency = await tx.attendanceIdempotency.findUnique({
            where: {
              tenantId_key: {
                tenantId: tenantContext.tenantId,
                key: dto.idempotencyKey,
              },
            },
          });
          if (existingIdempotency?.response) {
            return existingIdempotency.response as unknown as ScanPlayerQrResponse;
          }
        }

        const [session, tenant] = await Promise.all([
          tx.attendanceSession.findUnique({
            where: {
              tenantId_id: {
                tenantId: tenantContext.tenantId,
                id: sessionId,
              },
            },
            include: {
              branch: { select: { id: true, name: true } },
            },
          }),
          tx.tenant.findUnique({
            where: { id: tenantContext.tenantId },
            select: { timezone: true, latenessGraceMinutes: true },
          }),
        ]);

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
            message: 'Cannot check in players to a closed session',
          });
        }

        const player = await tx.player.findFirst({
          where: {
            tenantId: tenantContext.tenantId,
            qrCardCode: dto.qrCardCode.trim(),
          },
        });

        if (!player) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'بطاقة غير صالحة أو غير مسجلة (Invalid or unregistered QR card)',
          });
        }

        if (player.qrCardRevokedAt) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'هذه البطاقة ملغاة أو تم استبدالها (This QR card has been revoked or replaced)',
          });
        }

        if (player.status !== 'ACTIVE') {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'اللاعب غير نشط في الأكاديمية (Player is inactive or suspended)',
          });
        }

        const activeEnrollment = await tx.playerEnrollment.findFirst({
          where: {
            tenantId: tenantContext.tenantId,
            playerId: player.id,
            branchId: session.branchId,
            status: 'ACTIVE',
          },
        });

        if (!activeEnrollment) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'اللاعب غير مسجل بنشاط في هذا الفرع (Player is not actively enrolled in this branch)',
          });
        }

        const existingRecord = await tx.attendanceRecord.findUnique({
          where: {
            sessionId_playerId: {
              sessionId,
              playerId: player.id,
            },
          },
        });

        const checkInTime = new Date();
        const deviceObservedTime = dto.deviceObservedTime ? new Date(dto.deviceObservedTime) : null;

        // Fetch player's active subscription status for cashier and coach awareness
        const playerSub = await tx.playerSubscription.findFirst({
          where: { tenantId: tenantContext.tenantId, playerId: player.id },
          orderBy: { createdAt: 'desc' },
        });

        const paymentStatusPayload = playerSub
          ? {
              status: playerSub.status as any,
              outstandingBalance: playerSub.outstandingBalance,
              feeAmount: playerSub.feeAmount,
              dueDate: playerSub.dueDate.toISOString().slice(0, 10),
              lastPaymentDate: playerSub.lastPaymentDate ? playerSub.lastPaymentDate.toISOString() : null,
              subscriptionId: playerSub.id,
            }
          : undefined;

        if (
          existingRecord &&
          (existingRecord.status === 'PRESENT' || existingRecord.status === 'LATE')
        ) {
          const res: ScanPlayerQrResponse = {
            success: true,
            alreadyCheckedIn: true,
            status: existingRecord.status as 'PRESENT' | 'LATE',
            latenessMinutes: 0,
            checkInTime: existingRecord.checkInTime
              ? existingRecord.checkInTime.toISOString()
              : checkInTime.toISOString(),
            deviceObservedTime: existingRecord.deviceObservedTime
              ? existingRecord.deviceObservedTime.toISOString()
              : dto.deviceObservedTime || null,
            syncStatus: 'CONFIRMED',
            message: `اللاعب ${player.firstName} ${player.lastName} مسجل حضوره مسبقاً (${
              existingRecord.status === 'LATE' ? 'متأخر' : 'في الموعد'
            })`,
            player: {
              id: player.id,
              name: `${player.firstName} ${player.lastName}`,
              membershipNumber: player.membershipNumber || undefined,
              photoUrl: player.photoUrl,
            },
            session: {
              id: session.id,
              groupName: session.groupName,
              branchName: session.branch.name,
              sessionDate: session.sessionDate.toISOString().slice(0, 10),
              startTime: session.startTime,
            },
            paymentStatus: paymentStatusPayload,
          };

          return res;
        }

        const graceMinutes = tenant?.latenessGraceMinutes ?? 15;
        const timezone = tenant?.timezone ?? 'Africa/Cairo';
        const effectiveTime = deviceObservedTime || checkInTime;
        const { isLate, latenessMinutes } = this.computeLateness(
          session.sessionDate,
          session.startTime,
          effectiveTime,
          graceMinutes,
          timezone,
        );

        const newStatus = isLate ? 'LATE' : 'PRESENT';
        const previousStatus = existingRecord?.status || 'UNMARKED';

        let updatedRecord;
        if (!existingRecord) {
          updatedRecord = await tx.attendanceRecord.create({
            data: {
              tenantId: tenantContext.tenantId,
              sessionId,
              playerId: player.id,
              status: newStatus,
              checkInTime,
              deviceObservedTime,
              isOfflineSync: false,
              syncStatus: 'CONFIRMED',
              markedByUserId: tenantContext.actorUserId,
              version: 1,
            },
          });
        } else {
          updatedRecord = await tx.attendanceRecord.update({
            where: { id: existingRecord.id },
            data: {
              status: newStatus,
              checkInTime,
              deviceObservedTime,
              isOfflineSync: false,
              syncStatus: 'CONFIRMED',
              markedByUserId: tenantContext.actorUserId,
              version: existingRecord.version + 1,
            },
          });
        }

        await tx.attendanceEvent.create({
          data: {
            tenantId: tenantContext.tenantId,
            recordId: updatedRecord.id,
            sessionId,
            playerId: player.id,
            actorUserId: tenantContext.actorUserId,
            previousStatus,
            newStatus,
            source: 'QR_CHECKIN',
            reason: isLate
              ? `تسجيل حضور متأخر (${latenessMinutes} دقيقة)`
              : 'تسجيل حضور في الموعد عبر بطاقة QR',
            metadata: {
              latenessMinutes,
              graceMinutes,
              deviceObservedTime: dto.deviceObservedTime || null,
              qrCardCodePrefix: dto.qrCardCode.slice(0, 8),
            },
          },
        });

        const statusLabel = isLate ? 'متأخر (Late)' : 'في الموعد (On Time)';
        const res: ScanPlayerQrResponse = {
          success: true,
          alreadyCheckedIn: false,
          status: newStatus,
          latenessMinutes,
          checkInTime: checkInTime.toISOString(),
          deviceObservedTime: dto.deviceObservedTime || null,
          syncStatus: 'CONFIRMED',
          message: `تم تسجيل حضور اللاعب ${player.firstName} ${player.lastName} بنجاح [${statusLabel}]`,
          player: {
            id: player.id,
            name: `${player.firstName} ${player.lastName}`,
            membershipNumber: player.membershipNumber || undefined,
            photoUrl: player.photoUrl,
          },
          session: {
            id: session.id,
            groupName: session.groupName,
            branchName: session.branch.name,
            sessionDate: session.sessionDate.toISOString().slice(0, 10),
            startTime: session.startTime,
          },
          paymentStatus: paymentStatusPayload,
        };

        return res;
      },
    );
  }

  /**
   * Syncs a batch of offline attendance scans captured by mobile devices without internet.
   * Preserves deviceObservedTime, sets isOfflineSync = true, resolves conflicts idempotently.
   */
  async syncOfflineBatch(
    tenantContext: TenantContext,
    dto: OfflineAttendanceBatchSyncRequest,
  ): Promise<OfflineAttendanceBatchSyncResponse> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const [session, tenant] = await Promise.all([
          tx.attendanceSession.findUnique({
            where: {
              tenantId_id: {
                tenantId: tenantContext.tenantId,
                id: dto.sessionId,
              },
            },
          }),
          tx.tenant.findUnique({
            where: { id: tenantContext.tenantId },
            select: { timezone: true, latenessGraceMinutes: true },
          }),
        ]);

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
            message: 'Cannot sync attendance to a closed session',
          });
        }

        const graceMinutes = tenant?.latenessGraceMinutes ?? 15;
        const timezone = tenant?.timezone ?? 'Africa/Cairo';
        const results = [];
        let syncedCount = 0;
        let failedCount = 0;

        for (const item of dto.items) {
          try {
            const player = await tx.player.findFirst({
              where: {
                tenantId: tenantContext.tenantId,
                qrCardCode: item.qrCardCode.trim(),
              },
            });

            if (!player) {
              failedCount++;
              results.push({
                operationId: item.operationId,
                success: false,
                error: 'بطاقة غير صالحة أو غير مسجلة (Invalid QR card code)',
              });
              continue;
            }

            if (player.qrCardRevokedAt) {
              failedCount++;
              results.push({
                operationId: item.operationId,
                success: false,
                error: 'البطاقة ملغاة (Revoked QR card)',
                player: { id: player.id, name: `${player.firstName} ${player.lastName}` },
              });
              continue;
            }

            const activeEnrollment = await tx.playerEnrollment.findFirst({
              where: {
                tenantId: tenantContext.tenantId,
                playerId: player.id,
                branchId: session.branchId,
                status: 'ACTIVE',
              },
            });

            if (!activeEnrollment) {
              failedCount++;
              results.push({
                operationId: item.operationId,
                success: false,
                error: 'اللاعب غير مسجل بنشاط في هذا الفرع (Not enrolled in this branch)',
                player: { id: player.id, name: `${player.firstName} ${player.lastName}` },
              });
              continue;
            }

            const existingRecord = await tx.attendanceRecord.findUnique({
              where: {
                sessionId_playerId: {
                  sessionId: dto.sessionId,
                  playerId: player.id,
                },
              },
            });

            if (
              existingRecord &&
              (existingRecord.status === 'PRESENT' || existingRecord.status === 'LATE')
            ) {
              syncedCount++;
              results.push({
                operationId: item.operationId,
                success: true,
                status: existingRecord.status,
                alreadyCheckedIn: true,
                player: { id: player.id, name: `${player.firstName} ${player.lastName}` },
              });
              continue;
            }

            const deviceObservedTime = new Date(item.deviceObservedTime);
            const serverCheckInTime = new Date();

            const { isLate, latenessMinutes } = this.computeLateness(
              session.sessionDate,
              session.startTime,
              deviceObservedTime,
              graceMinutes,
              timezone,
            );

            const newStatus = isLate ? 'LATE' : 'PRESENT';
            const previousStatus = existingRecord?.status || 'UNMARKED';

            let updatedRecord;
            if (!existingRecord) {
              updatedRecord = await tx.attendanceRecord.create({
                data: {
                  tenantId: tenantContext.tenantId,
                  sessionId: dto.sessionId,
                  playerId: player.id,
                  status: newStatus,
                  checkInTime: serverCheckInTime,
                  deviceObservedTime,
                  isOfflineSync: true,
                  syncStatus: 'CONFIRMED',
                  markedByUserId: tenantContext.actorUserId,
                  version: 1,
                  remarks: item.reason || 'Offline synced check-in',
                },
              });
            } else {
              updatedRecord = await tx.attendanceRecord.update({
                where: { id: existingRecord.id },
                data: {
                  status: newStatus,
                  checkInTime: serverCheckInTime,
                  deviceObservedTime,
                  isOfflineSync: true,
                  syncStatus: 'CONFIRMED',
                  markedByUserId: tenantContext.actorUserId,
                  version: existingRecord.version + 1,
                  remarks: item.reason || existingRecord.remarks,
                },
              });
            }

            await tx.attendanceEvent.create({
              data: {
                tenantId: tenantContext.tenantId,
                recordId: updatedRecord.id,
                sessionId: dto.sessionId,
                playerId: player.id,
                actorUserId: tenantContext.actorUserId,
                previousStatus,
                newStatus,
                source: 'QR_CHECKIN',
                reason: item.reason || 'Offline batch sync scan',
                metadata: {
                  operationId: item.operationId,
                  deviceObservedTime: item.deviceObservedTime,
                  latenessMinutes,
                  isOfflineSync: true,
                },
              },
            });

            syncedCount++;
            results.push({
              operationId: item.operationId,
              success: true,
              status: newStatus,
              alreadyCheckedIn: false,
              player: { id: player.id, name: `${player.firstName} ${player.lastName}` },
            });
          } catch (err: unknown) {
            failedCount++;
            results.push({
              operationId: item.operationId,
              success: false,
              error: (err as Error)?.message || 'Failed to process item',
            });
          }
        }

        return {
          syncedCount,
          failedCount,
          results,
        };
      },
    );
  }
}
