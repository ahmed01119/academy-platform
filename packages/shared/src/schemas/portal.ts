import { z } from 'zod';

export const ClaimAccountRequestSchema = z.object({
  claimToken: z.string().trim().min(6).max(64),
});

export type ClaimAccountRequest = z.infer<typeof ClaimAccountRequestSchema>;

/**
 * A signed-in guardian asks to be linked to a child who has a player account (owner decision 2026-11-24). The link is
 * made only when the guardian's phone matches a guardian the academy registered for that player AND the child approves
 * from an e-mail. The answer never says whether the e-mail or phone matched (no account enumeration).
 */
export const RequestGuardianLinkSchema = z.object({
  childEmail: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(8).max(30),
});
export type RequestGuardianLinkRequest = z.infer<typeof RequestGuardianLinkSchema>;

export const GuardianLinkTokenSchema = z.string().trim().min(1).max(512);

/** What the child sees before approving (from the e-mailed link). */
export const GuardianLinkRequestViewSchema = z.object({
  academyName: z.string(),
  playerFirstName: z.string(),
  /** The name of the guardian as registered by the academy. */
  guardianName: z.string(),
  /** The name on the account asking for the link. */
  requesterName: z.string(),
});
export type GuardianLinkRequestView = z.infer<typeof GuardianLinkRequestViewSchema>;

export const DecideGuardianLinkSchema = z.object({
  token: GuardianLinkTokenSchema,
  decision: z.enum(['APPROVE', 'DECLINE']),
});
export type DecideGuardianLinkRequest = z.infer<typeof DecideGuardianLinkSchema>;

export const PlayerPortalProfileSchema = z.object({
  playerId: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  tenantSlug: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  gender: z.string(),
  dateOfBirth: z.string(),
  photoUrl: z.string().nullable().optional(),
  branchName: z.string().optional(),
  groupName: z.string().optional(),
  headCoachName: z.string().optional(),
  status: z.string(),
  totalSessionsAttended: z.number(),
  attendanceRate: z.number(),
});

export type PlayerPortalProfile = z.infer<typeof PlayerPortalProfileSchema>;

export const PlayerPortalEvaluationSchema = z.object({
  id: z.string().uuid(),
  evaluationDate: z.string(),
  evaluatorName: z.string(),
  overallScore: z.number(),
  technicalScore: z.number(),
  tacticalScore: z.number(),
  physicalScore: z.number(),
  behavioralScore: z.number(),
  strengths: z.string().nullable().optional(),
  areasForImprovement: z.string().nullable().optional(),
  guardianFeedback: z.string().nullable().optional(),
  suggestedGoals: z.string().nullable().optional(),
});

export type PlayerPortalEvaluation = z.infer<typeof PlayerPortalEvaluationSchema>;

export const GuardianChildSummarySchema = z.object({
  playerId: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  tenantSlug: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  relationship: z.string(),
  branchName: z.string().optional(),
  groupName: z.string().optional(),
  photoUrl: z.string().nullable().optional(),
  dateOfBirth: z.string(),
  attendanceRate: z.number(),
  latestScore: z.number().optional(),
  upcomingSessionsCount: z.number(),
  /** Latest published evaluations (same fields as the player portal; private coach notes are never included). */
  recentEvaluations: z.array(PlayerPortalEvaluationSchema).optional(),
});

export type GuardianChildSummary = z.infer<typeof GuardianChildSummarySchema>;

export const GuardianPortalDataSchema = z.object({
  guardianId: z.string().uuid(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable().optional(),
  children: z.array(GuardianChildSummarySchema),
});

export type GuardianPortalData = z.infer<typeof GuardianPortalDataSchema>;
