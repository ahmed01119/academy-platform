import { z } from 'zod';

export const AttendanceStatus = {
  UNMARKED: 'UNMARKED',
  PRESENT: 'PRESENT',
  LATE: 'LATE',
  ABSENT: 'ABSENT',
  EXCUSED: 'EXCUSED',
} as const;

export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];
export const AttendanceStatusSchema = z.enum(['UNMARKED', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED']);

export const SessionStatus = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  CLOSED: 'CLOSED',
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];
export const SessionStatusSchema = z.enum(['SCHEDULED', 'IN_PROGRESS', 'CLOSED']);

export const AttendanceEventSource = {
  MANUAL: 'MANUAL',
  QR_CHECKIN: 'QR_CHECKIN',
  BULK_MARK: 'BULK_MARK',
  SYSTEM: 'SYSTEM',
} as const;

export type AttendanceEventSource =
  (typeof AttendanceEventSource)[keyof typeof AttendanceEventSource];
export const AttendanceEventSourceSchema = z.enum(['MANUAL', 'QR_CHECKIN', 'BULK_MARK', 'SYSTEM']);

export const AttendanceMutationSchema = z.object({
  sessionId: z.string().uuid(),
  playerId: z.string().uuid(),
  status: AttendanceStatusSchema.exclude(['UNMARKED']),
  idempotencyKey: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative().optional(),
  reason: z.string().trim().min(3).max(500).optional(),
});

export type AttendanceMutation = z.infer<typeof AttendanceMutationSchema>;

export const AttendanceRosterItemSchema = z.object({
  recordId: z.string().uuid(),
  playerId: z.string().uuid(),
  playerName: z.string(),
  photoUrl: z.string().nullable().optional(),
  jerseyNumber: z.number().int().optional(),
  status: AttendanceStatusSchema.default('UNMARKED'),
  checkInTime: z.string().nullable().optional(),
  remarks: z.string().max(250).nullable().optional(),
  version: z.number().int().default(1),
  subscriptionStatus: z
    .enum(['ACTIVE', 'PARTIAL', 'OVERDUE', 'EXEMPT', 'PAUSED', 'EXPIRED'])
    .optional(),
  outstandingBalance: z.number().optional(),
  amountDue: z.number().optional(),
  nextPaymentDate: z.string().nullable().optional(),
  lastPaymentDate: z.string().nullable().optional(),
  subscriptionId: z.string().uuid().nullable().optional(),
});

export type AttendanceRosterItem = z.infer<typeof AttendanceRosterItemSchema>;

export const BulkMarkAttendanceRequestSchema = z.object({
  sessionId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  records: z.array(
    z.object({
      playerId: z.string().uuid(),
      status: AttendanceStatusSchema.exclude(['UNMARKED']),
      remarks: z.string().max(250).optional(),
      expectedVersion: z.number().int().nonnegative().optional(),
    }),
  ),
});

export type BulkMarkAttendanceRequest = z.infer<typeof BulkMarkAttendanceRequestSchema>;

export const BulkAttendanceSubmissionSchema = BulkMarkAttendanceRequestSchema;
export type BulkAttendanceSubmission = BulkMarkAttendanceRequest;

export const AttendanceCorrectionSchema = z.object({
  recordId: z.string().uuid(),
  newStatus: AttendanceStatusSchema.exclude(['UNMARKED']),
  reason: z.string().trim().min(3, 'Correction reason is required').max(500),
  expectedVersion: z.number().int().nonnegative(),
});

export type AttendanceCorrection = z.infer<typeof AttendanceCorrectionSchema>;

export const CreateAttendanceSessionSchema = z.object({
  branchId: z.string().uuid(),
  groupId: z.string().uuid().optional().nullable(),
  sport: z.enum(['FOOTBALL']).default('FOOTBALL'),
  groupName: z.string().min(2).max(100),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM format'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM format'),
  coachUserId: z.string().uuid().optional().nullable(),
});

export type CreateAttendanceSession = z.infer<typeof CreateAttendanceSessionSchema>;
export type CreateSessionRequest = CreateAttendanceSession;

export const SessionQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  coachUserId: z.string().uuid().optional(),
  status: SessionStatusSchema.optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SessionQuery = z.infer<typeof SessionQuerySchema>;

export const SessionSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  groupId: z.string().uuid().nullable().optional(),
  groupName: z.string(),
  coachUserId: z.string().uuid().nullable().optional(),
  coachName: z.string().nullable().optional(),
  sport: z.enum(['FOOTBALL']),
  sessionDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  status: SessionStatusSchema,
  totalExpected: z.number(),
  totalPresent: z.number(),
  totalLate: z.number(),
  totalAbsent: z.number(),
  totalExcused: z.number(),
  totalUnmarked: z.number(),
  hasActiveQr: z.boolean(),
  closedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const SessionDetailsSchema = SessionSummarySchema.extend({
  roster: z.array(AttendanceRosterItemSchema),
});

export type SessionDetails = z.infer<typeof SessionDetailsSchema>;

export const GenerateQrRequestSchema = z.object({
  expiresInSeconds: z.number().int().min(15).max(300).default(60),
});

export type GenerateQrRequest = z.infer<typeof GenerateQrRequestSchema>;

export const GenerateQrResponseSchema = z.object({
  sessionId: z.string().uuid(),
  token: z.string(),
  qrPayload: z.string(),
  expiresAt: z.string(),
});

