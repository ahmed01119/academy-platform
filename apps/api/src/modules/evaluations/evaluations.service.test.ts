import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EvaluationsService } from './evaluations.service';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { TenantContext } from '@academy/shared';

type MockFn = ReturnType<typeof vi.fn>;

interface MockPrisma {
  evaluationTemplate: {
    findMany: MockFn;
    create: MockFn;
    updateMany: MockFn;
  };
  player: {
    findUnique: MockFn;
    findFirst: MockFn;
  };
  playerEvaluation: {
    create: MockFn;
    findMany: MockFn;
    count: MockFn;
  };
  trainingSession: {
    findFirst: MockFn;
  };
  withTenantTransaction: MockFn;
}

interface MockAudit {
  logEvent: MockFn;
}

describe('EvaluationsService', () => {
  let service: EvaluationsService;
  let mockPrisma: MockPrisma;
  let mockAudit: MockAudit;

  const mockTenantContext: TenantContext = {
    tenantId: '00000000-0000-4000-8000-000000000001',
    actorUserId: '00000000-0000-4000-8000-000000000099',
    locale: 'ar',
    permissions: [],
  };

  beforeEach(() => {
    mockPrisma = {
      evaluationTemplate: {
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      player: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      playerEvaluation: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      trainingSession: {
        findFirst: vi.fn(),
      },
      withTenantTransaction: vi.fn().mockImplementation((_tenantId, callback) => callback(mockPrisma)),
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    service = new EvaluationsService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  it('computes balanced overall score: (tech + tact + phys + beh) / 4', async () => {
    const mockPlayer = {
      id: '00000000-0000-4000-8000-000000000002',
      tenantId: mockTenantContext.tenantId,
      firstName: 'عمر',
      lastName: 'الغامدي',
    };
    mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);

    const createdEval = {
      id: '00000000-0000-4000-8000-000000000010',
      tenantId: mockTenantContext.tenantId,
      playerId: mockPlayer.id,
      sessionId: null,
      evaluatorUserId: mockTenantContext.actorUserId,
      templateId: null,
      evaluationDate: new Date('2026-10-21'),
      technicalScore: 8.0,
      tacticalScore: 9.0,
      physicalScore: 8.5,
      behavioralScore: 9.5,
      overallScore: 8.75, // (8.0 + 9.0 + 8.5 + 9.5) / 4 = 35.0 / 4 = 8.75
      metrics: {},
      strengths: 'First touch, field vision',
      areasForImprovement: 'Stamina',
      privateCoachNotes: 'Candidate for youth national team selection',
      guardianFeedback: 'Shows fantastic commitment in tactical positioning',
      suggestedGoals: '5 recovery runs per training match',
      isPublished: true,
      version: 1,
      createdAt: new Date('2026-10-21T10:00:00Z'),
      updatedAt: new Date('2026-10-21T10:00:00Z'),
      player: { firstName: 'عمر', lastName: 'الغامدي', photoUrl: null },
      evaluatorUser: { name: 'الكابتن أحمد ممدوح' },
      session: null,
    };
    mockPrisma.playerEvaluation.create.mockResolvedValue(createdEval);

    const result = await service.createEvaluation(
      mockTenantContext,
      mockTenantContext.actorUserId,
      {
        playerId: mockPlayer.id,
        technicalScore: 8.0,
        tacticalScore: 9.0,
        physicalScore: 8.5,
        behavioralScore: 9.5,
        strengths: 'First touch, field vision',
        areasForImprovement: 'Stamina',
        privateCoachNotes: 'Candidate for youth national team selection',
        guardianFeedback: 'Shows fantastic commitment in tactical positioning',
        suggestedGoals: '5 recovery runs per training match',
        isPublished: true,
      },
    );

    expect(result.overallScore).toBe(8.75);
    expect(result.playerName).toBe('عمر الغامدي');
    expect(result.evaluatorName).toBe('الكابتن أحمد ممدوح');
    expect(mockAudit.logEvent).toHaveBeenCalled();
  });

  it('lists evaluation templates ordered with default template first', async () => {
    mockPrisma.evaluationTemplate.findMany.mockResolvedValue([
      {
        id: 'tmpl-1',
        tenantId: mockTenantContext.tenantId,
        sport: 'FOOTBALL',
        ageCategory: null,
        name: 'Default 4-Pillar Evaluation',
        description: 'Standard rubric',
        criteria: [],
        isDefault: true,
        createdAt: new Date('2026-10-21T08:00:00Z'),
        updatedAt: new Date('2026-10-21T08:00:00Z'),
      },
    ]);

    const templates = await service.listTemplates(mockTenantContext);
    expect(templates).toHaveLength(1);
    expect(templates[0]?.name).toBe('Default 4-Pillar Evaluation');
    expect(templates[0]?.isDefault).toBe(true);
  });

  it('generates player development profile with radar breakdown', async () => {
    const mockPlayer = {
      id: '00000000-0000-4000-8000-000000000002',
      tenantId: mockTenantContext.tenantId,
      firstName: 'عمر',
      lastName: 'الغامدي',
      dateOfBirth: new Date('2015-05-10'),
      enrollments: [{ branch: { name: 'فرع النرجس' } }],
      groupMemberships: [{ group: { name: 'براعم النجوم (U-11)' } }],
    };
    mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);

    const mockEvals = [
      {
        id: 'eval-1',
        tenantId: mockTenantContext.tenantId,
        playerId: mockPlayer.id,
        sessionId: null,
        evaluatorUserId: mockTenantContext.actorUserId,
        templateId: null,
        evaluationDate: new Date('2026-10-20'),
        technicalScore: 8.0,
        tacticalScore: 8.0,
        physicalScore: 8.0,
        behavioralScore: 8.0,
        overallScore: 8.0,
        metrics: {},
        strengths: 'Dribbling',
        areasForImprovement: 'Weak foot',
        privateCoachNotes: 'Coach note',
        guardianFeedback: 'Parent note',
        suggestedGoals: 'Daily juggling',
        isPublished: true,
        version: 1,
        createdAt: new Date('2026-10-20'),
        updatedAt: new Date('2026-10-20'),
        player: { firstName: 'عمر', lastName: 'الغامدي', photoUrl: null },
        evaluatorUser: { name: 'الكابتن أحمد ممدوح' },
        session: null,
      },
    ];
    mockPrisma.playerEvaluation.findMany.mockResolvedValue(mockEvals);

    const profile = await service.getPlayerDevelopmentProfile(mockTenantContext, mockPlayer.id);

    expect(profile.playerName).toBe('عمر الغامدي');
    expect(profile.totalEvaluations).toBe(1);
    expect(profile.averageScores.overall).toBe(8.0);
    expect(profile.strongestSkills).toContain('Dribbling');
  });
});
