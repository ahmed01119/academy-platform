import { z } from 'zod';
import { TenantRoleSchema } from '../constants/roles-permissions';

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const EmailSchema = z.string().trim().email('Invalid email address').toLowerCase();

export const RegisterRequestSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: EmailSchema,
  password: PasswordSchema,
  phone: z.string().trim().min(8).max(20).optional(),
  academyName: z.string().trim().min(2, 'Academy name must be at least 2 characters').max(100),
  academySlug: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  sport: z.enum(['FOOTBALL']).default('FOOTBALL'),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({
  email: EmailSchema,
});

export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(10, 'Reset token is required'),
  newPassword: PasswordSchema,
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
  createdAt: z.string(),
});

export type UserSummary = z.infer<typeof UserSummarySchema>;

export const TenantMembershipSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  tenantSlug: z.string(),
  role: TenantRoleSchema,
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED']),
  branchId: z.string().uuid().nullable().optional(),
  branchName: z.string().nullable().optional(),
});

export type TenantMembershipSummary = z.infer<typeof TenantMembershipSummarySchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserSummarySchema,
  activeTenant: TenantMembershipSummarySchema.nullable(),
  memberships: z.array(TenantMembershipSummarySchema),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
