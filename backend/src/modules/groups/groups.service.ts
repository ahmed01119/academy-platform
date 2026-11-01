import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ErrorCode,
  type AssignCoachRequest,
  type AssignPlayerRequest,
  type CreateScheduleRequest,
  type CreateTrainingGroupRequest,
  type GroupQuery,
  type TenantContext,
  type TrainingGroupDetails,
  type TrainingGroupSummary,
  type UpdateTrainingGroupRequest,
} from '@academy/shared';

@Injectable()
export class GroupsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /**
   * Creates a new training group within a branch.
   */
  async createGroup(tenantContext: TenantContext, dto: CreateTrainingGroupRequest) {
    if (tenantContext.branchId && tenantContext.branchId !== dto.branchId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access restricted to your assigned branch',
      });
    }

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
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

        const group = await tx.trainingGroup.create({
          data: {
            tenantId: tenantContext.tenantId,
            branchId: dto.branchId,
            sport: dto.sport,
            name: dto.name.trim(),
            description: dto.description?.trim() || null,
            ageCategory: dto.ageCategory?.trim() || null,
            capacity: dto.capacity || null,
            status: 'ACTIVE',
          },
          include: {
            branch: { select: { id: true, name: true, code: true } },
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'GROUP_CREATE',
            resourceType: 'TrainingGroup',
            resourceId: group.id,
            metadata: {
              branchId: dto.branchId,
              name: dto.name,
              capacity: dto.capacity,
            },
          },
          tx,
        );

        return {
          id: group.id,
          tenantId: group.tenantId,
          branchId: group.branchId,
          branchName: group.branch.name,
          branchCode: group.branch.code,
          sport: group.sport,
          name: group.name,
          description: group.description,
          ageCategory: group.ageCategory,
          capacity: group.capacity,
          status: group.status,
          memberCount: 0,
          coachCount: 0,
          scheduleCount: 0,
          createdAt: group.createdAt.toISOString(),
          updatedAt: group.updatedAt.toISOString(),
        } satisfies TrainingGroupSummary;
      },
    );
  }

  /**
   * Retrieves a single group by ID with full details (coaches, members, schedules).
   */
  async getGroupById(tenantContext: TenantContext, id: string): Promise<TrainingGroupDetails> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const group = await tx.trainingGroup.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id,
            },
          },
          include: {
            branch: { select: { id: true, name: true, code: true } },
            coaches: {
              include: {
                coachUser: { select: { id: true, name: true, email: true, phone: true } },
              },
            },
            members: {
              where: { status: 'ACTIVE' },
              include: {
                player: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    gender: true,
                    dateOfBirth: true,
                    photoUrl: true,
                    status: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
            schedules: {
              where: { status: 'ACTIVE' },
              orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
            },
          },
        });

        if (!group) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Training group not found',
          });
        }

        if (tenantContext.branchId && group.branchId !== tenantContext.branchId) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Access restricted to your assigned branch',
          });
        }

        return {
          id: group.id,
          tenantId: group.tenantId,
          branchId: group.branchId,
          branchName: group.branch.name,
          branchCode: group.branch.code,
          sport: group.sport,
          name: group.name,
          description: group.description,
          ageCategory: group.ageCategory,
          capacity: group.capacity,
          status: group.status,
          memberCount: group.members.length,
          coachCount: group.coaches.length,
          scheduleCount: group.schedules.length,
          createdAt: group.createdAt.toISOString(),
          updatedAt: group.updatedAt.toISOString(),
          coaches: group.coaches.map((c) => ({
            id: c.id,
            coachUserId: c.coachUserId,
            coachName: c.coachUser.name,
            coachEmail: c.coachUser.email,
            coachPhone: c.coachUser.phone,
            isHeadCoach: c.isHeadCoach,
            createdAt: c.createdAt.toISOString(),
          })),
          members: group.members.map((m) => ({
            id: m.id,
            playerId: m.playerId,
            playerName: `${m.player.firstName} ${m.player.lastName}`,
            playerGender: m.player.gender,
            playerDateOfBirth: m.player.dateOfBirth.toISOString().slice(0, 10),
            playerPhotoUrl: m.player.photoUrl,
            status: m.status,
            startDate: m.startDate.toISOString().slice(0, 10),
            endDate: m.endDate ? m.endDate.toISOString().slice(0, 10) : null,
            createdAt: m.createdAt.toISOString(),
          })),
          schedules: group.schedules.map((s) => ({
            id: s.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            location: s.location,
            status: s.status,
            createdAt: s.createdAt.toISOString(),
          })),
        };
      },
    );
  }

  /**
   * Lists training groups in the academy with filters and pagination.
   */
  async listGroups(tenantContext: TenantContext, query: GroupQuery) {
    const effectiveBranchId = tenantContext.branchId || query.branchId;

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const whereClause = {
          tenantId: tenantContext.tenantId,
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.search
            ? {
                OR: [
                  { name: { contains: query.search.trim(), mode: 'insensitive' as const } },
                  { description: { contains: query.search.trim(), mode: 'insensitive' as const } },
                  { ageCategory: { contains: query.search.trim(), mode: 'insensitive' as const } },
                ],
              }
            : {}),
        };

        const total = await tx.trainingGroup.count({ where: whereClause });
        const skip = (query.page - 1) * query.limit;

        const groups = await tx.trainingGroup.findMany({
          where: whereClause,
          skip,
          take: query.limit,
          orderBy: [{ name: 'asc' }],
          include: {
            branch: { select: { id: true, name: true, code: true } },
            _count: {
              select: {
                members: { where: { status: 'ACTIVE' } },
                coaches: true,
                schedules: { where: { status: 'ACTIVE' } },
              },
            },
          },
        });

        const items: TrainingGroupSummary[] = groups.map((g) => ({
          id: g.id,
          tenantId: g.tenantId,
          branchId: g.branchId,
          branchName: g.branch.name,
          branchCode: g.branch.code,
          sport: g.sport,
          name: g.name,
          description: g.description,
          ageCategory: g.ageCategory,
          capacity: g.capacity,
          status: g.status,
          memberCount: g._count.members,
          coachCount: g._count.coaches,
          scheduleCount: g._count.schedules,
          createdAt: g.createdAt.toISOString(),
          updatedAt: g.updatedAt.toISOString(),
        }));

        return {
          items,
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit) || 1,
        };
      },
    );
  }

  /**
   * Updates an existing training group.
   */
  async updateGroup(tenantContext: TenantContext, id: string, dto: UpdateTrainingGroupRequest) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const existing = await tx.trainingGroup.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id,
            },
          },
          include: {
            branch: { select: { id: true, name: true, code: true } },
            _count: {
              select: {
                members: { where: { status: 'ACTIVE' } },
                coaches: true,
                schedules: { where: { status: 'ACTIVE' } },
              },
            },
          },
        });

        if (!existing) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Training group not found',
          });
        }

        if (tenantContext.branchId && existing.branchId !== tenantContext.branchId) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Access restricted to your assigned branch',
          });
        }

        // If capacity is reduced below current active members, validate
        if (dto.capacity !== undefined && dto.capacity !== null) {
          if (dto.capacity < existing._count.members) {
            throw new BadRequestException({
              code: ErrorCode.VALIDATION_FAILED,
              message: `Cannot reduce group capacity below current active members count (${existing._count.members})`,
            });
          }
        }

        const updated = await tx.trainingGroup.update({
          where: { id },
          data: {
            name: dto.name !== undefined ? dto.name.trim() : undefined,
            description:
              dto.description !== undefined ? dto.description?.trim() || null : undefined,
            ageCategory:
              dto.ageCategory !== undefined ? dto.ageCategory?.trim() || null : undefined,
            capacity: dto.capacity !== undefined ? dto.capacity : undefined,
            status: dto.status !== undefined ? dto.status : undefined,
          },
          include: {
            branch: { select: { id: true, name: true, code: true } },
            _count: {
              select: {
                members: { where: { status: 'ACTIVE' } },
                coaches: true,
                schedules: { where: { status: 'ACTIVE' } },
              },
            },
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'GROUP_UPDATE',
            resourceType: 'TrainingGroup',
            resourceId: updated.id,
            metadata: {
              changedFields: Object.keys(dto),
            },
          },
          tx,
        );

        return {
          id: updated.id,
          tenantId: updated.tenantId,
          branchId: updated.branchId,
          branchName: updated.branch.name,
          branchCode: updated.branch.code,
          sport: updated.sport,
          name: updated.name,
          description: updated.description,
          ageCategory: updated.ageCategory,
          capacity: updated.capacity,
          status: updated.status,
          memberCount: updated._count.members,
          coachCount: updated._count.coaches,
          scheduleCount: updated._count.schedules,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        } satisfies TrainingGroupSummary;
      },
    );
  }

  /**
   * Assigns a coach to a training group.
   */
  async assignCoach(tenantContext: TenantContext, groupId: string, dto: AssignCoachRequest) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const group = await tx.trainingGroup.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: groupId,
            },
          },
        });

        if (!group) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Training group not found',
          });
        }

        if (tenantContext.branchId && group.branchId !== tenantContext.branchId) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Access restricted to your assigned branch',
          });
        }

        // Verify coach user exists and has active membership in this tenant
        const coachMembership = await tx.tenantMembership.findUnique({
          where: {
            tenantId_userId: {
              tenantId: tenantContext.tenantId,
              userId: dto.coachUserId,
            },
          },
          include: { user: true },
        });

        if (!coachMembership || coachMembership.status !== 'ACTIVE') {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Coach user does not have an active membership in this academy',
          });
        }

        // If coach is branch-scoped, must be assigned to the group's branch
        if (coachMembership.branchId && coachMembership.branchId !== group.branchId) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Coach is assigned to a different branch',
          });
        }

        const existingAssignment = await tx.groupCoach.findUnique({
          where: {
            groupId_coachUserId: {
              groupId,
              coachUserId: dto.coachUserId,
            },
          },
        });

        if (existingAssignment) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'Coach is already assigned to this group',
          });
        }

        const assignment = await tx.groupCoach.create({
          data: {
            tenantId: tenantContext.tenantId,
            groupId,
            coachUserId: dto.coachUserId,
            isHeadCoach: dto.isHeadCoach,
          },
          include: {
            coachUser: { select: { id: true, name: true, email: true, phone: true } },
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'GROUP_COACH_ASSIGN',
            resourceType: 'GroupCoach',
            resourceId: assignment.id,
            metadata: {
              groupId,
              coachUserId: dto.coachUserId,
              isHeadCoach: dto.isHeadCoach,
            },
          },
          tx,
        );

        return {
          id: assignment.id,
          coachUserId: assignment.coachUserId,
          coachName: assignment.coachUser.name,
          coachEmail: assignment.coachUser.email,
          coachPhone: assignment.coachUser.phone,
          isHeadCoach: assignment.isHeadCoach,
          createdAt: assignment.createdAt.toISOString(),
        };
      },
    );
  }

  /**
   * Removes a coach from a group.
   */
  async removeCoach(tenantContext: TenantContext, groupId: string, coachUserId: string) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const group = await tx.trainingGroup.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: groupId,
            },
          },
        });

        if (!group) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Training group not found',
          });
        }

        if (tenantContext.branchId && group.branchId !== tenantContext.branchId) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Access restricted to your assigned branch',
          });
        }

        const assignment = await tx.groupCoach.findUnique({
          where: {
            groupId_coachUserId: {
              groupId,
              coachUserId,
            },
          },
        });

        if (!assignment) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Coach is not assigned to this group',
          });
        }

        await tx.groupCoach.delete({
          where: { id: assignment.id },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'GROUP_COACH_REMOVE',
            resourceType: 'GroupCoach',
            resourceId: assignment.id,
            metadata: {
              groupId,
              coachUserId,
            },
          },
          tx,
        );

        return { message: 'Coach unassigned successfully' };
      },
    );
  }

  /**
   * Assigns a player to a training group.
   * Enforces:
   * 1. Group status is ACTIVE.
   * 2. Player is ACTIVE.
   * 3. Player has an ACTIVE enrollment in the group's branch.
   * 4. Group capacity is not exceeded.
   */
  async assignPlayer(tenantContext: TenantContext, groupId: string, dto: AssignPlayerRequest) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const group = await tx.trainingGroup.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: groupId,
            },
          },
        });

        if (!group || group.status !== 'ACTIVE') {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Training group not found or inactive',
          });
        }

        if (tenantContext.branchId && group.branchId !== tenantContext.branchId) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Access restricted to your assigned branch',
          });
        }

        // Check group capacity
        if (group.capacity !== null && group.capacity !== undefined) {
          const currentMembers = await tx.groupMember.count({
            where: {
              groupId,
              status: 'ACTIVE',
            },
          });
          if (currentMembers >= group.capacity) {
            throw new BadRequestException({
              code: ErrorCode.VALIDATION_FAILED,
              message:
                'بلغت المجموعة طاقتها الاستيعابية القصوى (Training group has reached maximum capacity)',
            });
          }
        }

        // Verify player is ACTIVE
        const player = await tx.player.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: dto.playerId,
            },
          },
          include: {
            enrollments: {
              where: {
                branchId: group.branchId,
                status: 'ACTIVE',
              },
            },
          },
        });

        if (!player || player.status !== 'ACTIVE') {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message:
              'لا يمكن إضافة لاعب غير نشط للمجموعة (Cannot assign inactive or suspended player)',
          });
        }

        // Verify player is enrolled in the group's branch
        if (player.enrollments.length === 0) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message:
              'اللاعب غير مسجل بنشاط في فرع هذه المجموعة (Player must have an active enrollment in this group branch)',
          });
        }

        // Check if already in group
        const existingMember = await tx.groupMember.findUnique({
          where: {
            groupId_playerId: {
              groupId,
              playerId: dto.playerId,
            },
          },
        });

        if (existingMember && existingMember.status === 'ACTIVE') {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message:
              'اللاعب مسجل بالفعل في هذه المجموعة (Player is already an active member of this group)',
          });
        }

        let membership;
        if (existingMember) {
          membership = await tx.groupMember.update({
            where: { id: existingMember.id },
            data: {
              status: 'ACTIVE',
              startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
              endDate: null,
            },
            include: {
              player: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  gender: true,
                  dateOfBirth: true,
                  photoUrl: true,
                },
              },
            },
          });
        } else {
          membership = await tx.groupMember.create({
            data: {
              tenantId: tenantContext.tenantId,
              groupId,
              playerId: dto.playerId,
              status: 'ACTIVE',
              startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
            },
            include: {
              player: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  gender: true,
                  dateOfBirth: true,
                  photoUrl: true,
                },
              },
            },
          });
        }

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'GROUP_PLAYER_ASSIGN',
            resourceType: 'GroupMember',
            resourceId: membership.id,
            metadata: {
              groupId,
              playerId: dto.playerId,
              playerName: `${membership.player.firstName} ${membership.player.lastName}`,
            },
          },
          tx,
        );

        return {
          id: membership.id,
          playerId: membership.playerId,
          playerName: `${membership.player.firstName} ${membership.player.lastName}`,
          playerGender: membership.player.gender,
          playerDateOfBirth: membership.player.dateOfBirth.toISOString().slice(0, 10),
          playerPhotoUrl: membership.player.photoUrl,
          status: membership.status,
          startDate: membership.startDate.toISOString().slice(0, 10),
          endDate: membership.endDate ? membership.endDate.toISOString().slice(0, 10) : null,
          createdAt: membership.createdAt.toISOString(),
        };
      },
    );
  }

  /**
   * Removes a player from a training group (sets status to INACTIVE).
   */
  async removePlayer(tenantContext: TenantContext, groupId: string, playerId: string) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const group = await tx.trainingGroup.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: groupId,
            },
          },
        });

        if (!group) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Training group not found',
          });
        }

        if (tenantContext.branchId && group.branchId !== tenantContext.branchId) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Access restricted to your assigned branch',
          });
        }

        const member = await tx.groupMember.findUnique({
          where: {
            groupId_playerId: {
              groupId,
              playerId,
            },
          },
        });

        if (!member || member.status !== 'ACTIVE') {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Player is not an active member of this group',
          });
        }

        const updated = await tx.groupMember.update({
          where: { id: member.id },
          data: {
            status: 'INACTIVE',
            endDate: new Date(),
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'GROUP_PLAYER_REMOVE',
            resourceType: 'GroupMember',
            resourceId: updated.id,
            metadata: {
              groupId,
              playerId,
            },
          },
          tx,
        );

        return { message: 'Player removed from group successfully' };
      },
    );
  }

  /**
   * Adds a recurring schedule to a training group.
   */
  async createSchedule(tenantContext: TenantContext, groupId: string, dto: CreateScheduleRequest) {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Start time must be before end time',
      });
    }

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const group = await tx.trainingGroup.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: groupId,
            },
          },
        });

        if (!group) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Training group not found',
          });
        }

        if (tenantContext.branchId && group.branchId !== tenantContext.branchId) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Access restricted to your assigned branch',
          });
        }

        const schedule = await tx.trainingSchedule.create({
          data: {
            tenantId: tenantContext.tenantId,
            groupId,
            dayOfWeek: dto.dayOfWeek,
            startTime: dto.startTime,
            endTime: dto.endTime,
            location: dto.location?.trim() || null,
            status: 'ACTIVE',
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'GROUP_SCHEDULE_CREATE',
            resourceType: 'TrainingSchedule',
            resourceId: schedule.id,
            metadata: {
              groupId,
              dayOfWeek: dto.dayOfWeek,
              startTime: dto.startTime,
              endTime: dto.endTime,
            },
          },
          tx,
        );

        return {
          id: schedule.id,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          location: schedule.location,
          status: schedule.status,
          createdAt: schedule.createdAt.toISOString(),
        };
      },
    );
  }

  /**
   * Deletes a training schedule.
   */
  async deleteSchedule(tenantContext: TenantContext, groupId: string, scheduleId: string) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const schedule = await tx.trainingSchedule.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: scheduleId,
            },
          },
        });

        if (!schedule || schedule.groupId !== groupId) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Schedule not found',
          });
        }

        if (tenantContext.branchId) {
          const group = await tx.trainingGroup.findUnique({
            where: { id: groupId },
          });
          if (group?.branchId !== tenantContext.branchId) {
            throw new ForbiddenException({
              code: ErrorCode.FORBIDDEN,
              message: 'Access restricted to your assigned branch',
            });
          }
        }

        await tx.trainingSchedule.delete({
          where: { id: scheduleId },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'GROUP_SCHEDULE_DELETE',
            resourceType: 'TrainingSchedule',
            resourceId: scheduleId,
            metadata: { groupId },
          },
          tx,
        );

        return { message: 'Schedule deleted successfully' };
      },
    );
  }
}
