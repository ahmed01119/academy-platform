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

export const AttendanceMutationSchema = z.object({
  sessionId: z.string().uuid(),
  playerId: z.string().uuid(),
  status: AttendanceStatusSchema.exclude(['UNMARKED']),
  idempotencyKey: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative().optional(),
  reason: z.string().trim().min(3).max(500).optional(),
});

export type AttendanceMutation = z.infer<typeof AttendanceMutationSchema>;

export const SessionStatus = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  CLOSED: 'CLOSED',
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const SessionStatusSchema = z.nativeEnum(SessionStatus);

export const AttendanceRosterItemSchema = z.object({
  playerId: z.string().uuid(),
  playerName: z.string(),
  jerseyNumber: z.number().int().optional(),
  status: AttendanceStatusSchema.default(AttendanceStatus.UNMARKED),
  remarks: z.string().max(250).optional(),
  version: z.number().int().default(1),
});

export type AttendanceRosterItem = z.infer<typeof AttendanceRosterItemSchema>;

export const BulkAttendanceSubmissionSchema = z.object({
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

export type BulkAttendanceSubmission = z.infer<typeof BulkAttendanceSubmissionSchema>;

export const AttendanceCorrectionSchema = z.object({
  recordId: z.string().uuid(),
  newStatus: AttendanceStatusSchema.exclude(['UNMARKED']),
  reason: z.string().trim().min(3, 'Correction reason is required').max(500),
  expectedVersion: z.number().int().nonnegative(),
});

export type AttendanceCorrection = z.infer<typeof AttendanceCorrectionSchema>;

export const CreateAttendanceSessionSchema = z.object({
  branchId: z.string().uuid(),
  sport: z.enum(['FOOTBALL']).default('FOOTBALL'),
  groupName: z.string().min(2).max(100),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM format'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM format'),
});

export type CreateAttendanceSession = z.infer<typeof CreateAttendanceSessionSchema>;
