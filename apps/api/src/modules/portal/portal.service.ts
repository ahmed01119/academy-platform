import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TokenService } from '../auth/token.service';
import {
  ErrorCode,
  type GuardianChildSummary,
  type GuardianPortalData,
  type PlayerPortalEvaluation,
  type PlayerPortalProfile,
  type TenantContext,
} from '@academy/shared';

@Injectable()
export class PortalService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(TokenService) private readonly tokenService: TokenService,
  ) {}

  /**
   * Retrieves player portal data for an authenticated player user.
   */
  async getPlayerPortalData(actorUserId: string): Promise<{
    profile: PlayerPortalProfile;
    upcomingSessions: Array<{
      id: string;
      sessionDate: string;
      startTime: string;
      endTime: string;
      groupName: string;
      branchName?: string;
    }>;
    attendanceSummary: {
      totalEligible: number;
      present: number;
      late: number;
      absent: number;
      attendanceRate: number;
    };
    recentEvaluations: PlayerPortalEvaluation[];
  }> {
    return this.prisma.withPortalUserTransaction({ actorUserId }, async (tx) => {
      const player = await tx.player.findFirst({
        where: { userId: actorUserId },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          groupMemberships: {
            where: { status: 'ACTIVE' },
            include: {
              group: {
                include: {
                  branch: { select: { name: true } },
                  coaches: {
                    where: { isHeadCoach: true },
                    include: { coachUser: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
      });

      if (!player) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'No player profile linked to your account',
        });
      }

      // Compute attendance stats
      const records = await tx.attendanceRecord.findMany({
        where: { playerId: player.id },
      });

      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let excusedCount = 0;

      for (const r of records) {
        if (r.status === 'PRESENT') presentCount++;
        else if (r.status === 'LATE') lateCount++;
        else if (r.status === 'ABSENT') absentCount++;
        else if (r.status === 'EXCUSED') excusedCount++;
      }

      const totalEligible = presentCount + lateCount + absentCount + excusedCount;
      const attendanceRate =
        totalEligible > 0
          ? Number((((presentCount + lateCount) / totalEligible) * 100).toFixed(1))
          : 0;

      // Group info
      const primaryGroup = player.groupMemberships[0]?.group;
      const headCoach = primaryGroup?.coaches[0]?.coachUser;

      const profile: PlayerPortalProfile = {
        playerId: player.id,
        tenantId: player.tenant.id,
        tenantName: player.tenant.name,
        tenantSlug: player.tenant.slug,
        firstName: player.firstName,
        lastName: player.lastName,
        gender: player.gender,
        dateOfBirth: player.dateOfBirth.toISOString().split('T')[0]!,
        photoUrl: player.photoUrl,
        branchName: primaryGroup?.branch?.name,
        groupName: primaryGroup?.name,
        headCoachName: headCoach?.name,
        status: player.status,
        totalSessionsAttended: presentCount + lateCount,
        attendanceRate,
      };

      // Upcoming sessions
      const groupIds = player.groupMemberships.map((gm) => gm.groupId);
      const upcomingSessionsRaw = await tx.attendanceSession.findMany({
        where: {
          groupId: { in: groupIds },
          sessionDate: { gte: new Date() },
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        },
        orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
        take: 10,
        include: {
          group: {
            include: { branch: { select: { name: true } } },
          },
        },
      });

      const upcomingSessions = upcomingSessionsRaw.map((s) => ({
        id: s.id,
        sessionDate: s.sessionDate.toISOString().split('T')[0]!,
        startTime: s.startTime,
        endTime: s.endTime,
        groupName: s.group?.name ?? s.groupName,
        branchName: s.group?.branch?.name,
      }));

      // Recent evaluations (published only, hide private coach notes)
      const evals = await tx.playerEvaluation.findMany({
        where: { playerId: player.id, isPublished: true },
        orderBy: { evaluationDate: 'desc' },
        take: 5,
        include: {
          evaluatorUser: { select: { name: true } },
          session: { select: { sessionDate: true } },
        },
      });

      const recentEvaluations = evals.map((e) => ({
        id: e.id,
        evaluationDate: e.evaluationDate.toISOString().split('T')[0]!,
        evaluatorName: e.evaluatorUser.name,
        overallScore: e.overallScore,
        technicalScore: e.technicalScore,
        tacticalScore: e.tacticalScore,
        physicalScore: e.physicalScore,
        behavioralScore: e.behavioralScore,
        strengths: e.strengths,
        areasForImprovement: e.areasForImprovement,
        guardianFeedback: e.guardianFeedback,
        suggestedGoals: e.suggestedGoals,
      }));

      return {
        profile,
        upcomingSessions,
        attendanceSummary: {
          totalEligible,
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          attendanceRate,
        },
        recentEvaluations,
      };
    });
  }

  /**
   * Retrieves guardian portal data with all linked children.
   */
  async getGuardianPortalData(actorUserId: string): Promise<GuardianPortalData> {
    return this.prisma.withPortalUserTransaction({ actorUserId }, async (tx) => {
      const guardians = await tx.guardian.findMany({
        where: { userId: actorUserId },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          player: {
            include: {
              groupMemberships: {
                where: { status: 'ACTIVE' },
                include: {
                  group: {
                    include: { branch: { select: { name: true } } },
                  },
                },
              },
              evaluations: {
                where: { isPublished: true },
                orderBy: { evaluationDate: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      if (guardians.length === 0) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'No guardian profile linked to your account',
        });
      }

      const primaryGuardian = guardians[0]!;

      const children: GuardianChildSummary[] = [];

      for (const g of guardians) {
        const p = g.player;

        const records = await tx.attendanceRecord.findMany({
          where: { playerId: p.id },
        });

        let present = 0;
        let late = 0;
        let total = 0;

        for (const ar of records) {
          if (['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'].includes(ar.status)) {
            total++;
            if (ar.status === 'PRESENT') present++;
            else if (ar.status === 'LATE') late++;
          }
        }

        const attendanceRate = total > 0 ? Number((((present + late) / total) * 100).toFixed(1)) : 0;
        const primaryGroup = p.groupMemberships[0]?.group;

        children.push({
          playerId: p.id,
          tenantId: g.tenant.id,
          tenantName: g.tenant.name,
          tenantSlug: g.tenant.slug,
          firstName: p.firstName,
          lastName: p.lastName,
          relationship: g.relationship,
          branchName: primaryGroup?.branch?.name,
          groupName: primaryGroup?.name,
          photoUrl: p.photoUrl,
          dateOfBirth: p.dateOfBirth.toISOString().split('T')[0]!,
          attendanceRate,
          latestScore: p.evaluations[0]?.overallScore,
          upcomingSessionsCount: 0,
        });
      }

      return {
        guardianId: primaryGuardian.id,
        name: `${primaryGuardian.firstName} ${primaryGuardian.lastName}`,
        phone: primaryGuardian.phone,
        email: primaryGuardian.email,
        children,
      };
    });
  }

  /**
   * Generates a single-use claim token for an enrolled player or guardian.
   */
  async generateClaimToken(
    tenantContext: TenantContext,
    targetType: 'PLAYER' | 'GUARDIAN',
    targetId: string,
  ): Promise<{ claimToken: string; expiresAt: string }> {
    return this.prisma.withTenantTransaction(tenantContext.tenantId, async (tx) => {
      // Generate clean memorable token: ACAD-XXXXXX
      const rawCode = this.tokenService.generateSecureRandomString(4).toUpperCase();
      const claimToken = `ACAD-${rawCode}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      if (targetType === 'PLAYER') {
        const player = await tx.player.findUnique({
          where: { tenantId: tenantContext.tenantId, id: targetId },
        });
        if (!player) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Player not found',
          });
        }
        await tx.player.update({
          where: { tenantId: tenantContext.tenantId, id: targetId },
          data: { claimToken, claimExpiresAt: expiresAt },
        });
      } else {
        const guardian = await tx.guardian.findUnique({
          where: { tenantId: tenantContext.tenantId, id: targetId },
        });
        if (!guardian) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'Guardian not found',
          });
        }
        await tx.guardian.update({
          where: { tenantId: tenantContext.tenantId, id: targetId },
          data: { claimToken, claimExpiresAt: expiresAt },
        });
      }

      return {
        claimToken,
        expiresAt: expiresAt.toISOString(),
      };
    });
  }

  /**
   * Redeems a claim token to link the authenticated user to a Player or Guardian profile.
   */
  async redeemClaimToken(
    actorUserId: string,
    claimToken: string,
  ): Promise<{ success: boolean; type: 'PLAYER' | 'GUARDIAN'; entityId: string; message: string }> {
    const cleanToken = claimToken.trim();

    return this.prisma.$transaction(async (tx) => {
      // Check Player
      const player = await tx.player.findFirst({
        where: {
          claimToken: cleanToken,
          claimExpiresAt: { gte: new Date() },
        },
      });

      if (player) {
        if (player.userId && player.userId !== actorUserId) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'This player profile is already linked to another account',
          });
        }

        await tx.player.update({
          where: { id: player.id },
          data: {
            userId: actorUserId,
            claimToken: null,
            claimExpiresAt: null,
          },
        });

        await this.auditService.logEvent({
          tenantId: player.tenantId,
          actorUserId,
          action: 'PORTAL_PLAYER_ACCOUNT_CLAIMED',
          resourceType: 'Player',
          resourceId: player.id,
        });

        return {
          success: true,
          type: 'PLAYER',
          entityId: player.id,
          message: `تم ربط ملف اللاعب (${player.firstName} ${player.lastName}) بحسابك بنجاح`,
        };
      }

      // Check Guardian
      const guardian = await tx.guardian.findFirst({
        where: {
          claimToken: cleanToken,
          claimExpiresAt: { gte: new Date() },
        },
      });

      if (guardian) {
        await tx.guardian.update({
          where: { id: guardian.id },
          data: {
            userId: actorUserId,
            claimToken: null,
            claimExpiresAt: null,
          },
        });

        await this.auditService.logEvent({
          tenantId: guardian.tenantId,
          actorUserId,
          action: 'PORTAL_GUARDIAN_ACCOUNT_CLAIMED',
          resourceType: 'Guardian',
          resourceId: guardian.id,
        });

        return {
          success: true,
          type: 'GUARDIAN',
          entityId: guardian.id,
          message: `تم ربط حساب ولي الأمر (${guardian.firstName} ${guardian.lastName}) بحسابك بنجاح`,
        };
      }

      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'رمز المطالبة غير صالح أو منتهي الصلاحية',
      });
    });
  }
}
