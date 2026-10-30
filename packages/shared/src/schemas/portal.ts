import { z } from 'zod';

export const ClaimAccountRequestSchema = z.object({
  claimToken: z.string().trim().min(6).max(64),
});

export type ClaimAccountRequest = z.infer<typeof ClaimAccountRequestSchema>;

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
