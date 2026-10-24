import crypto from 'node:crypto';
import {
  BadRequestException,
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
  Permission,
  hasPermission,
  type CreatePlayerRequest,
  type PlayerDetails,
  type PlayerSummary,
  type TenantContext,
  type UpdatePlayerRequest,
  type PlayerStatus,
  type PlayerGender,
  type GuardianRelationship,
  type PlayerQrCardResponse,
  type RotatePlayerQrCardRequest,
  type RevokePlayerQrCardRequest,
  type PlayerJoinRequestItem,
  type ReviewPlayerJoinRequest,
  type ApplicationStatus,
} from '@academy/shared';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PlayersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Lists players in the tenant with search, filtering, and pagination.
   */
  async listPlayers(
    tenantContext: TenantContext,
    options?: {
      search?: string;
      branchId?: string;
      status?: PlayerStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    items: PlayerSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));
    const skip = (page - 1) * limit;

    const effectiveBranchId = tenantContext.branchId || options?.branchId;

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const whereClause: Prisma.PlayerWhereInput = {
          tenantId: tenantContext.tenantId,
        };

        if (options?.status) {
          whereClause.status = options.status;
        }

        if (effectiveBranchId) {
          whereClause.enrollments = {
            some: {
              branchId: effectiveBranchId,
              status: 'ACTIVE',
            },
          };
        }

        if (options?.search) {
          const term = options.search.trim();
          whereClause.OR = [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { nationalId: { contains: term } },
            { emergencyContactPhone: { contains: term } },
            {
              guardians: {
                some: {
                  OR: [
                    { firstName: { contains: term, mode: 'insensitive' } },
                    { lastName: { contains: term, mode: 'insensitive' } },
                    { phone: { contains: term } },
                  ],
                },
              },
            },
          ];
        }

        const [total, players] = await Promise.all([
          tx.player.count({ where: whereClause }),
          tx.player.findMany({
            where: whereClause,
            include: {
              guardians: {
                where: { isPrimary: true },
                take: 1,
              },
              enrollments: {
                where: { status: 'ACTIVE' },
                include: {
                  branch: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
                },
                take: 1,
                orderBy: { startDate: 'desc' },
              },
            },
            skip,
            take: limit,
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          }),
        ]);

        const items: PlayerSummary[] = players.map((p) => {
          const primaryGuardian = p.guardians[0] || null;
          const activeEnrollment = p.enrollments[0] || null;

          return {
            id: p.id,
            tenantId: p.tenantId,
            firstName: p.firstName,
            lastName: p.lastName,
            gender: p.gender as PlayerGender,
            dateOfBirth: p.dateOfBirth.toISOString().slice(0, 10),
            nationalId: p.nationalId,
            photoUrl: p.photoUrl,
            emergencyContactName: p.emergencyContactName,
            emergencyContactPhone: p.emergencyContactPhone,
            status: p.status as PlayerStatus,
            currentBranch: activeEnrollment
              ? {
                  id: activeEnrollment.branch.id,
                  name: activeEnrollment.branch.name,
                  code: activeEnrollment.branch.code,
                }
              : null,
            primaryGuardian: primaryGuardian
              ? {
                  id: primaryGuardian.id,
                  firstName: primaryGuardian.firstName,
                  lastName: primaryGuardian.lastName,
                  relationship: primaryGuardian.relationship as GuardianRelationship,
                  phone: primaryGuardian.phone,
                  email: primaryGuardian.email,
                  isPrimary: primaryGuardian.isPrimary,
                }
              : null,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
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

  /**
   * Retrieves full player details by ID including guardians and enrollment history.
   */
  async getPlayerById(tenantContext: TenantContext, playerId: string): Promise<PlayerDetails> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const p = await tx.player.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: playerId,
            },
          },
          include: {
            guardians: {
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            },
            enrollments: {
              include: {
                branch: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
              orderBy: { startDate: 'desc' },
            },
          },
        });

        if (!p) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Player not found',
          });
        }

        if (tenantContext.branchId) {
          const hasActiveBranchEnrollment = p.enrollments.some(
            (e) => e.branchId === tenantContext.branchId && e.status === 'ACTIVE',
          );
          if (!hasActiveBranchEnrollment) {
            throw new ForbiddenException({
              code: ErrorCode.FORBIDDEN,
              message: 'Access restricted: player is not actively enrolled in your assigned branch',
            });
          }
        }

        const canViewSensitive = Boolean(
          tenantContext.permissions?.includes(Permission.PLAYERS_SENSITIVE_READ) ||
          (tenantContext.role &&
            hasPermission(tenantContext.role, Permission.PLAYERS_SENSITIVE_READ)),
        );

        const primaryGuardian = p.guardians.find((g) => g.isPrimary) || p.guardians[0] || null;
        const activeEnrollment = p.enrollments.find((e) => e.status === 'ACTIVE') || null;

        return {
          id: p.id,
          tenantId: p.tenantId,
          firstName: p.firstName,
          lastName: p.lastName,
          gender: p.gender as PlayerGender,
          dateOfBirth: p.dateOfBirth.toISOString().slice(0, 10),
          nationalId: canViewSensitive ? p.nationalId : null,
          photoUrl: p.photoUrl,
          emergencyContactName: p.emergencyContactName,
          emergencyContactPhone: p.emergencyContactPhone,
          medicalNotes: canViewSensitive ? p.medicalNotes : null,
          status: p.status as PlayerStatus,
          currentBranch: activeEnrollment
            ? {
                id: activeEnrollment.branch.id,
                name: activeEnrollment.branch.name,
                code: activeEnrollment.branch.code,
              }
            : null,
          primaryGuardian: primaryGuardian
            ? {
                id: primaryGuardian.id,
                firstName: primaryGuardian.firstName,
                lastName: primaryGuardian.lastName,
                relationship: primaryGuardian.relationship as GuardianRelationship,
                phone: primaryGuardian.phone,
                email: primaryGuardian.email,
                isPrimary: primaryGuardian.isPrimary,
              }
            : null,
          guardians: p.guardians.map((g) => ({
            id: g.id,
            firstName: g.firstName,
            lastName: g.lastName,
            relationship: g.relationship as GuardianRelationship,
            phone: g.phone,
            email: g.email,
            isPrimary: g.isPrimary,
          })),
          enrollments: p.enrollments.map((e) => ({
            id: e.id,
            branchId: e.branchId,
            branch: {
              id: e.branch.id,
              name: e.branch.name,
              code: e.branch.code,
            },
            sport: e.sport,
            status: e.status,
            startDate: e.startDate.toISOString().slice(0, 10),
            endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
            notes: e.notes,
            createdAt: e.createdAt.toISOString(),
          })),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      },
    );
  }

  /**
   * Registers a new player with primary guardian and initial branch enrollment.
   */
  async createPlayer(
    tenantContext: TenantContext,
    dto: CreatePlayerRequest,
  ): Promise<PlayerDetails> {
    if (tenantContext.branchId && tenantContext.branchId !== dto.initialBranchId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Cannot enroll player outside your assigned branch',
      });
    }

    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        // Validate branch exists and is active
        const branch = await tx.branch.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: dto.initialBranchId,
            },
          },
        });

        if (!branch || branch.status !== 'ACTIVE') {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Specified branch not found or inactive',
          });
        }

        // Branch capacity enforcement
        if (branch.capacity !== null && branch.capacity !== undefined) {
          const activeCount = await tx.playerEnrollment.count({
            where: {
              tenantId: tenantContext.tenantId,
              branchId: branch.id,
              status: 'ACTIVE',
            },
          });
          if (activeCount >= branch.capacity) {
            throw new BadRequestException({
              code: ErrorCode.VALIDATION_FAILED,
              message: 'بلغ الفرع طاقته الاستيعابية القصوى (Branch has reached maximum capacity)',
            });
          }
        }

        // Sensitive data check
        const hasSensitivePerm = Boolean(
          tenantContext.permissions?.includes(Permission.PLAYERS_SENSITIVE_READ) ||
          (tenantContext.role &&
            hasPermission(tenantContext.role, Permission.PLAYERS_SENSITIVE_READ)),
        );
        if (dto.medicalNotes && !hasSensitivePerm) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'You do not have permission to record sensitive medical notes',
          });
        }

        // Check national ID collision within tenant if provided
        if (dto.nationalId) {
          const existingNationalId = await tx.player.findFirst({
            where: {
              tenantId: tenantContext.tenantId,
              nationalId: dto.nationalId.trim(),
            },
          });
          if (existingNationalId) {
            throw new ConflictException({
              code: ErrorCode.CONFLICT,
              message: 'A player with this National ID is already registered in this academy',
            });
          }
        }

        // 1. Create player
        const player = await tx.player.create({
          data: {
            tenantId: tenantContext.tenantId,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            gender: dto.gender,
            dateOfBirth: new Date(dto.dateOfBirth),
            nationalId: dto.nationalId?.trim() || null,
            photoUrl: dto.photoUrl?.trim() || null,
            emergencyContactName: dto.emergencyContactName.trim(),
            emergencyContactPhone: dto.emergencyContactPhone.trim(),
            medicalNotes: dto.medicalNotes?.trim() || null,
            status: 'ACTIVE',
          },
        });

        // 2. Create primary guardian
        const guardian = await tx.guardian.create({
          data: {
            tenantId: tenantContext.tenantId,
            playerId: player.id,
            firstName: dto.primaryGuardian.firstName.trim(),
            lastName: dto.primaryGuardian.lastName.trim(),
            relationship: dto.primaryGuardian.relationship,
            phone: dto.primaryGuardian.phone.trim(),
            email: dto.primaryGuardian.email?.trim() || null,
            isPrimary: true,
          },
        });

        // 3. Create initial enrollment
        const enrollment = await tx.playerEnrollment.create({
          data: {
            tenantId: tenantContext.tenantId,
            playerId: player.id,
            branchId: branch.id,
            sport: dto.sport,
            status: 'ACTIVE',
            startDate: new Date(),
          },
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'PLAYER_REGISTER',
            resourceType: 'Player',
            resourceId: player.id,
            metadata: {
              playerName: `${player.firstName} ${player.lastName}`,
              branchId: branch.id,
              branchName: branch.name,
              guardianName: `${guardian.firstName} ${guardian.lastName}`,
            },
          },
          tx,
        );

        return {
          id: player.id,
          tenantId: player.tenantId,
          firstName: player.firstName,
          lastName: player.lastName,
          gender: player.gender as PlayerGender,
          dateOfBirth: player.dateOfBirth.toISOString().slice(0, 10),
          nationalId: player.nationalId,
          photoUrl: player.photoUrl,
          emergencyContactName: player.emergencyContactName,
          emergencyContactPhone: player.emergencyContactPhone,
          medicalNotes: player.medicalNotes,
          status: player.status as PlayerStatus,
          currentBranch: {
            id: branch.id,
            name: branch.name,
            code: branch.code,
          },
          primaryGuardian: {
            id: guardian.id,
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            relationship: guardian.relationship as GuardianRelationship,
            phone: guardian.phone,
            email: guardian.email,
            isPrimary: guardian.isPrimary,
          },
          guardians: [
            {
              id: guardian.id,
              firstName: guardian.firstName,
              lastName: guardian.lastName,
              relationship: guardian.relationship as GuardianRelationship,
              phone: guardian.phone,
              email: guardian.email,
              isPrimary: guardian.isPrimary,
            },
          ],
          enrollments: [
            {
              id: enrollment.id,
              branchId: enrollment.branchId,
              branch: {
                id: enrollment.branch.id,
                name: enrollment.branch.name,
                code: enrollment.branch.code,
              },
              sport: enrollment.sport,
              status: enrollment.status,
              startDate: enrollment.startDate.toISOString().slice(0, 10),
              endDate: null,
              notes: enrollment.notes,
              createdAt: enrollment.createdAt.toISOString(),
            },
          ],
          createdAt: player.createdAt.toISOString(),
          updatedAt: player.updatedAt.toISOString(),
        };
      },
    );
  }

  /**
   * Updates player personal info, emergency contacts, or status.
   */
  async updatePlayer(
    tenantContext: TenantContext,
    playerId: string,
    dto: UpdatePlayerRequest,
  ): Promise<PlayerSummary> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const existing = await tx.player.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: playerId,
            },
          },
          include: {
            enrollments: {
              where: { status: 'ACTIVE' },
              take: 1,
            },
          },
        });

        if (!existing) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Player not found',
          });
        }

        if (tenantContext.branchId) {
          const inBranch = existing.enrollments.some((e) => e.branchId === tenantContext.branchId);
          if (!inBranch) {
            throw new ForbiddenException({
              code: ErrorCode.FORBIDDEN,
              message: 'Cannot update player outside your assigned branch',
            });
          }
        }

        const hasSensitivePerm = Boolean(
          tenantContext.permissions?.includes(Permission.PLAYERS_SENSITIVE_READ) ||
          (tenantContext.role &&
            hasPermission(tenantContext.role, Permission.PLAYERS_SENSITIVE_READ)),
        );

        if (
          dto.medicalNotes !== undefined &&
          dto.medicalNotes !== existing.medicalNotes &&
          !hasSensitivePerm
        ) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'You do not have permission to modify sensitive medical notes',
          });
        }

        if (dto.nationalId && dto.nationalId.trim() !== (existing.nationalId || '')) {
          const collision = await tx.player.findFirst({
            where: {
              tenantId: tenantContext.tenantId,
              nationalId: dto.nationalId.trim(),
              NOT: { id: playerId },
            },
          });
          if (collision) {
            throw new ConflictException({
              code: ErrorCode.CONFLICT,
              message: 'A player with this National ID is already registered in this academy',
            });
          }
        }

        const updateData: Prisma.PlayerUpdateInput = {};
        if (dto.firstName !== undefined) updateData.firstName = dto.firstName.trim();
        if (dto.lastName !== undefined) updateData.lastName = dto.lastName.trim();
        if (dto.gender !== undefined) updateData.gender = dto.gender;
        if (dto.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(dto.dateOfBirth);
        if (dto.nationalId !== undefined) updateData.nationalId = dto.nationalId?.trim() || null;
        if (dto.photoUrl !== undefined) updateData.photoUrl = dto.photoUrl?.trim() || null;
        if (dto.emergencyContactName !== undefined) {
          updateData.emergencyContactName = dto.emergencyContactName.trim();
        }
        if (dto.emergencyContactPhone !== undefined) {
          updateData.emergencyContactPhone = dto.emergencyContactPhone.trim();
        }
        if (dto.medicalNotes !== undefined) {
          updateData.medicalNotes = dto.medicalNotes?.trim() || null;
        }
        if (dto.status !== undefined) updateData.status = dto.status;

        const updated = await tx.player.update({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: playerId,
            },
          },
          data: updateData,
          include: {
            guardians: {
              where: { isPrimary: true },
              take: 1,
            },
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                branch: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
              take: 1,
            },
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'PLAYER_UPDATE',
            resourceType: 'Player',
            resourceId: updated.id,
            metadata: {
              changedFields: Object.keys(updateData),
            },
          },
          tx,
        );

        const canViewSensitive = Boolean(
          tenantContext.permissions?.includes(Permission.PLAYERS_SENSITIVE_READ) ||
          (tenantContext.role &&
            hasPermission(tenantContext.role, Permission.PLAYERS_SENSITIVE_READ)),
        );
        const primaryGuardian = updated.guardians[0] || null;
        const activeEnrollment = updated.enrollments[0] || null;

        return {
          id: updated.id,
          tenantId: updated.tenantId,
          firstName: updated.firstName,
          lastName: updated.lastName,
          gender: updated.gender as PlayerGender,
          dateOfBirth: updated.dateOfBirth.toISOString().slice(0, 10),
          nationalId: canViewSensitive ? updated.nationalId : null,
          photoUrl: updated.photoUrl,
          emergencyContactName: updated.emergencyContactName,
          emergencyContactPhone: updated.emergencyContactPhone,
          status: updated.status as PlayerStatus,
          currentBranch: activeEnrollment
            ? {
                id: activeEnrollment.branch.id,
                name: activeEnrollment.branch.name,
                code: activeEnrollment.branch.code,
              }
            : null,
          primaryGuardian: primaryGuardian
            ? {
                id: primaryGuardian.id,
                firstName: primaryGuardian.firstName,
                lastName: primaryGuardian.lastName,
                relationship: primaryGuardian.relationship as GuardianRelationship,
                phone: primaryGuardian.phone,
                email: primaryGuardian.email,
                isPrimary: primaryGuardian.isPrimary,
              }
            : null,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        };
      },
    );
  }

  /**
   * Retrieves player QR membership card data. Issues default credentials if not generated yet.
   */
  async getPlayerQrCard(
    tenantContext: TenantContext,
    playerId: string,
  ): Promise<PlayerQrCardResponse> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const player = await tx.player.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: playerId,
            },
          },
          include: {
            tenant: { select: { id: true, name: true, slug: true } },
            enrollments: {
              where: { status: 'ACTIVE' },
              take: 1,
            },
          },
        });

        if (!player) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Player not found',
          });
        }

        if (tenantContext.branchId) {
          const inBranch = player.enrollments.some((e) => e.branchId === tenantContext.branchId);
          if (!inBranch) {
            throw new ForbiddenException({
              code: ErrorCode.FORBIDDEN,
              message: 'Access restricted: player is not in your assigned branch',
            });
          }
        }

        // If player does not have a QR card code yet, generate default
        if (!player.qrCardCode) {
          const prefix = (player.tenant.slug || 'ACAD').toUpperCase().slice(0, 4);
          const membershipNumber =
            player.membershipNumber ||
            `${prefix}-${new Date().getFullYear()}-${player.id.slice(0, 6).toUpperCase()}`;
          const qrCardCode = crypto.randomBytes(16).toString('hex');
          const issuedAt = new Date();

          const updated = await tx.player.update({
            where: { id: player.id },
            data: {
              membershipNumber,
              qrCardCode,
              qrCardIssuedAt: issuedAt,
              qrCardRevokedAt: null,
            },
          });

          await this.auditService.logEvent(
            {
              tenantId: tenantContext.tenantId,
              actorUserId: tenantContext.actorUserId,
              action: 'PLAYER_QR_CARD_ISSUED',
              resourceType: 'Player',
              resourceId: player.id,
              metadata: {
                membershipNumber,
                issuedAt: issuedAt.toISOString(),
              },
            },
            tx,
          );

          return {
            playerId: updated.id,
            playerName: `${updated.firstName} ${updated.lastName}`,
            academyName: player.tenant.name,
            membershipNumber: updated.membershipNumber!,
            photoUrl: updated.photoUrl,
            qrCardCode: updated.qrCardCode!,
            issuedAt: updated.qrCardIssuedAt!.toISOString(),
            isRevoked: false,
            revokedAt: null,
          };
        }

        return {
          playerId: player.id,
          playerName: `${player.firstName} ${player.lastName}`,
          academyName: player.tenant.name,
          membershipNumber:
            player.membershipNumber ||
            `MEM-${new Date().getFullYear()}-${player.id.slice(0, 6).toUpperCase()}`,
          photoUrl: player.photoUrl,
          qrCardCode: player.qrCardCode,
          issuedAt: player.qrCardIssuedAt
            ? player.qrCardIssuedAt.toISOString()
            : player.createdAt.toISOString(),
          isRevoked: Boolean(player.qrCardRevokedAt),
          revokedAt: player.qrCardRevokedAt ? player.qrCardRevokedAt.toISOString() : null,
        };
      },
    );
  }

  /**
   * Rotates a player's QR credential (e.g. if physical card was lost or compromised).
   * Generates a new cryptographically random card code, invalidating previous code.
   */
  async rotatePlayerQrCard(
    tenantContext: TenantContext,
    playerId: string,
    dto?: RotatePlayerQrCardRequest,
  ): Promise<PlayerQrCardResponse> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const player = await tx.player.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: playerId,
            },
          },
          include: {
            tenant: { select: { id: true, name: true, slug: true } },
            enrollments: {
              where: { status: 'ACTIVE' },
              take: 1,
            },
          },
        });

        if (!player) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Player not found',
          });
        }

        if (tenantContext.branchId) {
          const inBranch = player.enrollments.some((e) => e.branchId === tenantContext.branchId);
          if (!inBranch) {
            throw new ForbiddenException({
              code: ErrorCode.FORBIDDEN,
              message: 'Access restricted: player is not in your assigned branch',
            });
          }
        }

        const newQrCardCode = crypto.randomBytes(16).toString('hex');
        const issuedAt = new Date();
        const prefix = (player.tenant.slug || 'ACAD').toUpperCase().slice(0, 4);
        const membershipNumber =
          player.membershipNumber ||
          `${prefix}-${new Date().getFullYear()}-${player.id.slice(0, 6).toUpperCase()}`;

        const updated = await tx.player.update({
          where: { id: player.id },
          data: {
            membershipNumber,
            qrCardCode: newQrCardCode,
            qrCardIssuedAt: issuedAt,
            qrCardRevokedAt: null,
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'PLAYER_QR_CARD_ROTATED',
            resourceType: 'Player',
            resourceId: player.id,
            metadata: {
              reason: dto?.reason || 'Player QR card rotated',
              rotatedAt: issuedAt.toISOString(),
            },
          },
          tx,
        );

        return {
          playerId: updated.id,
          playerName: `${updated.firstName} ${updated.lastName}`,
          academyName: player.tenant.name,
          membershipNumber: updated.membershipNumber!,
          photoUrl: updated.photoUrl,
          qrCardCode: updated.qrCardCode!,
          issuedAt: updated.qrCardIssuedAt!.toISOString(),
          isRevoked: false,
          revokedAt: null,
        };
      },
    );
  }

  /**
   * Revokes a player's QR credential without deleting the player.
   */
  async revokePlayerQrCard(
    tenantContext: TenantContext,
    playerId: string,
    dto: RevokePlayerQrCardRequest,
  ): Promise<PlayerQrCardResponse> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const player = await tx.player.findUnique({
          where: {
            tenantId_id: {
              tenantId: tenantContext.tenantId,
              id: playerId,
            },
          },
          include: {
            tenant: { select: { id: true, name: true } },
            enrollments: {
              where: { status: 'ACTIVE' },
              take: 1,
            },
          },
        });

        if (!player) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Player not found',
          });
        }

        if (tenantContext.branchId) {
          const inBranch = player.enrollments.some((e) => e.branchId === tenantContext.branchId);
          if (!inBranch) {
            throw new ForbiddenException({
              code: ErrorCode.FORBIDDEN,
              message: 'Access restricted: player is not in your assigned branch',
            });
          }
        }

        const revokedAt = new Date();

        const updated = await tx.player.update({
          where: { id: player.id },
          data: {
            qrCardRevokedAt: revokedAt,
          },
        });

        await this.auditService.logEvent(
          {
            tenantId: tenantContext.tenantId,
            actorUserId: tenantContext.actorUserId,
            action: 'PLAYER_QR_CARD_REVOKED',
            resourceType: 'Player',
            resourceId: player.id,
            metadata: {
              reason: dto.reason,
              revokedAt: revokedAt.toISOString(),
            },
          },
          tx,
        );

        return {
          playerId: updated.id,
          playerName: `${updated.firstName} ${updated.lastName}`,
          academyName: player.tenant.name,
          membershipNumber:
            updated.membershipNumber ||
            `MEM-${new Date().getFullYear()}-${updated.id.slice(0, 6).toUpperCase()}`,
          photoUrl: updated.photoUrl,
          qrCardCode: updated.qrCardCode || '',
          issuedAt: updated.qrCardIssuedAt
            ? updated.qrCardIssuedAt.toISOString()
            : updated.createdAt.toISOString(),
          isRevoked: true,
          revokedAt: revokedAt.toISOString(),
        };
      },
    );
  }

  /**
   * Lists registration join requests for the current academy.
   */
  async listPlayerJoinRequests(
    tenantContext: TenantContext,
    status?: ApplicationStatus,
  ): Promise<PlayerJoinRequestItem[]> {
    return this.prisma.withTenantTransaction(tenantContext, async (tx) => {
      const items = await tx.playerRegistrationRequest.findMany({
        where: {
          tenantId: tenantContext.tenantId,
          ...(status ? { status: status as any } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      return items.map((req) => ({
        id: req.id,
        tenantId: req.tenantId,
        applicantUserId: req.applicantUserId,
        playerName: req.playerName,
        contactEmail: req.contactEmail,
        contactPhone: req.contactPhone,
        dateOfBirth: req.dateOfBirth ? req.dateOfBirth.toISOString().split('T')[0] : null,
        guardianName: req.guardianName,
        status: req.status as ApplicationStatus,
        reviewNotes: req.reviewNotes,
        reviewedByUserId: req.reviewedByUserId,
        reviewedAt: req.reviewedAt?.toISOString() || null,
        createdAt: req.createdAt.toISOString(),
      }));
    });
  }

  /**
   * Reviews and approves or rejects a player join request.
   */
  async reviewPlayerJoinRequest(
    tenantContext: TenantContext,
    requestId: string,
    dto: ReviewPlayerJoinRequest,
  ): Promise<PlayerJoinRequestItem> {
    return this.prisma.withTenantTransaction(tenantContext, async (tx) => {
      const request = await tx.playerRegistrationRequest.findFirst({
        where: {
          id: requestId,
          tenantId: tenantContext.tenantId,
        },
      });

      if (!request) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Player registration request not found in this academy',
        });
      }

      if (request.status === 'APPROVED') {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Registration request has already been approved',
        });
      }

      if (dto.status === 'APPROVED') {
        const names = request.playerName.trim().split(' ');
        const firstName = names[0] || request.playerName.trim();
        const lastName = names.slice(1).join(' ') || '-';

        const membershipNumber = `MEM-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const qrCardCode = `QR-${tenantContext.tenantId.slice(0, 8)}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

        let effectiveBranchId = dto.branchId || tenantContext.branchId;
        if (!effectiveBranchId) {
          const mainBranch = await tx.branch.findFirst({
            where: { tenantId: tenantContext.tenantId, status: 'ACTIVE' },
          });
          effectiveBranchId = mainBranch?.id;
        }

        const player = await tx.player.create({
          data: {
            tenantId: tenantContext.tenantId,
            userId: request.applicantUserId,
            firstName,
            lastName,
            emergencyContactName: request.guardianName || 'Guardian',
            emergencyContactPhone: request.contactPhone || '-',
            dateOfBirth: request.dateOfBirth || new Date(2012, 0, 1),
            gender: 'MALE',
            status: 'ACTIVE',
            membershipNumber,
            qrCardCode,
            qrCardIssuedAt: new Date(),
          },
        });

        if (effectiveBranchId) {
          await tx.playerEnrollment.create({
            data: {
              tenantId: tenantContext.tenantId,
              playerId: player.id,
              branchId: effectiveBranchId,
              status: 'ACTIVE',
              startDate: new Date(),
            },
          });
        }

        if (dto.groupId) {
          await tx.groupMember.create({
            data: {
              tenantId: tenantContext.tenantId,
              playerId: player.id,
              groupId: dto.groupId,
              status: 'ACTIVE',
            },
          });
        }

        if (request.applicantUserId) {
          await this.notificationsService.createNotification({
            userId: request.applicantUserId,
            tenantId: tenantContext.tenantId,
            type: 'PLAYER_REGISTRATION',
            title: 'Academy Registration Approved',
            body: `Your request to join the academy for "${request.playerName}" has been approved!`,
            href: '/player',
          });
        }
      } else if (dto.status === 'REJECTED' && request.applicantUserId) {
        await this.notificationsService.createNotification({
          userId: request.applicantUserId,
          tenantId: tenantContext.tenantId,
          type: 'PLAYER_REGISTRATION',
          title: 'Registration Request Update',
          body: `Your registration request for "${request.playerName}" was rejected: ${dto.reviewNotes ?? 'Not accepted at this time.'}`,
          href: '/',
        });
      }

      const updated = await tx.playerRegistrationRequest.update({
        where: { id: requestId },
        data: {
          status: dto.status as any,
          reviewNotes: dto.reviewNotes?.trim() || null,
          reviewedByUserId: tenantContext.actorUserId,
          reviewedAt: new Date(),
        },
      });

      await this.auditService.logEvent(
        {
          tenantId: tenantContext.tenantId,
          actorUserId: tenantContext.actorUserId,
          action: `PLAYER_JOIN_REQUEST_${dto.status}`,
          resourceType: 'PlayerRegistrationRequest',
          resourceId: requestId,
          metadata: {
            playerName: request.playerName,
            status: dto.status,
          },
        },
        tx,
      );

      return {
        id: updated.id,
        tenantId: updated.tenantId,
        applicantUserId: updated.applicantUserId,
        playerName: updated.playerName,
        contactEmail: updated.contactEmail,
        contactPhone: updated.contactPhone,
        dateOfBirth: updated.dateOfBirth ? updated.dateOfBirth.toISOString().split('T')[0] : null,
        guardianName: updated.guardianName,
        status: updated.status as ApplicationStatus,
        reviewNotes: updated.reviewNotes,
        reviewedByUserId: updated.reviewedByUserId,
        reviewedAt: updated.reviewedAt?.toISOString() || null,
        createdAt: updated.createdAt.toISOString(),
      };
    });
  }
}
