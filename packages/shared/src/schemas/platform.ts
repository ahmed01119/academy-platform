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
  isPlatformOwner: z.boolean().default(false),
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

export type CreatePlatformAnnouncementRequest = z.infer<
  typeof CreatePlatformAnnouncementRequestSchema
>;

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
  type: z.enum([
    'FAILED_LOGIN',
    'SUSPICIOUS_TOKEN_REUSE',
    'PERMISSION_DENIED',
    'RATE_LIMIT_TRIGGERED',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  description: z.string(),
  ipAddress: z.string().nullable().optional(),
  actorEmail: z.string().nullable().optional(),
  timestamp: z.string().or(z.date()),
});

export type PlatformSecurityEvent = z.infer<typeof PlatformSecurityEventSchema>;

export const RequestSupportAccessSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'A valid reason of at least 10 characters is required for audited support access')
    .max(500),
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

// ==========================================
// Academy Applications & Approvals
// ==========================================

export const ApplicationStatusSchema = z.enum([
  'PENDING_REVIEW',
  'MORE_INFO_REQUESTED',
  'APPROVED',
  'REJECTED',
]);

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const CreateAcademyApplicationRequestSchema = z.object({
  academyName: z.string().min(2, 'Academy name must be at least 2 characters').max(100),
  academySlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and dashes'),
  sport: z.enum(['FOOTBALL']).default('FOOTBALL'),
  city: z.string().max(100).optional(),
  contactPhone: z.string().max(30).optional(),
  contactEmail: z.string().email(),
  notes: z.string().max(1000).optional(),
});

export type CreateAcademyApplicationRequest = z.infer<typeof CreateAcademyApplicationRequestSchema>;

export const ReviewAcademyApplicationRequestSchema = z.object({
  status: z.enum(['MORE_INFO_REQUESTED', 'APPROVED', 'REJECTED']),
  reviewNotes: z.string().max(1000).optional(),
  initialPlanCode: z.enum(['STARTER', 'PRO', 'ENTERPRISE', 'CUSTOM']).default('STARTER'),
});

export type ReviewAcademyApplicationRequest = z.infer<typeof ReviewAcademyApplicationRequestSchema>;

export const AcademyApplicationItemSchema = z.object({
  id: z.string().uuid(),
  applicantUserId: z.string().uuid(),
  applicantName: z.string().optional(),
  academyName: z.string(),
  academySlug: z.string(),
  sport: z.string(),
  city: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  contactEmail: z.string(),
  notes: z.string().nullable().optional(),
  status: ApplicationStatusSchema,
  reviewNotes: z.string().nullable().optional(),
  reviewedByUserId: z.string().uuid().nullable().optional(),
  reviewedAt: z.string().or(z.date()).nullable().optional(),
  provisionedTenantId: z.string().uuid().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type AcademyApplicationItem = z.infer<typeof AcademyApplicationItemSchema>;

// ==========================================
// Player Join Requests & Approvals
// ==========================================

export const CreatePlayerJoinRequestSchema = z.object({
  tenantId: z.string().uuid(),
  playerName: z.string().min(2).max(100),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(30).optional(),
  dateOfBirth: z.string().optional(),
  guardianName: z.string().max(100).optional(),
  branchId: z.string().uuid().optional(),
});

export type CreatePlayerJoinRequest = z.infer<typeof CreatePlayerJoinRequestSchema>;

export const ReviewPlayerJoinRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'MORE_INFO_REQUESTED']),
  branchId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  reviewNotes: z.string().max(500).optional(),
});

export type ReviewPlayerJoinRequest = z.infer<typeof ReviewPlayerJoinRequestSchema>;

export const PlayerJoinRequestItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantName: z.string().optional(),
  applicantUserId: z.string().uuid().nullable().optional(),
  playerName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  guardianName: z.string().nullable().optional(),
  status: ApplicationStatusSchema,
  reviewNotes: z.string().nullable().optional(),
  reviewedByUserId: z.string().uuid().nullable().optional(),
  reviewedAt: z.string().or(z.date()).nullable().optional(),
  createdAt: z.string().or(z.date()),
});

export type PlayerJoinRequestItem = z.infer<typeof PlayerJoinRequestItemSchema>;

// ==========================================
// Storage & Data Lifecycle Schemas
// ==========================================

export const TableStorageStatSchema = z.object({
  tableName: z.string(),
  rowCount: z.number(),
  totalBytes: z.number(),
  indexBytes: z.number(),
  formattedSize: z.string(),
});

export type TableStorageStat = z.infer<typeof TableStorageStatSchema>;

export const StorageMetricsSchema = z.object({
  databaseSizeBytes: z.number(),
  formattedDatabaseSize: z.string(),
  totalTables: z.number(),
  tables: z.array(TableStorageStatSchema),
  auditLogsCount: z.number(),
  auditLogsSizeBytes: z.number(),
  mediaStorageBytes: z.number(),
  availableDiskBytes: z.number().optional(),
  cacheKeysCount: z.number(),
  estimatedMonthlyGrowthBytes: z.number(),
});

export type StorageMetrics = z.infer<typeof StorageMetricsSchema>;

export const StorageMaintenanceDryRunResponseSchema = z.object({
  expiredSessionsCount: z.number(),
  expiredTokensCount: z.number(),
  purgeableAuditLogsCount: z.number(),
  estimatedReclaimableBytes: z.number(),
  formattedReclaimableSize: z.string(),
  protectedRecordsSummary: z.object({
    financialTransactionsCount: z.number(),
    activePlayersCount: z.number(),
    activeSubscriptionsCount: z.number(),
  }),
});

export type StorageMaintenanceDryRunResponse = z.infer<
  typeof StorageMaintenanceDryRunResponseSchema
>;

export const ExecuteStorageMaintenanceRequestSchema = z.object({
  confirm: z.literal(true),
  purgeExpiredSessions: z.boolean().default(true),
  purgeExpiredTokens: z.boolean().default(true),
  archiveOperationalLogsOlderThanDays: z.number().min(30).optional(),
});

export type ExecuteStorageMaintenanceRequest = z.infer<
  typeof ExecuteStorageMaintenanceRequestSchema
>;

// ==========================================
// Platform User & Super Admin Invitations
// ==========================================

export const InvitePlatformSuperAdminRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  permissions: z.array(z.string()).optional(),
});

export type InvitePlatformSuperAdminRequest = z.infer<typeof InvitePlatformSuperAdminRequestSchema>;

export const PlatformInviteUserRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  phone: z.string().max(30).optional(),
  role: z.enum([
    'SUPER_ADMIN',
    'OWNER',
    'MANAGER',
    'BRANCH_MANAGER',
    'COACH',
    'RECEPTIONIST',
    'ACCOUNTANT',
    'PLAYER',
    'GUARDIAN',
  ]),
  tenantId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
});

export type PlatformInviteUserRequest = z.infer<typeof PlatformInviteUserRequestSchema>;
