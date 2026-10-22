import { z } from 'zod';

export const EvaluationCriterionSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['TECHNICAL', 'TACTICAL', 'PHYSICAL', 'BEHAVIORAL']),
  description: z.string().optional(),
  weight: z.number().min(0).max(10).default(1),
  maxScore: z.number().default(10),
});

export type EvaluationCriterion = z.infer<typeof EvaluationCriterionSchema>;

export const EvaluationTemplateSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sport: z.enum(['FOOTBALL']).default('FOOTBALL'),
  ageCategory: z.string().nullable().optional(),
  name: z.string().min(2).max(150),
  description: z.string().nullable().optional(),
  criteria: z.array(EvaluationCriterionSchema),
  isDefault: z.boolean().default(false),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type EvaluationTemplate = z.infer<typeof EvaluationTemplateSchema>;

export const CreateEvaluationTemplateSchema = z.object({
  sport: z.enum(['FOOTBALL']).default('FOOTBALL'),
  ageCategory: z.string().trim().max(50).optional(),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(500).optional(),
  criteria: z.array(EvaluationCriterionSchema),
  isDefault: z.boolean().optional(),
});

export type CreateEvaluationTemplateRequest = z.infer<typeof CreateEvaluationTemplateSchema>;

export const PlayerEvaluationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  playerId: z.string().uuid(),
  playerName: z.string().optional(),
  playerPhotoUrl: z.string().nullable().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  sessionDate: z.string().optional(),
  groupName: z.string().optional(),
  evaluatorUserId: z.string().uuid(),
  evaluatorName: z.string().optional(),
  templateId: z.string().uuid().nullable().optional(),
  evaluationDate: z.string(),
  technicalScore: z.number().min(0).max(10),
  tacticalScore: z.number().min(0).max(10),
  physicalScore: z.number().min(0).max(10),
  behavioralScore: z.number().min(0).max(10),
  overallScore: z.number().min(0).max(10),
  metrics: z.record(z.string(), z.number()).default({}),
  strengths: z.string().nullable().optional(),
  areasForImprovement: z.string().nullable().optional(),
  privateCoachNotes: z.string().nullable().optional(),
  guardianFeedback: z.string().nullable().optional(),
  suggestedGoals: z.string().nullable().optional(),
  isPublished: z.boolean().default(true),
  version: z.number().int().default(1),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type PlayerEvaluation = z.infer<typeof PlayerEvaluationSchema>;

export const CreatePlayerEvaluationSchema = z.object({
  playerId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  evaluationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  technicalScore: z.number().min(1).max(10),
  tacticalScore: z.number().min(1).max(10),
  physicalScore: z.number().min(1).max(10),
  behavioralScore: z.number().min(1).max(10),
  metrics: z.record(z.string(), z.number()).optional(),
  strengths: z.string().trim().max(1000).optional(),
  areasForImprovement: z.string().trim().max(1000).optional(),
  privateCoachNotes: z.string().trim().max(1000).optional(),
  guardianFeedback: z.string().trim().max(1000).optional(),
  suggestedGoals: z.string().trim().max(1000).optional(),
  isPublished: z.boolean().default(true),
});

export type CreatePlayerEvaluationRequest = z.infer<typeof CreatePlayerEvaluationSchema>;

export const PlayerDevelopmentProfileSchema = z.object({
  playerId: z.string().uuid(),
  playerName: z.string(),
  dateOfBirth: z.string(),
  ageCategory: z.string().optional(),
  totalEvaluations: z.number(),
  latestEvaluation: PlayerEvaluationSchema.nullable().optional(),
  averageScores: z.object({
    technical: z.number(),
    tactical: z.number(),
    physical: z.number(),
    behavioral: z.number(),
    overall: z.number(),
  }),
  scoreHistory: z.array(
    z.object({
      date: z.string(),
      overall: z.number(),
      technical: z.number(),
      tactical: z.number(),
      physical: z.number(),
      behavioral: z.number(),
    }),
  ),
  strongestSkills: z.array(z.string()),
  areasNeedingImprovement: z.array(z.string()),
  goals: z.array(z.string()),
  evaluations: z.array(PlayerEvaluationSchema),
});

export type PlayerDevelopmentProfile = z.infer<typeof PlayerDevelopmentProfileSchema>;

export const PlayerRankingItemSchema = z.object({
  rank: z.number(),
  playerId: z.string().uuid(),
  playerName: z.string(),
  photoUrl: z.string().nullable().optional(),
  ageCategory: z.string().optional(),
  groupName: z.string().optional(),
  evaluationsCount: z.number(),
  averageScore: z.number(),
  trend: z.enum(['UP', 'DOWN', 'STABLE']),
  trendDelta: z.number(),
});

export type PlayerRankingItem = z.infer<typeof PlayerRankingItemSchema>;

export const PerformanceRankingsResponseSchema = z.object({
  items: z.array(PlayerRankingItemSchema),
  ageCategory: z.string().optional(),
  sport: z.string(),
  timeframe: z.string(),
  criteriaFormula: z.string(),
});

export type PerformanceRankingsResponse = z.infer<typeof PerformanceRankingsResponseSchema>;
