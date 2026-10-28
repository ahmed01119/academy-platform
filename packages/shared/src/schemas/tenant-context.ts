import { z } from 'zod';
import { TenantRoleSchema } from '../constants/roles-permissions';

/**
 * Request-scoped tenancy context.
 * Defines the invariant shape every authenticated request carries.
 */
export const TenantContextSchema = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  actorUserId: z.string().uuid(),
  locale: z.enum(['ar', 'en']).default('ar'),
  role: TenantRoleSchema.optional(),
  permissions: z.array(z.string()).optional(),
});

export type TenantContext = z.infer<typeof TenantContextSchema>;
