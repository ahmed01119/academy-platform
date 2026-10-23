import { z } from 'zod';

export const PlatformOverviewMetricsSchema = z.object({
  totalAcademies: z.number(),
  activeAcademies: z.number(),
  suspendedAcademies: z.number(),
  provisioningAcademies: z.number(),
  trialAcademies: z.number().default(0),
  expiredAcademies: z.number().default(0),
  totalPlayers: z.number(),
  totalCoaches: z.number(),
  totalUsers: z.number(),
  totalBranches: z.number(),
  totalGuardians: z.number().default(0),
  totalSessionsCompleted: z.number(),
  activeSubscriptions: z.number().default(0),
  upcomingRenewals: z.number().default(0),
  expiredSubscriptions: z.number().default(0),
  mrr: z.number().default(0),
  collectedRevenue: z.number().default(0),
  outstandingInvoices: z.number().default(0),
  failedPayments: z.number().default(0),
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
  planCode: z.enum(['STARTER', 'PRO', 'ENTERPRISE', 'CUSTOM']).optional(),
  subscriptionStatus: z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED', 'PENDING']).optional(),
  renewalDate: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
});

export type PlatformAcademyItem = z.infer<typeof PlatformAcademyItemSchema>;

export const UpdateAcademyStatusRequestSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PROVISIONING']),
  reason: z.string().trim().min(3).max(500).optional(),
});

export type UpdateAcademyStatusRequest = z.infer<typeof UpdateAcademyStatusRequestSchema>;

export const PlatformUserItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  isPlatformSuperAdmin: z.boolean(),
  mustResetPassword: z.boolean(),
  isSuspended: z.boolean(),
  suspendedReason: z.string().nullable().optional(),
  activeSessionsCount: z.number(),
  createdAt: z.string().or(z.date()),
  memberships: z.array(
    z.object({
      tenantId: z.string().uuid(),
      tenantName: z.string(),
      role: z.string(),
      status: z.string(),
    }),
  ),
});

export type PlatformUserItem = z.infer<typeof PlatformUserItemSchema>;

export const UpdateUserSecurityPolicyRequestSchema = z.object({
  mustResetPassword: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  reason: z.string().trim().max(500).optional(),
});

export type UpdateUserSecurityPolicyRequest = z.infer<typeof UpdateUserSecurityPolicyRequestSchema>;

export const SaaSPlanItemSchema = z.object({
  id: z.string().uuid(),
  code: z.enum(['STARTER', 'PRO', 'ENTERPRISE', 'CUSTOM']),
  name: z.string(),
  description: z.string().nullable().optional(),
  priceMonthly: z.number(),
  priceYearly: z.number(),
  currency: z.string(),
  maxBranches: z.number(),
  maxPlayers: z.number(),
  maxCoaches: z.number(),
  features: z.record(z.unknown()),
  isActive: z.boolean(),
});

export type SaaSPlanItem = z.infer<typeof SaaSPlanItemSchema>;

export const UpdateSaaSPlanRequestSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  priceMonthly: z.number().min(0).optional(),
  priceYearly: z.number().min(0).optional(),
  maxBranches: z.number().min(1).optional(),
  maxPlayers: z.number().min(1).optional(),
  maxCoaches: z.number().min(1).optional(),
  features: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSaaSPlanRequest = z.infer<typeof UpdateSaaSPlanRequestSchema>;

export const PlatformAnnouncementItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  message: z.string(),
  type: z.enum(['INFO', 'WARNING', 'MAINTENANCE', 'CRITICAL']),
  targetRole: z.enum(['ALL', 'ACADEMY_ADMIN', 'COACH', 'GUARDIAN']),
  isActive: z.boolean(),
  startsAt: z.string().or(z.date()),
  endsAt: z.string().or(z.date()).nullable().optional(),
  createdAt: z.string().or(z.date()),
});

export type PlatformAnnouncementItem = z.infer<typeof PlatformAnnouncementItemSchema>;

export const CreatePlatformAnnouncementRequestSchema = z.object({
  title: z.string().min(3).max(200),
  message: z.string().min(5).max(2000),
  type: z.enum(['INFO', 'WARNING', 'MAINTENANCE', 'CRITICAL']).default('INFO'),
  targetRole: z.enum(['ALL', 'ACADEMY_ADMIN', 'COACH', 'GUARDIAN']).default('ALL'),
  isActive: z.boolean().default(true),
  endsAt: z.string().optional(),
});

export type CreatePlatformAnnouncementRequest = z.infer<typeof CreatePlatformAnnouncementRequestSchema>;

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

export const RequestSupportAccessSchema = z.object({
  reason: z.string().trim().min(10, 'A valid reason of at least 10 characters is required for audited support access').max(500),
});

export type RequestSupportAccessRequest = z.infer<typeof RequestSupportAccessSchema>;

export const SupportAccessResponseSchema = z.object({
  authorized: z.boolean(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  reason: z.string(),
  grantedAt: z.string(),
  expiresAt: z.string(),
  auditLogId: z.string().uuid(),
});

export type SupportAccessResponse = z.infer<typeof SupportAccessResponseSchema>;
