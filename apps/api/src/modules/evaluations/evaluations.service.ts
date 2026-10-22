import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ErrorCode,
  type CreateEvaluationTemplateRequest,
  type CreatePlayerEvaluationRequest,
  type EvaluationTemplate,
  type PerformanceRankingsResponse,
  type PlayerDevelopmentProfile,
  type PlayerEvaluation,
  type PlayerRankingItem,
  type TenantContext,
} from '@academy/shared';

@Injectable()
export class EvaluationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /**
   * Lists evaluation templates for the current tenant.
   */
  async listTemplates(tenantContext: TenantContext): Promise<EvaluationTemplate[]> {
    return this.prisma.withTenantTransaction(tenantContext.tenantId, async (tx) => {
      const templates = await tx.evaluationTemplate.findMany({
        where: { tenantId: tenantContext.tenantId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      return templates.map((t) => ({
        id: t.id,
        tenantId: t.tenantId,
        sport: t.sport as 'FOOTBALL',
        ageCategory: t.ageCategory,
        name: t.name,
        description: t.description,
        criteria: t.criteria as unknown as EvaluationTemplate['criteria'],
        isDefault: t.isDefault,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }));
    });
  }

  /**
   * Creates an evaluation template for the tenant.
   */
  async createTemplate(
    tenantContext: TenantContext,
    dto: CreateEvaluationTemplateRequest,
  ): Promise<EvaluationTemplate> {
    return this.prisma.withTenantTransaction(tenantContext.tenantId, async (tx) => {
      if (dto.isDefault) {
        await tx.evaluationTemplate.updateMany({
          where: { tenantId: tenantContext.tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const template = await tx.evaluationTemplate.create({
        data: {
          tenantId: tenantContext.tenantId,
          sport: dto.sport ?? 'FOOTBALL',
          ageCategory: dto.ageCategory,
          name: dto.name,
          description: dto.description,
          criteria: (dto.criteria as unknown as object) ?? [],
          isDefault: dto.isDefault ?? false,
        },
      });

      return {
        id: template.id,
        tenantId: template.tenantId,
        sport: template.sport as 'FOOTBALL',
        ageCategory: template.ageCategory,
        name: template.name,
        description: template.description,
        criteria: template.criteria as unknown as EvaluationTemplate['criteria'],
        isDefault: template.isDefault,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Creates a player evaluation, optionally linked to a training session.
   */
  async createEvaluation(
    tenantContext: TenantContext,
    evaluatorUserId: string,
    dto: CreatePlayerEvaluationRequest,
  ): Promise<PlayerEvaluation> {
    return this.prisma.withTenantTransaction(tenantContext.tenantId, async (tx) => {
      const player = await tx.player.findUnique({
        where: { tenantId: tenantContext.tenantId, id: dto.playerId },
      });

      if (!player) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Player not found in this academy',
        });
      }

      const overallScore = Number(
        (
          (dto.technicalScore +
            dto.tacticalScore +
            dto.physicalScore +
            dto.behavioralScore) /
          4
        ).toFixed(2),
      );

      const evaluationDate = dto.evaluationDate ? new Date(dto.evaluationDate) : new Date();

      const evaluation = await tx.playerEvaluation.create({
        data: {
          tenantId: tenantContext.tenantId,
          playerId: dto.playerId,
          sessionId: dto.sessionId,
          evaluatorUserId,
          templateId: dto.templateId,
          evaluationDate,
          technicalScore: dto.technicalScore,
          tacticalScore: dto.tacticalScore,
          physicalScore: dto.physicalScore,
          behavioralScore: dto.behavioralScore,
          overallScore,
          metrics: dto.metrics ?? {},
          strengths: dto.strengths,
          areasForImprovement: dto.areasForImprovement,
          privateCoachNotes: dto.privateCoachNotes,
          guardianFeedback: dto.guardianFeedback,
          suggestedGoals: dto.suggestedGoals,
          isPublished: dto.isPublished ?? true,
        },
        include: {
          player: { select: { firstName: true, lastName: true, photoUrl: true } },
          evaluatorUser: { select: { name: true } },
          session: {
            select: {
              sessionDate: true,
              group: { select: { name: true } },
            },
          },
        },
      });

      await this.auditService.logEvent({
        tenantId: tenantContext.tenantId,
        actorUserId: evaluatorUserId,
        action: 'PLAYER_EVALUATION_CREATED',
        resourceType: 'PlayerEvaluation',
        resourceId: evaluation.id,
        metadata: {
          playerId: dto.playerId,
          overallScore,
          sessionId: dto.sessionId,
        },
      });

      return {
        id: evaluation.id,
        tenantId: evaluation.tenantId,
        playerId: evaluation.playerId,
        playerName: `${evaluation.player.firstName} ${evaluation.player.lastName}`,
        playerPhotoUrl: evaluation.player.photoUrl,
        sessionId: evaluation.sessionId,
        sessionDate: evaluation.session?.sessionDate ? evaluation.session.sessionDate.toISOString() : undefined,
        groupName: evaluation.session?.group?.name,
        evaluatorUserId: evaluation.evaluatorUserId,
        evaluatorName: evaluation.evaluatorUser.name,
        templateId: evaluation.templateId,
        evaluationDate: evaluation.evaluationDate.toISOString().split('T')[0]!,
        technicalScore: evaluation.technicalScore,
        tacticalScore: evaluation.tacticalScore,
        physicalScore: evaluation.physicalScore,
        behavioralScore: evaluation.behavioralScore,
        overallScore: evaluation.overallScore,
        metrics: evaluation.metrics as Record<string, number>,
        strengths: evaluation.strengths,
        areasForImprovement: evaluation.areasForImprovement,
        privateCoachNotes: evaluation.privateCoachNotes,
        guardianFeedback: evaluation.guardianFeedback,
        suggestedGoals: evaluation.suggestedGoals,
        isPublished: evaluation.isPublished,
        version: evaluation.version,
        createdAt: evaluation.createdAt.toISOString(),
        updatedAt: evaluation.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Retrieves player evaluations.
   */
  async listPlayerEvaluations(
    tenantContext: TenantContext,
    playerId: string,
    isGuardianOrPlayerView = false,
  ): Promise<PlayerEvaluation[]> {
    return this.prisma.withTenantTransaction(tenantContext.tenantId, async (tx) => {
      const evaluations = await tx.playerEvaluation.findMany({
        where: {
          tenantId: tenantContext.tenantId,
          playerId,
          ...(isGuardianOrPlayerView ? { isPublished: true } : {}),
        },
        orderBy: { evaluationDate: 'desc' },
        include: {
          player: { select: { firstName: true, lastName: true, photoUrl: true } },
          evaluatorUser: { select: { name: true } },
          session: {
            select: {
              sessionDate: true,
              group: { select: { name: true } },
            },
          },
        },
      });

      return evaluations.map((e) => ({
        id: e.id,
        tenantId: e.tenantId,
        playerId: e.playerId,
        playerName: `${e.player.firstName} ${e.player.lastName}`,
        playerPhotoUrl: e.player.photoUrl,
        sessionId: e.sessionId,
        sessionDate: e.session?.sessionDate ? e.session.sessionDate.toISOString() : undefined,
        groupName: e.session?.group?.name,
        evaluatorUserId: e.evaluatorUserId,
        evaluatorName: e.evaluatorUser.name,
        templateId: e.templateId,
        evaluationDate: e.evaluationDate.toISOString().split('T')[0]!,
        technicalScore: e.technicalScore,
        tacticalScore: e.tacticalScore,
        physicalScore: e.physicalScore,
        behavioralScore: e.behavioralScore,
        overallScore: e.overallScore,
        metrics: e.metrics as Record<string, number>,
        strengths: e.strengths,
        areasForImprovement: e.areasForImprovement,
        privateCoachNotes: isGuardianOrPlayerView ? null : e.privateCoachNotes,
        guardianFeedback: e.guardianFeedback,
        suggestedGoals: e.suggestedGoals,
        isPublished: e.isPublished,
        version: e.version,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      }));
    });
  }

  /**
   * Retrieves evaluations for a specific session.
   */
  async listSessionEvaluations(
    tenantContext: TenantContext,
    sessionId: string,
  ): Promise<PlayerEvaluation[]> {
    return this.prisma.withTenantTransaction(tenantContext.tenantId, async (tx) => {
      const evaluations = await tx.playerEvaluation.findMany({
        where: {
          tenantId: tenantContext.tenantId,
          sessionId,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          player: { select: { firstName: true, lastName: true, photoUrl: true } },
          evaluatorUser: { select: { name: true } },
          session: {
            select: {
              sessionDate: true,
              group: { select: { name: true } },
            },
          },
        },
      });

      return evaluations.map((e) => ({
        id: e.id,
        tenantId: e.tenantId,
        playerId: e.playerId,
        playerName: `${e.player.firstName} ${e.player.lastName}`,
        playerPhotoUrl: e.player.photoUrl,
        sessionId: e.sessionId,
        sessionDate: e.session?.sessionDate ? e.session.sessionDate.toISOString() : undefined,
        groupName: e.session?.group?.name,
        evaluatorUserId: e.evaluatorUserId,
        evaluatorName: e.evaluatorUser.name,
        templateId: e.templateId,
        evaluationDate: e.evaluationDate.toISOString().split('T')[0]!,
        technicalScore: e.technicalScore,
        tacticalScore: e.tacticalScore,
        physicalScore: e.physicalScore,
        behavioralScore: e.behavioralScore,
        overallScore: e.overallScore,
        metrics: e.metrics as Record<string, number>,
        strengths: e.strengths,
        areasForImprovement: e.areasForImprovement,
        privateCoachNotes: e.privateCoachNotes,
        guardianFeedback: e.guardianFeedback,
        suggestedGoals: e.suggestedGoals,
        isPublished: e.isPublished,
        version: e.version,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      }));
    });
  }

  /**
   * Retrieves a comprehensive development profile for a player.
   */
  async getPlayerDevelopmentProfile(
    tenantContext: TenantContext,
    playerId: string,
    isGuardianOrPlayerView = false,
  ): Promise<PlayerDevelopmentProfile> {
    return this.prisma.withTenantTransaction(tenantContext.tenantId, async (tx) => {
      const player = await tx.player.findUnique({
        where: { tenantId: tenantContext.tenantId, id: playerId },
      });

      if (!player) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'Player not found in this academy',
        });
      }

      const evals = await tx.playerEvaluation.findMany({
        where: {
          tenantId: tenantContext.tenantId,
          playerId,
          ...(isGuardianOrPlayerView ? { isPublished: true } : {}),
        },
        orderBy: { evaluationDate: 'asc' },
        include: {
          evaluatorUser: { select: { name: true } },
          session: {
            select: {
              sessionDate: true,
              group: { select: { name: true } },
            },
          },
        },
      });

      const count = evals.length;
      let avgTech = 0;
      let avgTact = 0;
      let avgPhys = 0;
      let avgBeh = 0;
      let avgOver = 0;

      const strengthsSet = new Set<string>();
      const improvementsSet = new Set<string>();
      const goalsSet = new Set<string>();

      const scoreHistory = evals.map((e) => {
        avgTech += e.technicalScore;
        avgTact += e.tacticalScore;
        avgPhys += e.physicalScore;
        avgBeh += e.behavioralScore;
        avgOver += e.overallScore;

        if (e.strengths?.trim()) strengthsSet.add(e.strengths.trim());
        if (e.areasForImprovement?.trim()) improvementsSet.add(e.areasForImprovement.trim());
        if (e.suggestedGoals?.trim()) goalsSet.add(e.suggestedGoals.trim());

        return {
          date: e.evaluationDate.toISOString().split('T')[0]!,
          overall: e.overallScore,
          technical: e.technicalScore,
          tactical: e.tacticalScore,
          physical: e.physicalScore,
          behavioral: e.behavioralScore,
        };
      });

      const averageScores = {
        technical: count > 0 ? Number((avgTech / count).toFixed(1)) : 0,
        tactical: count > 0 ? Number((avgTact / count).toFixed(1)) : 0,
        physical: count > 0 ? Number((avgPhys / count).toFixed(1)) : 0,
        behavioral: count > 0 ? Number((avgBeh / count).toFixed(1)) : 0,
        overall: count > 0 ? Number((avgOver / count).toFixed(1)) : 0,
      };

      const mappedEvals: PlayerEvaluation[] = evals.reverse().map((e) => ({
        id: e.id,
        tenantId: e.tenantId,
        playerId: e.playerId,
        playerName: `${player.firstName} ${player.lastName}`,
        playerPhotoUrl: player.photoUrl,
        sessionId: e.sessionId,
        sessionDate: e.session?.sessionDate ? e.session.sessionDate.toISOString() : undefined,
        groupName: e.session?.group?.name,
        evaluatorUserId: e.evaluatorUserId,
        evaluatorName: e.evaluatorUser.name,
        templateId: e.templateId,
        evaluationDate: e.evaluationDate.toISOString().split('T')[0]!,
        technicalScore: e.technicalScore,
        tacticalScore: e.tacticalScore,
        physicalScore: e.physicalScore,
        behavioralScore: e.behavioralScore,
        overallScore: e.overallScore,
        metrics: e.metrics as Record<string, number>,
        strengths: e.strengths,
        areasForImprovement: e.areasForImprovement,
        privateCoachNotes: isGuardianOrPlayerView ? null : e.privateCoachNotes,
        guardianFeedback: e.guardianFeedback,
        suggestedGoals: e.suggestedGoals,
        isPublished: e.isPublished,
        version: e.version,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      }));

      // Calculate age category (e.g. U-11, U-14, U-17)
      const age = Math.floor(
        (Date.now() - player.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      );
      const ageCategory = age <= 11 ? 'U-11' : age <= 14 ? 'U-14' : age <= 17 ? 'U-17' : 'Senior';

      return {
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        dateOfBirth: player.dateOfBirth.toISOString().split('T')[0]!,
        ageCategory,
        totalEvaluations: count,
        latestEvaluation: mappedEvals[0] ?? null,
        averageScores,
        scoreHistory,
        strongestSkills: Array.from(strengthsSet).slice(0, 5),
        areasNeedingImprovement: Array.from(improvementsSet).slice(0, 5),
        goals: Array.from(goalsSet).slice(0, 5),
        evaluations: mappedEvals,
      };
    });
  }

  /**
   * Calculates age-appropriate, group-filtered performance rankings with documented formulas.
   */
  async getPerformanceRankings(
    tenantContext: TenantContext,
    filter?: { ageCategory?: string; groupId?: string; timeframe?: string },
  ): Promise<PerformanceRankingsResponse> {
    return this.prisma.withTenantTransaction(tenantContext.tenantId, async (tx) => {
      // Find players in tenant
      let playerIds: string[] | undefined;

      if (filter?.groupId) {
        const members = await tx.groupMember.findMany({
          where: { tenantId: tenantContext.tenantId, groupId: filter.groupId, status: 'ACTIVE' },
          select: { playerId: true },
        });
        playerIds = members.map((m) => m.playerId);
      }

      const players = await tx.player.findMany({
        where: {
          tenantId: tenantContext.tenantId,
          status: 'ACTIVE',
          ...(playerIds ? { id: { in: playerIds } } : {}),
        },
        include: {
          groupMemberships: {
            where: { status: 'ACTIVE' },
            include: { group: { select: { name: true } } },
          },
          evaluations: {
            where: { isPublished: true },
            orderBy: { evaluationDate: 'desc' },
          },
        },
      });

      const rankingItems: PlayerRankingItem[] = [];

      for (const p of players) {
        const age = Math.floor(
          (Date.now() - p.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
        );
        const ageCategory = age <= 11 ? 'U-11' : age <= 14 ? 'U-14' : age <= 17 ? 'U-17' : 'Senior';

        if (filter?.ageCategory && ageCategory !== filter.ageCategory) {
          continue;
        }

        const evalsCount = p.evaluations.length;
        if (evalsCount === 0) continue;

        const totalScore = p.evaluations.reduce((sum, e) => sum + e.overallScore, 0);
        const avgScore = Number((totalScore / evalsCount).toFixed(2));

        // Trend calculation: compare latest score vs previous average
        let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
        let trendDelta = 0;

        if (evalsCount >= 2) {
          const latest = p.evaluations[0]!.overallScore;
          const previous = p.evaluations[1]!.overallScore;
          trendDelta = Number((latest - previous).toFixed(2));
          if (trendDelta > 0.3) trend = 'UP';
          else if (trendDelta < -0.3) trend = 'DOWN';
        }

        rankingItems.push({
          rank: 0,
          playerId: p.id,
          playerName: `${p.firstName} ${p.lastName}`,
          photoUrl: p.photoUrl,
          ageCategory,
          groupName: p.groupMemberships[0]?.group.name,
          evaluationsCount: evalsCount,
          averageScore: avgScore,
          trend,
          trendDelta,
        });
      }

      // Sort by averageScore descending, then by evaluationsCount descending
      rankingItems.sort((a, b) => {
        if (b.averageScore !== a.averageScore) {
          return b.averageScore - a.averageScore;
        }
        return b.evaluationsCount - a.evaluationsCount;
      });

      // Assign 1-based ranks
      rankingItems.forEach((item, index) => {
        item.rank = index + 1;
      });

      return {
        items: rankingItems,
        ageCategory: filter?.ageCategory,
        sport: 'FOOTBALL',
        timeframe: filter?.timeframe ?? 'ALL_TIME',
        criteriaFormula:
          'المعدل العام التراكمي = (المهارات الفنية + التكتيكية + البدنية + السلوكية) / 4 بناءً على تقييمات المدربين المعتمدة',
      };
    });
  }
}
