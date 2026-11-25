import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCode,
  type CreateScheduleExceptionRequest,
  type GroupCalendar,
  type GroupCalendarQuery,
  type TenantContext,
  type UpdateScheduleRequest,
} from '@academy/shared';
import type { TenantTransactionClient } from '@academy/database';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertCoachCanSee } from '../../common/coach-scope';
import {
  addDays,
  buildGroupCalendar,
  dayOfWeek,
  formatDay,
  todayInCairo,
  type TimetableChange,
} from './group-calendar';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * A group's fixed weekly timetable and its one-off changes (owner request 2026-11-24). The admin (groups.manage) cancels
 * or moves one occurrence, adds an extra session, or changes a weekly slot; the group's coaches, players and their guardians (accounts
 * linked to its active members) are notified of every change. Reading the calendar follows groups.read and the coach
 * scope (a coach sees only their own groups).
 */
@Injectable()
export class GroupScheduleService {
  private readonly logger = new Logger(GroupScheduleService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async getCalendar(
    tenantContext: TenantContext,
    groupId: string,
    query: GroupCalendarQuery,
  ): Promise<GroupCalendar> {
    const from = query.from ?? todayInCairo();
    const to = addDays(from, query.weeks * 7 - 1);
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        await this.loadGroup(tx, tenantContext, groupId);
        const [slots, changes] = await Promise.all([
          tx.trainingSchedule.findMany({ where: { tenantId: tenantContext.tenantId, groupId } }),
          this.loadChanges(tx, tenantContext.tenantId, groupId, from, to),
        ]);
        return {
          groupId,
          from,
          to,
          occurrences: buildGroupCalendar(
            slots.map((s) => ({ ...s, status: s.status as 'ACTIVE' | 'INACTIVE' })),
            changes,
            from,
            to,
          ),
        };
      },
    );
  }

  async createException(
    tenantContext: TenantContext,
    groupId: string,
    dto: CreateScheduleExceptionRequest,
  ): Promise<{ id: string }> {
    const today = todayInCairo();
    const result = await this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const group = await this.loadGroup(tx, tenantContext, groupId);

        let slot: { id: string; startTime: string; endTime: string; dayOfWeek: number } | null =
          null;
        if (dto.kind !== 'EXTRA') {
          slot = await tx.trainingSchedule.findFirst({
            where: {
              tenantId: tenantContext.tenantId,
              id: dto.scheduleId,
              groupId,
              status: 'ACTIVE',
            },
          });
          if (!slot) {
            throw new NotFoundException({
              code: ErrorCode.NOT_FOUND,
              message: 'Weekly slot not found',
            });
          }
          if (dayOfWeek(dto.originalDate) !== slot.dayOfWeek) {
            throw this.invalid('The group does not train on that day in this slot');
          }
          if (dto.originalDate < today) throw this.invalid('That session is already in the past');
        }
        if (dto.kind !== 'CANCELLED' && dto.sessionDate < today) {
          throw this.invalid('The new date is in the past');
        }

        let created: { id: string };
        try {
          created = await tx.scheduleException.create({
            data: {
              tenantId: tenantContext.tenantId,
              groupId,
              kind: dto.kind,
              scheduleId: dto.kind === 'EXTRA' ? null : dto.scheduleId,
              originalDate: dto.kind === 'EXTRA' ? null : new Date(`${dto.originalDate}T00:00:00Z`),
              sessionDate:
                dto.kind === 'CANCELLED' ? null : new Date(`${dto.sessionDate}T00:00:00Z`),
              startTime: dto.kind === 'CANCELLED' ? null : dto.startTime,
              endTime: dto.kind === 'CANCELLED' ? null : dto.endTime,
              location: dto.kind === 'CANCELLED' ? null : dto.location?.trim() || null,
              reason: dto.reason?.trim() || null,
              createdByUserId: tenantContext.actorUserId,
            },
            select: { id: true },
          });
        } catch (err) {
          if ((err as { code?: string })?.code === 'P2002') {
            throw new ConflictException({
              code: ErrorCode.CONFLICT,
              message: 'This session was already changed. Undo that change first.',
            });
          }
          throw err;
        }

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: `GROUP_SCHEDULE_${dto.kind}`,
            resourceType: 'ScheduleException',
            resourceId: created.id,
            metadata: { groupId, ...dto },
          },
          tx,
        );
        return { id: created.id, groupName: group.name, slot };
      },
    );

    const reason = dto.reason?.trim() ? ` Reason: ${dto.reason.trim()}` : '';
    const message =
      dto.kind === 'CANCELLED'
        ? {
            title: 'Training cancelled',
            body: `${result.groupName}: the session on ${dto.originalDate} (${result.slot?.startTime}-${result.slot?.endTime}) is cancelled.${reason}`,
          }
        : dto.kind === 'MOVED'
          ? {
              title: 'Training moved',
              body: `${result.groupName}: the session on ${dto.originalDate} moves to ${dto.sessionDate} ${dto.startTime}-${dto.endTime}.${reason}`,
            }
          : {
              title: 'Extra training',
              body: `${result.groupName}: an extra session on ${dto.sessionDate} ${dto.startTime}-${dto.endTime}.${reason}`,
            };
    await this.notifyGroup(tenantContext, groupId, message.title, message.body);
    return { id: result.id };
  }

  /** Undoes a change: the occurrence is back to the weekly timetable (or the extra session is removed). */
  async deleteException(
    tenantContext: TenantContext,
    groupId: string,
    exceptionId: string,
  ): Promise<{ success: true }> {
    const removed = await this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const group = await this.loadGroup(tx, tenantContext, groupId);
        const change = await tx.scheduleException.findFirst({
          where: { tenantId: tenantContext.tenantId, id: exceptionId, groupId },
        });
        if (!change) {
          throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Change not found' });
        }
        await tx.scheduleException.delete({
          where: { tenantId_id: { tenantId: tenantContext.tenantId, id: exceptionId } },
        });
        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'GROUP_SCHEDULE_CHANGE_UNDONE',
            resourceType: 'ScheduleException',
            resourceId: exceptionId,
            metadata: { groupId, kind: change.kind },
          },
          tx,
        );
        return { groupName: group.name, change };
      },
    );

    const { change } = removed;
    const body =
      change.kind === 'EXTRA'
        ? `${removed.groupName}: the extra session on ${formatDay(change.sessionDate!.getTime())} is cancelled.`
        : `${removed.groupName}: the session on ${formatDay(change.originalDate!.getTime())} is back at its usual time.`;
    await this.notifyGroup(tenantContext, groupId, 'Training schedule updated', body);
    return { success: true };
  }

  /**
   * Changes a weekly slot of the timetable. Upcoming one-off changes of that slot refer to its old day and time, so they
   * are removed; the coaches and players are told the new slot.
   */
  async updateSchedule(
    tenantContext: TenantContext,
    groupId: string,
    scheduleId: string,
    dto: UpdateScheduleRequest,
  ) {
    if (dto.startTime >= dto.endTime) throw this.invalid('Start time must be before end time');
    const today = todayInCairo();
    const result = await this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const group = await this.loadGroup(tx, tenantContext, groupId);
        const slot = await tx.trainingSchedule.findFirst({
          where: { tenantId: tenantContext.tenantId, id: scheduleId, groupId },
        });
        if (!slot) {
          throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Schedule not found' });
        }
        const updated = await tx.trainingSchedule.update({
          where: { tenantId_id: { tenantId: tenantContext.tenantId, id: scheduleId } },
          data: {
            dayOfWeek: dto.dayOfWeek,
            startTime: dto.startTime,
            endTime: dto.endTime,
            location: dto.location?.trim() || null,
          },
        });
        const cleared = await tx.scheduleException.deleteMany({
          where: {
            tenantId: tenantContext.tenantId,
            scheduleId,
            originalDate: { gte: new Date(`${today}T00:00:00Z`) },
          },
        });
        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'GROUP_SCHEDULE_UPDATE',
            resourceType: 'TrainingSchedule',
            resourceId: scheduleId,
            metadata: {
              groupId,
              before: {
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
              },
              after: dto,
              upcomingChangesRemoved: cleared.count,
            },
          },
          tx,
        );
        return { groupName: group.name, updated, before: slot };
      },
    );

    await this.notifyGroup(
      tenantContext,
      groupId,
      'Weekly training time changed',
      `${result.groupName}: training moves from ${DAY_NAMES[result.before.dayOfWeek]} ${result.before.startTime}-${result.before.endTime} to ${DAY_NAMES[dto.dayOfWeek]} ${dto.startTime}-${dto.endTime}, every week.`,
    );
    const u = result.updated;
    return {
      id: u.id,
      dayOfWeek: u.dayOfWeek,
      startTime: u.startTime,
      endTime: u.endTime,
      location: u.location,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
    };
  }

  private async loadGroup(
    tx: TenantTransactionClient,
    tenantContext: TenantContext,
    groupId: string,
  ): Promise<{ id: string; name: string; branchId: string }> {
    const group = await tx.trainingGroup.findUnique({
      where: { tenantId_id: { tenantId: tenantContext.tenantId, id: groupId } },
      include: { coaches: { select: { coachUserId: true } } },
    });
    if (!group) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Training group not found',
      });
    }
    assertCoachCanSee(
      tenantContext,
      group.coaches.some((c) => c.coachUserId === tenantContext.actorUserId),
      'Group',
    );
    if (tenantContext.branchId && group.branchId !== tenantContext.branchId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access restricted to your assigned branch',
      });
    }
    return group;
  }

  private async loadChanges(
    tx: TenantTransactionClient,
    tenantId: string,
    groupId: string,
    from: string,
    to: string,
  ): Promise<TimetableChange[]> {
    const range = { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) };
    const rows = await tx.scheduleException.findMany({
      where: { tenantId, groupId, OR: [{ originalDate: range }, { sessionDate: range }] },
    });
    const day = (d: Date | null) => (d ? formatDay(d.getTime()) : null);
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      scheduleId: r.scheduleId,
      originalDate: day(r.originalDate),
      sessionDate: day(r.sessionDate),
      startTime: r.startTime,
      endTime: r.endTime,
      location: r.location,
      reason: r.reason,
    }));
  }

  /**
   * Tells the group's coaches and the accounts of its active players. Runs after the change is saved; a failed
   * notification never undoes the change.
   */
  private async notifyGroup(
    tenantContext: TenantContext,
    groupId: string,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      await this.prisma.withTenantTransaction(
        { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
        async (tx) => {
          const [coaches, members, guardians] = await Promise.all([
            tx.groupCoach.findMany({
              where: { tenantId: tenantContext.tenantId, groupId },
              select: { coachUserId: true },
            }),
            tx.groupMember.findMany({
              where: {
                tenantId: tenantContext.tenantId,
                groupId,
                status: 'ACTIVE',
                player: { userId: { not: null } },
              },
              select: { player: { select: { userId: true } } },
            }),
            // Guardians with an account follow their children's sessions too (owner decision 2026-11-25).
            tx.guardian.findMany({
              where: {
                tenantId: tenantContext.tenantId,
                userId: { not: null },
                player: { groupMemberships: { some: { groupId, status: 'ACTIVE' } } },
              },
              select: { userId: true },
            }),
          ]);
          const recipients = new Map<string, string>();
          for (const c of coaches) recipients.set(c.coachUserId, `/groups/${groupId}`);
          for (const m of members) if (m.player.userId) recipients.set(m.player.userId, '/player');
          for (const g of guardians)
            if (g.userId && !recipients.has(g.userId)) recipients.set(g.userId, '/guardian');
          recipients.delete(tenantContext.actorUserId);
          // One statement per link target (coaches → the group page, players → the player portal), not one round trip
          // per person: a group can have dozens of players.
          const byHref = new Map<string, string[]>();
          for (const [userId, href] of recipients) {
            byHref.set(href, [...(byHref.get(href) ?? []), userId]);
          }
          for (const [href, userIds] of byHref) {
            await tx.$queryRaw`SELECT public.create_app_notification(
              recipient, ${tenantContext.tenantId}::uuid, 'SYSTEM', ${title}, ${body}, ${href}
            ) FROM unnest(${userIds}::uuid[]) AS recipient`;
          }
        },
      );
    } catch (err) {
      this.logger.warn(
        `Could not notify the group of a timetable change: ${(err as Error)?.message}`,
      );
    }
  }

  private invalid(message: string): BadRequestException {
    return new BadRequestException({ code: ErrorCode.VALIDATION_FAILED, message });
  }
}
