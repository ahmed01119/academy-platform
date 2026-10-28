import { z } from 'zod';

export const HealthCheckResultSchema = z.enum(['ok', 'down', 'skipped']);

export const HealthStatusSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  service: z.string().min(1),
  version: z.string().min(1),
  timestamp: z.string().datetime(),
  checks: z
    .object({
      postgres: HealthCheckResultSchema,
      redis: HealthCheckResultSchema,
    })
    .optional(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
