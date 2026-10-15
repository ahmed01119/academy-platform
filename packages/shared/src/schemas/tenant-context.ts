import { z } from 'zod';

/**
 * Request-scoped tenancy context.
 * Auth is not implemented yet; this schema defines the invariant shape
 * every authenticated request must eventually carry.
 */
export const TenantContextSchema = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  actorUserId: z.string().uuid(),
  locale: z.enum(['ar', 'en']).default('ar'),
});

export type TenantContext = z.infer<typeof TenantContextSchema>;
