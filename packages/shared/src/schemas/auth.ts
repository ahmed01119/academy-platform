import { z } from 'zod';
import { TenantRoleSchema } from '../constants/roles-permissions';

export const PasswordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const EmailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .min(1, 'Email is required')
  .max(255, 'Email cannot exceed 255 characters')
  .email('Invalid email address')
  .toLowerCase();

export const RegisterRequestSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: EmailSchema,
  password: PasswordSchema,
  phone: z.string().trim().min(8).max(20).optional(),
  city: z.string().trim().max(100).optional(),
  academyName: z.string().trim().min(2, 'Academy name must be at least 2 characters').max(100),
  academySlug: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  sport: z
    .enum(['FOOTBALL', 'PADEL', 'SWIMMING', 'BASKETBALL', 'TENNIS', 'MARTIAL_ARTS', 'OTHER'])
    .default('FOOTBALL'),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const RegisterResponseSchema = z.object({
  status: z.enum(['PENDING_REVIEW', 'APPROVED']),
  message: z.string(),
  applicationId: z.string().uuid().optional(),
  academyName: z.string().optional(),
  accessToken: z.string().optional(),
  user: z.lazy(() => UserSummarySchema).optional(),
  activeTenant: z
    .lazy(() => TenantMembershipSummarySchema)
    .nullable()
    .optional(),
  memberships: z.lazy(() => z.array(TenantMembershipSummarySchema)).optional(),
});

export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
    .max(128, 'Password cannot exceed 128 characters'),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginRequest = z.input<typeof LoginRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({
  email: EmailSchema,
});

export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

/** 6-digit code typed by the user (K1): only valid together with the e-mail address it was sent to. */
export const RESET_CODE_PATTERN = /^\d{6}$/;
/** 256-bit link token from the e-mailed link, or a platform activation token: 64 hex characters. */
export const RESET_LINK_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

export const ResetPasswordRequestSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(6, 'Reset token or verification code is required')
      .max(128, 'Invalid reset token'),
    /** Required with a 6-digit code; optional with a link token. */
    email: EmailSchema.optional(),
    newPassword: PasswordSchema,
  })
  .refine((value) => !RESET_CODE_PATTERN.test(value.token) || Boolean(value.email), {
    message: 'Email address is required with the verification code',
    path: ['email'],
  });

export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const InviteStaffRequestSchema = z.object({
  email: EmailSchema,
  role: TenantRoleSchema,
  branchId: z.string().uuid().optional(),
});

export type InviteStaffRequest = z.infer<typeof InviteStaffRequestSchema>;

export const AcceptInviteRequestSchema = z.object({
  token: z.string().min(10, 'Invitation token is required'),
  name: z.string().trim().min(2).max(100).optional(),
  password: PasswordSchema.optional(),
});

export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequestSchema>;

export const SwitchTenantRequestSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
});

export type SwitchTenantRequest = z.infer<typeof SwitchTenantRequestSchema>;

export const UserSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  isEmailVerified: z.boolean(),
  isPlatformSuperAdmin: z.boolean().default(false),
  isPlatformOwner: z.boolean().default(false),
  hasPlayerProfile: z.boolean().optional(),
  hasGuardianProfile: z.boolean().optional(),
  createdAt: z.string(),
});

export type UserSummary = z.infer<typeof UserSummarySchema>;

export const TenantMembershipSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  tenantSlug: z.string(),
  /** ISO 4217 code of the academy's currency (K4); money in this academy is shown and recorded in it. */
  tenantCurrency: z.string().length(3).optional(),
  role: TenantRoleSchema,
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED']),
  branchId: z.string().uuid().nullable().optional(),
  branchName: z.string().nullable().optional(),
  canReviewApplications: z.boolean().default(false).optional(),
});

export type TenantMembershipSummary = z.infer<typeof TenantMembershipSummarySchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserSummarySchema,
  activeTenant: TenantMembershipSummarySchema.nullable(),
  memberships: z.array(TenantMembershipSummarySchema),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: PasswordSchema,
});

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const UpdateUserProfileRequestSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: z.string().trim().min(8).max(20).nullable().optional(),
});

export type UpdateUserProfileRequest = z.infer<typeof UpdateUserProfileRequestSchema>;
