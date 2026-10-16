import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  API_VERSION: z.string().default('0.0.0'),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  if (parsed.data.NODE_ENV === 'production') {
    if (!parsed.data.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production');
    }

    const databaseUrl = new URL(parsed.data.DATABASE_URL);
    if (!['postgresql:', 'postgres:'].includes(databaseUrl.protocol)) {
      throw new Error('Production DATABASE_URL must use PostgreSQL');
    }

    const username = decodeURIComponent(databaseUrl.username).toLowerCase();
    if (!username || ['postgres', 'academy', 'root'].includes(username)) {
      throw new Error('Production DATABASE_URL must use a dedicated unprivileged runtime role');
    }
  }

  return parsed.data;
}
