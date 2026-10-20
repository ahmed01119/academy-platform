import { z } from 'zod';

export const BranchStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type BranchStatus = (typeof BranchStatus)[keyof typeof BranchStatus];
export const BranchStatusSchema = z.nativeEnum(BranchStatus);

export const CreateBranchSchema = z.object({
  name: z.string().trim().min(2, 'Branch name must be at least 2 characters').max(100),
  code: z
    .string()
    .trim()
    .min(1, 'Branch code is required')
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, 'Branch code must be alphanumeric with dashes or underscores'),
  city: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().length(2).default('EG'),
  address: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  capacity: z.number().int().positive().max(10000).optional().nullable(),
  managerUserId: z.string().uuid().optional().nullable(),
});

export type CreateBranchRequest = z.infer<typeof CreateBranchSchema>;

export const UpdateBranchSchema = CreateBranchSchema.partial().extend({
  status: BranchStatusSchema.optional(),
});

export type UpdateBranchRequest = z.infer<typeof UpdateBranchSchema>;

export interface BranchSummary {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  status: BranchStatus;
  city?: string | null;
  country: string;
  address?: string | null;
  phone?: string | null;
  capacity?: number | null;
  managerUserId?: string | null;
  managerUser?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  } | null;
  activePlayersCount?: number;
  activeStaffCount?: number;
  createdAt: string;
  updatedAt: string;
}
