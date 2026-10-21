import { z } from 'zod';

export const GroupStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type GroupStatus = (typeof GroupStatus)[keyof typeof GroupStatus];
export const GroupStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);

export const GroupMemberStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

export type GroupMemberStatus = (typeof GroupMemberStatus)[keyof typeof GroupMemberStatus];
export const GroupMemberStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);

export const ScheduleStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type ScheduleStatus = (typeof ScheduleStatus)[keyof typeof ScheduleStatus];
export const ScheduleStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const CreateTrainingGroupRequestSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID'),
  sport: z.enum(['FOOTBALL']).default('FOOTBALL'),
  name: z.string().trim().min(2, 'Group name must be at least 2 characters').max(100),
  description: z.string().trim().max(500).optional().nullable(),
  ageCategory: z.string().trim().min(2).max(50).optional().nullable(),
  capacity: z.number().int().positive('Capacity must be greater than zero').optional().nullable(),
});

export type CreateTrainingGroupRequest = z.infer<typeof CreateTrainingGroupRequestSchema>;

export const UpdateTrainingGroupRequestSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  ageCategory: z.string().trim().min(2).max(50).optional().nullable(),
  capacity: z.number().int().positive('Capacity must be greater than zero').optional().nullable(),
  status: GroupStatusSchema.optional(),
});

export type UpdateTrainingGroupRequest = z.infer<typeof UpdateTrainingGroupRequestSchema>;

export const GroupQuerySchema = z.object({
  search: z.string().trim().optional(),
  branchId: z.string().uuid().optional(),
  status: GroupStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GroupQuery = z.infer<typeof GroupQuerySchema>;

export const AssignCoachRequestSchema = z.object({
  coachUserId: z.string().uuid('Invalid coach user ID'),
  isHeadCoach: z.boolean().default(false),
});

export type AssignCoachRequest = z.infer<typeof AssignCoachRequestSchema>;

export const AssignPlayerRequestSchema = z.object({
  playerId: z.string().uuid('Invalid player ID'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
});

export type AssignPlayerRequest = z.infer<typeof AssignPlayerRequestSchema>;

export const CreateScheduleRequestSchema = z.object({
  dayOfWeek: z.number().int().min(0, '0 is Sunday').max(6, '6 is Saturday'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM format'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM format'),
  location: z.string().trim().max(100).optional().nullable(),
});

export type CreateScheduleRequest = z.infer<typeof CreateScheduleRequestSchema>;

export const GroupCoachSummarySchema = z.object({
  id: z.string().uuid(),
  coachUserId: z.string().uuid(),
  coachName: z.string(),
  coachEmail: z.string().email(),
  coachPhone: z.string().nullable().optional(),
  isHeadCoach: z.boolean(),
  createdAt: z.string(),
});

export type GroupCoachSummary = z.infer<typeof GroupCoachSummarySchema>;

export const GroupMemberSummarySchema = z.object({
  id: z.string().uuid(),
  playerId: z.string().uuid(),
  playerName: z.string(),
  playerGender: z.enum(['MALE', 'FEMALE']),
  playerDateOfBirth: z.string(),
  playerPhotoUrl: z.string().nullable().optional(),
  status: GroupMemberStatusSchema,
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type GroupMemberSummary = z.infer<typeof GroupMemberSummarySchema>;

export const TrainingScheduleSummarySchema = z.object({
  id: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  location: z.string().nullable().optional(),
  status: ScheduleStatusSchema,
  createdAt: z.string(),
});

export type TrainingScheduleSummary = z.infer<typeof TrainingScheduleSummarySchema>;

export const TrainingGroupSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  branchName: z.string(),
  branchCode: z.string().nullable().optional(),
  sport: z.enum(['FOOTBALL']),
  name: z.string(),
  description: z.string().nullable().optional(),
  ageCategory: z.string().nullable().optional(),
  capacity: z.number().nullable().optional(),
  status: GroupStatusSchema,
  memberCount: z.number(),
  coachCount: z.number(),
  scheduleCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TrainingGroupSummary = z.infer<typeof TrainingGroupSummarySchema>;

export const TrainingGroupDetailsSchema = TrainingGroupSummarySchema.extend({
  coaches: z.array(GroupCoachSummarySchema),
  members: z.array(GroupMemberSummarySchema),
  schedules: z.array(TrainingScheduleSummarySchema),
});

export type TrainingGroupDetails = z.infer<typeof TrainingGroupDetailsSchema>;
