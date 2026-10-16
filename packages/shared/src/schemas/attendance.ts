import { z } from 'zod';

export const AttendanceStatusSchema = z.enum([
  'UNMARKED',
  'PRESENT',
  'LATE',
  'ABSENT',
  'EXCUSED',
]);

export const AttendanceMutationSchema = z.object({
  sessionId: z.string().uuid(),
  playerId: z.string().uuid(),
  status: AttendanceStatusSchema.exclude(['UNMARKED']),
  idempotencyKey: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative().optional(),
  reason: z.string().trim().min(3).max(500).optional(),
});

export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>;
export type AttendanceMutation = z.infer<typeof AttendanceMutationSchema>;
