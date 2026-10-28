import { z } from 'zod';

export const PlayerGender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
} as const;
export type PlayerGender = (typeof PlayerGender)[keyof typeof PlayerGender];
export const PlayerGenderSchema = z.nativeEnum(PlayerGender);

export const PlayerStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  GRADUATED: 'GRADUATED',
} as const;
export type PlayerStatus = (typeof PlayerStatus)[keyof typeof PlayerStatus];
export const PlayerStatusSchema = z.nativeEnum(PlayerStatus);

export const GuardianRelationship = {
  FATHER: 'FATHER',
  MOTHER: 'MOTHER',
  GUARDIAN: 'GUARDIAN',
  RELATIVE: 'RELATIVE',
  OTHER: 'OTHER',
} as const;
export type GuardianRelationship = (typeof GuardianRelationship)[keyof typeof GuardianRelationship];
export const GuardianRelationshipSchema = z.nativeEnum(GuardianRelationship);

export const GuardianInputSchema = z.object({
  firstName: z.string().trim().min(2, 'First name is required').max(50),
  lastName: z.string().trim().min(2, 'Last name is required').max(50),
  relationship: GuardianRelationshipSchema.default(GuardianRelationship.FATHER),
  phone: z.string().trim().min(8, 'Valid phone number is required').max(20),
  email: z.string().trim().email('Invalid email').optional().nullable(),
  isPrimary: z.boolean().default(true),
});
export type GuardianInput = z.infer<typeof GuardianInputSchema>;

export const CreatePlayerSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().trim().min(2, 'Last name must be at least 2 characters').max(50),
  gender: PlayerGenderSchema.default(PlayerGender.MALE),
  dateOfBirth: z.string().regex(/^\d{4}(-\d{2}-\d{2})?$/, 'Date of birth must be YYYY-MM-DD or YYYY').optional(),
  birthYear: z.number().int().min(1950).max(2035).optional().nullable(),
  jerseyNumber: z.number().int().min(1).max(99).optional().nullable(),
  membershipNumber: z.string().trim().max(50).optional().nullable(),
  nationalId: z.string().trim().max(30).optional().nullable(),
  photoUrl: z.string().trim().url().optional().nullable(),
  emergencyContactName: z.string().trim().min(2, 'Emergency contact name is required').max(100),
  emergencyContactPhone: z.string().trim().min(8, 'Emergency contact phone is required').max(20),
  medicalNotes: z.string().trim().max(500).optional().nullable(),
  primaryGuardian: GuardianInputSchema,
  initialBranchId: z.string().uuid('Initial branch ID is required'),
  sport: z.enum(['FOOTBALL']).default('FOOTBALL'),
});
export type CreatePlayerRequest = z.infer<typeof CreatePlayerSchema>;

export const UpdatePlayerSchema = z.object({
  firstName: z.string().trim().min(2).max(50).optional(),
  lastName: z.string().trim().min(2).max(50).optional(),
  gender: PlayerGenderSchema.optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}(-\d{2}-\d{2})?$/)
    .optional(),
  birthYear: z.number().int().min(1950).max(2035).optional().nullable(),
  jerseyNumber: z.number().int().min(1).max(99).optional().nullable(),
  membershipNumber: z.string().trim().max(50).optional().nullable(),
  nationalId: z.string().trim().max(30).optional().nullable(),
  photoUrl: z.string().trim().url().optional().nullable(),
  emergencyContactName: z.string().trim().min(2).max(100).optional(),
  emergencyContactPhone: z.string().trim().min(8).max(20).optional(),
  medicalNotes: z.string().trim().max(500).optional().nullable(),
  status: PlayerStatusSchema.optional(),
});
export type UpdatePlayerRequest = z.infer<typeof UpdatePlayerSchema>;

export const PlayerQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  branchId: z.string().uuid().optional(),
  status: PlayerStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PlayerQuery = z.infer<typeof PlayerQuerySchema>;

export const UuidParamSchema = z.string().uuid('Invalid UUID parameter');

export interface GuardianSummary {
  id: string;
  firstName: string;
  lastName: string;
  relationship: GuardianRelationship;
  phone: string;
  email?: string | null;
  isPrimary: boolean;
}

export interface PlayerSummary {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  gender: PlayerGender;
  dateOfBirth: string;
  nationalId?: string | null;
  photoUrl?: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  status: PlayerStatus;
  currentBranch?: {
    id: string;
    name: string;
    code: string;
  } | null;
  primaryGuardian?: GuardianSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerDetails extends PlayerSummary {
  medicalNotes?: string | null;
  guardians: GuardianSummary[];
  enrollments: Array<{
    id: string;
    branchId: string;
    branch: {
      id: string;
      name: string;
      code: string;
    };
    sport: string;
    status: string;
    startDate: string;
    endDate?: string | null;
    notes?: string | null;
    createdAt: string;
  }>;
}

export const PlayerQrCardResponseSchema = z.object({
  playerId: z.string().uuid(),
  playerName: z.string(),
  academyName: z.string(),
  membershipNumber: z.string(),
  photoUrl: z.string().nullable().optional(),
  qrCardCode: z.string(),
  issuedAt: z.string(),
  isRevoked: z.boolean(),
  revokedAt: z.string().nullable().optional(),
});

export type PlayerQrCardResponse = z.infer<typeof PlayerQrCardResponseSchema>;

export const RotatePlayerQrCardRequestSchema = z.object({
  reason: z.string().trim().min(3).max(200).optional(),
});

export type RotatePlayerQrCardRequest = z.infer<typeof RotatePlayerQrCardRequestSchema>;

export const RevokePlayerQrCardRequestSchema = z.object({
  reason: z.string().trim().min(3, 'Revocation reason is required').max(200),
});

export type RevokePlayerQrCardRequest = z.infer<typeof RevokePlayerQrCardRequestSchema>;

export interface PlayerDeletionImpact {
  playerId: string;
  playerName: string;
  activeEnrollments: number;
  activeGroupMemberships: number;
  attendanceRecordsCount: number;
  evaluationsCount: number;
  activeSubscriptionsCount: number;
  financialTransactionsCount: number;
  canSafelyArchive: boolean;
  warnings: string[];
}

export interface PlayerDeletionResponse {
  success: boolean;
  message: string;
  playerId: string;
}

