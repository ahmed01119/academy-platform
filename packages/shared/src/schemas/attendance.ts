import { z } from 'zod';

export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  LATE: 'LATE',
  ABSENT: 'ABSENT',
  EXCUSED: 'EXCUSED',
  UNMARKED: 'UNMARKED',
} as const;

export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const AttendanceStatusSchema = z.nativeEnum(AttendanceStatus);

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
  idempotencyKey: z.string().min(8).max(64),
  records: z.array(
    z.object({
      playerId: z.string().uuid(),
      status: AttendanceStatusSchema,
      remarks: z.string().max(250).optional(),
      expectedVersion: z.number().int().optional(),
    }),
  ),
});

export type BulkAttendanceSubmission = z.infer<typeof BulkAttendanceSubmissionSchema>;

export const AttendanceCorrectionSchema = z.object({
  recordId: z.string().uuid(),
  newStatus: AttendanceStatusSchema,
  reason: z.string().trim().min(3, 'Correction reason is required').max(300),
  expectedVersion: z.number().int(),
});

export type AttendanceCorrection = z.infer<typeof AttendanceCorrectionSchema>;