export type GenerateQrResponse = z.infer<typeof GenerateQrResponseSchema>;

export const QrCheckInRequestSchema = z.object({
  token: z.string().min(10, 'Token is required'),
  playerId: z.string().uuid('Player ID is required'),
});

export type QrCheckInRequest = z.infer<typeof QrCheckInRequestSchema>;

export const AttendanceEventSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  recordId: z.string().uuid(),
  sessionId: z.string().uuid(),
  playerId: z.string().uuid(),
  playerName: z.string(),
  actorUserId: z.string().uuid().nullable().optional(),
  actorName: z.string().nullable().optional(),
  previousStatus: AttendanceStatusSchema.nullable().optional(),
  newStatus: AttendanceStatusSchema,
  source: AttendanceEventSourceSchema,
  reason: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  eventAt: z.string(),
});

export type AttendanceEventSummary = z.infer<typeof AttendanceEventSummarySchema>;

export const AttendanceReportQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  playerId: z.string().uuid().optional(),
});

export type AttendanceReportQuery = z.infer<typeof AttendanceReportQuerySchema>;

export const AttendanceReportSummarySchema = z.object({
  totalSessions: z.number(),
  totalRecords: z.number(),
  eligibleRecords: z.number().default(0),
  presentCount: z.number(),
  lateCount: z.number(),
  absentCount: z.number(),
  excusedCount: z.number(),
  unmarkedCount: z.number().default(0),
  attendanceRate: z.number(), // (present + late) / eligibleRecords (0-100)
  onTimeRate: z.number().default(0), // present / eligibleRecords (0-100)
  lateRate: z.number().default(0), // late / eligibleRecords (0-100)
  absenceRate: z.number().default(0), // (absent + excused) / eligibleRecords (0-100)
  excusedRate: z.number().default(0), // excused / eligibleRecords (0-100)
  byGroup: z.array(
    z.object({
      groupId: z.string().uuid().nullable().optional(),
      groupName: z.string(),
      totalSessions: z.number(),
      totalRecords: z.number(),
      attendanceRate: z.number(),
    }),
  ),
  byBranch: z.array(
    z.object({
      branchId: z.string().uuid(),
      branchName: z.string(),
      totalSessions: z.number(),
      totalRecords: z.number(),
      attendanceRate: z.number(),
    }),
  ),
});

export type AttendanceReportSummary = z.infer<typeof AttendanceReportSummarySchema>;

export const ScanPlayerQrRequestSchema = z.object({
  qrCardCode: z.string().trim().min(8, 'Valid QR card code is required'),
  deviceObservedTime: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export type ScanPlayerQrRequest = z.infer<typeof ScanPlayerQrRequestSchema>;

export const ScanPlayerQrResponseSchema = z.object({
  success: z.boolean(),
  alreadyCheckedIn: z.boolean(),
  status: z.enum(['PRESENT', 'LATE']),
  latenessMinutes: z.number(),
  checkInTime: z.string(),
  deviceObservedTime: z.string().nullable().optional(),
  syncStatus: z.enum(['CONFIRMED', 'PROVISIONAL']),
  message: z.string(),
  player: z.object({
    id: z.string().uuid(),
    name: z.string(),
    membershipNumber: z.string().optional(),
    photoUrl: z.string().nullable().optional(),
  }),
  session: z.object({
    id: z.string().uuid(),
    groupName: z.string(),
    branchName: z.string(),
    sessionDate: z.string(),
    startTime: z.string(),
  }),
  paymentStatus: z
    .object({
      status: z.enum(['ACTIVE', 'PARTIAL', 'OVERDUE', 'EXEMPT', 'PAUSED', 'EXPIRED']),
      outstandingBalance: z.number(),
      feeAmount: z.number(),
      dueDate: z.string().nullable().optional(),
      lastPaymentDate: z.string().nullable().optional(),
      subscriptionId: z.string().uuid().nullable().optional(),
    })
    .optional(),
});

export type ScanPlayerQrResponse = z.infer<typeof ScanPlayerQrResponseSchema>;

export const OfflineAttendanceBatchItemSchema = z.object({
  operationId: z.string().uuid(),
  qrCardCode: z.string().trim().min(8),
  deviceObservedTime: z.string(),
  reason: z.string().trim().max(250).optional(),
});

export type OfflineAttendanceBatchItem = z.infer<typeof OfflineAttendanceBatchItemSchema>;

export const OfflineAttendanceBatchSyncRequestSchema = z.object({
  sessionId: z.string().uuid(),
  items: z.array(OfflineAttendanceBatchItemSchema).min(1).max(500),
});

export type OfflineAttendanceBatchSyncRequest = z.infer<
  typeof OfflineAttendanceBatchSyncRequestSchema
>;

export const OfflineAttendanceBatchSyncResponseSchema = z.object({
  syncedCount: z.number(),
  failedCount: z.number(),
  results: z.array(
    z.object({
      operationId: z.string().uuid(),
      success: z.boolean(),
      status: z.string().optional(),
      alreadyCheckedIn: z.boolean().optional(),
      error: z.string().optional(),
      player: z
        .object({
          id: z.string(),
          name: z.string(),
        })
        .optional(),
    }),
  ),
});

export type OfflineAttendanceBatchSyncResponse = z.infer<
  typeof OfflineAttendanceBatchSyncResponseSchema
>;
