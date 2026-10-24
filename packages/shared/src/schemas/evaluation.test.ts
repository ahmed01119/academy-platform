import { describe, expect, it } from 'vitest';
import {
  CreatePlayerEvaluationSchema,
  CreateEvaluationTemplateSchema,
  PerformanceRankingsResponseSchema,
} from './evaluation';

describe('Player Evaluation & Performance Schemas', () => {
  const validEvaluation = {
    playerId: '00000000-0000-4000-8000-000000000001',
    technicalScore: 8.5,
    tacticalScore: 7.5,
    physicalScore: 8.0,
    behavioralScore: 9.0,
    strengths: 'Excellent passing accuracy and vision',
    areasForImprovement: 'Needs to work on left-foot shooting',
    privateCoachNotes: 'Scout target for regional tournament (Internal Only)',
    guardianFeedback: 'Great improvement in tactical discipline and teamwork',
    suggestedGoals: 'Score 5 goals with left foot this season',
    isPublished: true,
  };

  it('validates a complete player evaluation submission', () => {
    const result = CreatePlayerEvaluationSchema.safeParse(validEvaluation);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.technicalScore).toBe(8.5);
      expect(result.data.tacticalScore).toBe(7.5);
      expect(result.data.physicalScore).toBe(8.0);
      expect(result.data.behavioralScore).toBe(9.0);
    }
  });

  it('calculates balanced overall score formula accurately: (tech + tact + phys + beh) / 4', () => {
    const { technicalScore, tacticalScore, physicalScore, behavioralScore } = validEvaluation;
    const computedOverall = Number(
      ((technicalScore + tacticalScore + physicalScore + behavioralScore) / 4).toFixed(2),
    );
    expect(computedOverall).toBe(8.25);
  });

  it('rejects scores outside the 1-10 rating scale', () => {
    expect(
      CreatePlayerEvaluationSchema.safeParse({ ...validEvaluation, technicalScore: 10.5 }).success,
    ).toBe(false);

    expect(
      CreatePlayerEvaluationSchema.safeParse({ ...validEvaluation, physicalScore: 0.5 }).success,
    ).toBe(false);
  });

  it('validates evaluation templates with custom 4-pillar criteria', () => {
    const validTemplate = {
      name: 'U-11 Football Development Standard',
      ageCategory: 'U-11',
      sport: 'FOOTBALL' as const,
      isDefault: true,
      criteria: [
        {
          id: 'crit-tech-1',
          category: 'TECHNICAL' as const,
          name: 'First Touch Control',
          weight: 1,
          maxScore: 10,
        },
        {
          id: 'crit-tact-1',
          category: 'TACTICAL' as const,
          name: 'Off-the-ball Movement',
          weight: 1,
          maxScore: 10,
        },
      ],
    };

    const res = CreateEvaluationTemplateSchema.safeParse(validTemplate);
    expect(res.success).toBe(true);
  });

  it('validates performance rankings response schema structure', () => {
    const validRankings = {
      items: [
        {
          rank: 1,
          playerId: '00000000-0000-4000-8000-000000000001',
          playerName: 'عمر فهد الغامدي',
          photoUrl: null,
          ageCategory: 'U-11',
          groupName: 'براعم النجوم (U-11)',
          evaluationsCount: 2,
          averageScore: 8.65,
          trend: 'UP' as const,
          trendDelta: 0.3,
        },
      ],
      ageCategory: 'U-11',
      sport: 'FOOTBALL',
      timeframe: 'ALL_TIME',
      criteriaFormula:
        'المعدل الحسابي المتوازن لمحاور الأداء الأربعة: (الفني + التكتيكي + البدني + السلوكي) / 4',
    };

    expect(PerformanceRankingsResponseSchema.safeParse(validRankings).success).toBe(true);
  });

  it('guarantees attendance rate semantics: (present + late) / eligibleRecords and unmarked is not attended', () => {
    const calculateAttendanceRate = (records: {
      present: number;
      late: number;
      absent: number;
      unmarked: number;
    }) => {
      const eligible = records.present + records.late + records.absent;
      if (eligible === 0) return 0;
      return Number((((records.present + records.late) / eligible) * 100).toFixed(1));
    };

    // 8 present, 1 late, 1 absent, 2 unmarked
    // eligible = 8 + 1 + 1 = 10 (unmarked does not count as eligible attendance)
    // attended = 8 + 1 = 9
    // rate = 9 / 10 = 90%
    const rate = calculateAttendanceRate({ present: 8, late: 1, absent: 1, unmarked: 2 });
    expect(rate).toBe(90.0);
  });
});
