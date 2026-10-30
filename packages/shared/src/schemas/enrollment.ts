import { z } from 'zod';

export const EnrollmentStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;

export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];
export const EnrollmentStatusSchema = z.nativeEnum(EnrollmentStatus);

export const CreateEnrollmentSchema = z.object({
  playerId: z.string().uuid('Player ID is required'),
  branchId: z.string().uuid('Branch ID is required'),
  sport: z.enum(['FOOTBALL']).default('FOOTBALL'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD')
    .optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});
export type CreateEnrollmentRequest = z.infer<typeof CreateEnrollmentSchema>;

export const TransferBranchSchema = z.object({
  targetBranchId: z.string().uuid('Target branch ID is required'),
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date must be YYYY-MM-DD')
    .optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});
export type TransferBranchRequest = z.infer<typeof TransferBranchSchema>;

export const EnrollmentQuerySchema = z.object({
  playerId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  status: EnrollmentStatusSchema.optional(),
});
export type EnrollmentQuery = z.infer<typeof EnrollmentQuerySchema>;

export interface EnrollmentSummary {
  id: string;
  tenantId: string;
  playerId: string;
  branchId: string;
  sport: string;
  status: EnrollmentStatus;
  startDate: string;
  endDate?: string | null;
  notes?: string | null;
  branch: {
    id: string;
    name: string;
    code: string;
  };
  player?: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}
