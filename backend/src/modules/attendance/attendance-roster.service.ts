import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { SessionQuery, SessionSummary, TenantContext } from '@academy/shared';

@Injectable()
export class AttendanceRosterService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Lists sessions in the academy with summary metrics.
   */
  async listSessions(
    tenantContext: TenantContext,
    query?: SessionQuery,
  ): Promise<{ items: SessionSummary[]; total: number; page: number; limit: number; totalPages: number }> {
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
          totalPages: Math.ceil(total / limit),
        };
      },
    );
  }
}

