import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  ErrorCode,
  type CreateEnrollmentRequest,
  type EnrollmentSummary,
  type TenantContext,
  type TransferBranchRequest,
  type EnrollmentStatus,
} from '@academy/shared';

@Injectable()
export class EnrollmentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /**
   * Lists enrollments in tenant with branch and player summary.
   */
  async listEnrollments(
    tenantContext: TenantContext,
    options?: {
      playerId?: string;
      branchId?: string;
      status?: EnrollmentStatus;
    },
  ): Promise<EnrollmentSummary[]> {
    const effectiveBranchId = tenantContext.branchId || options?.branchId;

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const whereClause: Prisma.PlayerEnrollmentWhereInput = {
          tenantId: tenantContext.tenantId,
        };

        if (options?.playerId) {
          whereClause.playerId = options.playerId;
        }

        if (effectiveBranchId) {
          whereClause.branchId = effectiveBranchId;
        }

        if (options?.status) {
          whereClause.status = options.status;
        }

        const enrollments = await tx.playerEnrollment.findMany({
          where: whereClause,
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            player: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photoUrl: true,
              },
            },
          },
          orderBy: { startDate: 'desc' },
        });

        return enrollments.map((e) => ({
          id: e.id,
          tenantId: e.tenantId,
          playerId: e.playerId,
          branchId: e.branchId,
          sport: e.sport,
          status: e.status as EnrollmentStatus,
          startDate: e.startDate.toISOString().slice(0, 10),
          endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
          notes: e.notes,
          branch: {
            id: e.branch.id,
            name: e.branch.name,
            code: e.branch.code,
          },
          player: e.player
            ? {
                id: e.player.id,
                firstName: e.player.firstName,
                lastName: e.player.lastName,
                photoUrl: e.player.photoUrl,
              }
            : undefined,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        }));
      },
    );
  }

  /**
   * Enrolls a player into a branch and sport.
   */
  async createEnrollment(
    tenantContext: TenantContext,
    dto: CreateEnrollmentRequest,
  ): Promise<EnrollmentSummary> {
    if (tenantContext.branchId && tenantContext.branchId !== dto.branchId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Cannot enroll player outside your assigned branch',
      });
    }

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        // Verify player belongs to tenant
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

        // Verify branch belongs to tenant and is active
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

        const enrollment = await tx.playerEnrollment.create({
          data: {
            tenantId: tenantContext.tenantId,
            playerId: player.id,
            branchId: branch.id,
            sport: dto.sport,
            status: 'ACTIVE',
            startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
            notes: dto.notes?.trim() || null,
          },
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            player: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photoUrl: true,
              },
            },
          },
        });

        await this.auditService.logEvent({
          tenantId: tenantContext.tenantId,
          actorUserId: tenantContext.actorUserId,
          action: 'ENROLLMENT_CREATE',
          resourceType: 'PlayerEnrollment',
          resourceId: enrollment.id,
          metadata: {
            playerId: player.id,
            playerName: `${player.firstName} ${player.lastName}`,
            branchId: branch.id,
            branchName: branch.name,
            sport: enrollment.sport,
          },
        });

        return {
          id: enrollment.id,
          tenantId: enrollment.tenantId,
          playerId: enrollment.playerId,
          branchId: enrollment.branchId,
          sport: enrollment.sport,
          status: enrollment.status as EnrollmentStatus,
          startDate: enrollment.startDate.toISOString().slice(0, 10),
          endDate: null,
          notes: enrollment.notes,
          branch: {
            id: enrollment.branch.id,
            name: enrollment.branch.name,
            code: enrollment.branch.code,
          },
          player: enrollment.player
            ? {
                id: enrollment.player.id,
                firstName: enrollment.player.firstName,
                lastName: enrollment.player.lastName,
                photoUrl: enrollment.player.photoUrl,
              }
            : undefined,
          createdAt: enrollment.createdAt.toISOString(),
          updatedAt: enrollment.updatedAt.toISOString(),
        };
      },
    );
  }

  /**
   * Transfers a player from their current branch to a target branch.
   * Maintains complete branch history by closing current enrollment and activating new one.
   */
  async transferBranch(
    tenantContext: TenantContext,
    enrollmentId: string,
    dto: TransferBranchRequest,
  ): Promise<EnrollmentSummary> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const sourceEnrollment = await tx.playerEnrollment.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: enrollmentId,
            },
          },
          include: {
            branch: true,
            player: true,
          },
        });

        if (!sourceEnrollment) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Active enrollment not found',
          });
        }

        if (sourceEnrollment.status !== 'ACTIVE') {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Only active enrollments can be transferred',
          });
        }

        if (tenantContext.branchId && tenantContext.branchId !== sourceEnrollment.branchId) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'Cannot transfer player from another branch',
          });
        }

        if (sourceEnrollment.branchId === dto.targetBranchId) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Player is already enrolled in this branch',
          });
        }

        // Verify target branch exists and is active
        const targetBranch = await tx.branch.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: dto.targetBranchId,
            },
          },
        });

        if (!targetBranch || targetBranch.status !== 'ACTIVE') {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Target branch not found or inactive',
          });
        }

        const effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : new Date();

        // 1. Close previous enrollment with status COMPLETED
        await tx.playerEnrollment.update({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: sourceEnrollment.id,
            },
          },
          data: {
            status: 'COMPLETED',
            endDate: effectiveDate,
            notes: sourceEnrollment.notes
              ? `${sourceEnrollment.notes} | تم النقل إلى فرع ${targetBranch.name}`
              : `تم النقل إلى فرع ${targetBranch.name}`,
          },
        });

        // 2. Create new enrollment in target branch
        const newEnrollment = await tx.playerEnrollment.create({
          data: {
            tenantId: tenantContext.tenantId,
            playerId: sourceEnrollment.playerId,
            branchId: targetBranch.id,
            sport: sourceEnrollment.sport,
            status: 'ACTIVE',
            startDate: effectiveDate,
            notes: dto.notes ? dto.notes.trim() : `تم النقل من فرع ${sourceEnrollment.branch.name}`,
          },
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            player: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photoUrl: true,
              },
            },
          },
        });

        await this.auditService.logEvent({
          tenantId: tenantContext.tenantId,
          actorUserId: tenantContext.actorUserId,
          action: 'PLAYER_BRANCH_TRANSFER',
          resourceType: 'PlayerEnrollment',
          resourceId: newEnrollment.id,
          metadata: {
            playerId: sourceEnrollment.playerId,
            playerName: `${sourceEnrollment.player.firstName} ${sourceEnrollment.player.lastName}`,
            fromBranchId: sourceEnrollment.branchId,
            fromBranchName: sourceEnrollment.branch.name,
            toBranchId: targetBranch.id,
            toBranchName: targetBranch.name,
            effectiveDate: effectiveDate.toISOString(),
          },
        });

        return {
          id: newEnrollment.id,
          tenantId: newEnrollment.tenantId,
          playerId: newEnrollment.playerId,
          branchId: newEnrollment.branchId,
          sport: newEnrollment.sport,
          status: newEnrollment.status as EnrollmentStatus,
          startDate: newEnrollment.startDate.toISOString().slice(0, 10),
          endDate: null,
          notes: newEnrollment.notes,
          branch: {
            id: newEnrollment.branch.id,
            name: newEnrollment.branch.name,
            code: newEnrollment.branch.code,
          },
          player: newEnrollment.player
            ? {
                id: newEnrollment.player.id,
                firstName: newEnrollment.player.firstName,
                lastName: newEnrollment.player.lastName,
                photoUrl: newEnrollment.player.photoUrl,
              }
            : undefined,
          createdAt: newEnrollment.createdAt.toISOString(),
          updatedAt: newEnrollment.updatedAt.toISOString(),
        };
      },
    );
  }
}
