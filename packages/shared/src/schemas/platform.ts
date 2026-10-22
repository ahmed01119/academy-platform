import { z } from 'zod';

export const PlatformOverviewMetricsSchema = z.object({
  totalAcademies: z.number(),
  activeAcademies: z.number(),
  suspendedAcademies: z.number(),
  provisioningAcademies: z.number(),
  totalPlayers: z.number(),
  totalCoaches: z.number(),
  totalUsers: z.number(),
  totalBranches: z.number(),
  totalSessionsCompleted: z.number(),
  systemHealth: z.enum(['HEALTHY', 'DEGRADED', 'CRITICAL']).default('HEALTHY'),
});

export type PlatformOverviewMetrics = z.infer<typeof PlatformOverviewMetricsSchema>;

export const PlatformAcademyItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PROVISIONING']),
  currency: z.string(),
  timezone: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  branchesCount: z.number(),
  playersCount: z.number(),
  coachesCount: z.number(),
  createdAt: z.string().or(z.date()),
});

export type PlatformAcademyItem = z.infer<typeof PlatformAcademyItemSchema>;

export const UpdateAcademyStatusRequestSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z.string().trim().min(3).max(500).optional(),
});

export type UpdateAcademyStatusRequest = z.infer<typeof UpdateAcademyStatusRequestSchema>;

export const PlatformAuditLogItemSchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable().optional(),
  actorEmail: z.string().nullable().optional(),
  tenantName: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
});

export type PlatformAuditLogItem = z.infer<typeof PlatformAuditLogItemSchema>;

export const PlatformSecurityEventSchema = z.object({
  id: z.string(),
  type: z.enum(['FAILED_LOGIN', 'SUSPICIOUS_TOKEN_REUSE', 'PERMISSION_DENIED', 'RATE_LIMIT_TRIGGERED']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  description: z.string(),
  ipAddress: z.string().nullable().optional(),
  actorEmail: z.string().nullable().optional(),
  timestamp: z.string().or(z.date()),
});

export type PlatformSecurityEvent = z.infer<typeof PlatformSecurityEventSchema>;
