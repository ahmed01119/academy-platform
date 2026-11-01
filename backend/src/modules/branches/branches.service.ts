import {
  ConflictException,
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
  type BranchSummary,
  type CreateBranchRequest,
  type TenantContext,
  type UpdateBranchRequest,
  type BranchStatus,
} from '@academy/shared';

@Injectable()
export class BranchesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /**
   * Lists branches for the active tenant.
   * If the actor is branch-scoped, only their assigned branch is returned.
   */
  async listBranches(
    tenantContext: TenantContext,
    filter?: { search?: string; status?: BranchStatus },
  ): Promise<BranchSummary[]> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const whereClause: Prisma.BranchWhereInput = {
          tenantId: tenantContext.tenantId,
        };

        if (tenantContext.branchId) {
          whereClause.id = tenantContext.branchId;
        }

        if (filter?.status) {
          whereClause.status = filter.status;
        }

        if (filter?.search) {
          whereClause.OR = [
            { name: { contains: filter.search, mode: 'insensitive' } },
            { code: { contains: filter.search, mode: 'insensitive' } },
            { city: { contains: filter.search, mode: 'insensitive' } },
          ];
        }

        const branches = await tx.branch.findMany({
          where: whereClause,
          include: {
            managerUser: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            _count: {
              select: {
                playerEnrollments: { where: { status: 'ACTIVE' } },
                memberships: { where: { status: 'ACTIVE' } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        });

        return branches.map((b) => ({
          id: b.id,
          tenantId: b.tenantId,
          name: b.name,
          code: b.code,
          status: b.status as BranchStatus,
          city: b.city,
          country: b.country,
          address: b.address,
          phone: b.phone,
          capacity: b.capacity,
          managerUserId: b.managerUserId,
          managerUser: b.managerUser,
          activePlayersCount: b._count.playerEnrollments,
          activeStaffCount: b._count.memberships,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
        }));
      },
    );
  }

  /**
   * Retrieves a single branch by ID.
   */
  async getBranchById(tenantContext: TenantContext, branchId: string): Promise<BranchSummary> {
    if (tenantContext.branchId && tenantContext.branchId !== branchId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access restricted to your assigned branch',
      });
    }

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const b = await tx.branch.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: branchId,
            },
          },
          include: {
            managerUser: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            _count: {
              select: {
                playerEnrollments: { where: { status: 'ACTIVE' } },
                memberships: { where: { status: 'ACTIVE' } },
              },
            },
          },
        });

        if (!b) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Branch not found',
          });
        }

        return {
          id: b.id,
          tenantId: b.tenantId,
          name: b.name,
          code: b.code,
          status: b.status as BranchStatus,
          city: b.city,
          country: b.country,
          address: b.address,
          phone: b.phone,
          capacity: b.capacity,
          managerUserId: b.managerUserId,
          managerUser: b.managerUser,
          activePlayersCount: b._count.playerEnrollments,
          activeStaffCount: b._count.memberships,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
        };
      },
    );
  }

  /**
   * Creates a new branch for the tenant.
   */
  async createBranch(
    tenantContext: TenantContext,
    dto: CreateBranchRequest,
  ): Promise<BranchSummary> {
    const codeUpper = dto.code.trim().toUpperCase();

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const existingCode = await tx.branch.findUnique({
          where: {
            tenantId_code: {
              tenantId: tenantContext.tenantId,
              code: codeUpper,
            },
          },
        });

        if (existingCode) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'A branch with this code already exists in this academy',
          });
        }

        if (dto.managerUserId) {
          const managerMembership = await tx.tenantMembership.findUnique({
            where: {
              tenantId_userId: {
                tenantId: tenantContext.tenantId,
                userId: dto.managerUserId,
              },
            },
          });

          if (!managerMembership || managerMembership.status !== 'ACTIVE') {
            throw new NotFoundException({
              code: ErrorCode.NOT_FOUND,
              message: 'Assigned branch manager must be an active member of this academy',
            });
          }
        }

        const branch = await tx.branch.create({
          data: {
            tenantId: tenantContext.tenantId,
            name: dto.name.trim(),
            code: codeUpper,
            city: dto.city?.trim() || null,
            country: dto.country || 'EG',
            address: dto.address?.trim() || null,
            phone: dto.phone?.trim() || null,
            capacity: dto.capacity || null,
            managerUserId: dto.managerUserId || null,
          },
          include: {
            managerUser: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'BRANCH_CREATE',
            resourceType: 'Branch',
            resourceId: branch.id,
            metadata: {
              name: branch.name,
              code: branch.code,
              city: branch.city,
              capacity: branch.capacity,
            },
          },
          tx,
        );

        return {
          id: branch.id,
          tenantId: branch.tenantId,
          name: branch.name,
          code: branch.code,
          status: branch.status as BranchStatus,
          city: branch.city,
          country: branch.country,
          address: branch.address,
          phone: branch.phone,
          capacity: branch.capacity,
          managerUserId: branch.managerUserId,
          managerUser: branch.managerUser,
          activePlayersCount: 0,
          activeStaffCount: 0,
          createdAt: branch.createdAt.toISOString(),
          updatedAt: branch.updatedAt.toISOString(),
        };
      },
    );
  }

  /**
   * Updates an existing branch.
   */
  async updateBranch(
    tenantContext: TenantContext,
    branchId: string,
    dto: UpdateBranchRequest,
  ): Promise<BranchSummary> {
    if (tenantContext.branchId && tenantContext.branchId !== branchId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access restricted to your assigned branch',
      });
    }

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const existing = await tx.branch.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: branchId,
            },
          },
        });

        if (!existing) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Branch not found',
          });
        }

        const updateData: Prisma.BranchUncheckedUpdateInput = {};
        if (dto.name !== undefined) updateData.name = dto.name.trim();
        if (dto.city !== undefined) updateData.city = dto.city?.trim() || null;
        if (dto.country !== undefined) updateData.country = dto.country;
        if (dto.address !== undefined) updateData.address = dto.address?.trim() || null;
        if (dto.phone !== undefined) updateData.phone = dto.phone?.trim() || null;
        if (dto.capacity !== undefined) updateData.capacity = dto.capacity;
        if (dto.status !== undefined) updateData.status = dto.status;

        if (dto.code !== undefined) {
          const codeUpper = dto.code.trim().toUpperCase();
          if (codeUpper !== existing.code) {
            const conflict = await tx.branch.findUnique({
              where: {
                tenantId_code: {
                  tenantId: tenantContext.tenantId,
                  code: codeUpper,
                },
              },
            });
            if (conflict) {
              throw new ConflictException({
                code: ErrorCode.CONFLICT,
                message: 'A branch with this code already exists',
              });
            }
            updateData.code = codeUpper;
          }
        }

        if (dto.managerUserId !== undefined) {
          if (dto.managerUserId) {
            const managerMembership = await tx.tenantMembership.findUnique({
              where: {
                tenantId_userId: {
                  tenantId: tenantContext.tenantId,
                  userId: dto.managerUserId,
                },
              },
            });
            if (!managerMembership || managerMembership.status !== 'ACTIVE') {
              throw new NotFoundException({
                code: ErrorCode.NOT_FOUND,
                message: 'Assigned branch manager must be an active member of this academy',
              });
            }
          }
          updateData.managerUserId = dto.managerUserId;
        }

        const updated = await tx.branch.update({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: branchId,
            },
          },
          data: updateData,
          include: {
            managerUser: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            _count: {
              select: {
                playerEnrollments: { where: { status: 'ACTIVE' } },
                memberships: { where: { status: 'ACTIVE' } },
              },
            },
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'BRANCH_UPDATE',
            resourceType: 'Branch',
            resourceId: updated.id,
            metadata: {
              changedFields: Object.keys(updateData),
            },
          },
          tx,
        );

        return {
          id: updated.id,
          tenantId: updated.tenantId,
          name: updated.name,
          code: updated.code,
          status: updated.status as BranchStatus,
          city: updated.city,
          country: updated.country,
          address: updated.address,
          phone: updated.phone,
          capacity: updated.capacity,
          managerUserId: updated.managerUserId,
          managerUser: updated.managerUser,
          activePlayersCount: updated._count.playerEnrollments,
          activeStaffCount: updated._count.memberships,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        };
      },
    );
  }

  /**
   * Generates a pre-deletion impact assessment report for a branch.
   */
  async getBranchDeletionImpact(tenantContext: TenantContext, branchId: string) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const branch = await tx.branch.findUnique({
          where: { tenantId_id: { tenantId: tenantContext.tenantId, id: branchId } },
          include: {
            _count: {
              select: {
                playerEnrollments: { where: { status: 'ACTIVE' } },
                trainingGroups: true,
                attendanceSessions: { where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } },
                memberships: { where: { status: 'ACTIVE' } },
                financialTransactions: true,
              },
            },
          },
        });

        if (!branch) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Branch not found',
          });
        }

        const counts = branch._count;
        const hasBlockingDependencies =
          counts.playerEnrollments > 0 ||
          counts.trainingGroups > 0 ||
          counts.attendanceSessions > 0 ||
          counts.financialTransactions > 0;

        return {
          branchId: branch.id,
          branchName: branch.name,
          activeEnrollmentsCount: counts.playerEnrollments,
          groupsCount: counts.trainingGroups,
          activeSessionsCount: counts.attendanceSessions,
          activeStaffCount: counts.memberships,
          financialTransactionsCount: counts.financialTransactions,
          hasBlockingDependencies,
          recommendation: hasBlockingDependencies ? ('ARCHIVE' as const) : ('SAFE_DELETE' as const),
        };
      },
    );
  }

  /**
   * Safely archives a branch, marking it INACTIVE while preserving historical data.
   */
  async archiveBranch(tenantContext: TenantContext, branchId: string) {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const branch = await tx.branch.findUnique({
          where: { tenantId_id: { tenantId: tenantContext.tenantId, id: branchId } },
        });

        if (!branch) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Branch not found',
          });
        }

        const updated = await tx.branch.update({
          where: { tenantId_id: { tenantId: tenantContext.tenantId, id: branchId } },
          data: { status: 'INACTIVE' },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'BRANCH_ARCHIVED',
            resourceType: 'Branch',
            resourceId: branch.id,
            metadata: {
              name: branch.name,
              code: branch.code,
            },
          },
          tx,
        );

        return {
          success: true,
          message: `Branch "${branch.name}" archived safely. Historical records preserved.`,
          branch: {
            id: updated.id,
            name: updated.name,
            status: updated.status,
          },
        };
      },
    );
  }
}
