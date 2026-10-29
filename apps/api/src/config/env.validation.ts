import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  API_VERSION: z.string().default('0.0.0'),
  DATABASE_URL: z.string().url().optional(),
  DATABASE_ADMIN_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  ALLOW_IN_MEMORY_RATE_LIMIT: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .default(false),
  JWT_SECRET: z.string().min(16).default('academy-platform-jwt-super-secret-key-32-chars!'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  COOKIE_SECURE: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .default(false),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv & Record<string, unknown> {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  if (parsed.data.NODE_ENV === 'production') {
    if (!parsed.data.COOKIE_SECURE) {
      throw new Error('COOKIE_SECURE must be enabled in production');
    }
    if (!parsed.data.REDIS_URL && !parsed.data.ALLOW_IN_MEMORY_RATE_LIMIT) {
      throw new Error('REDIS_URL is required in production for shared rate limiting');
    }
    if (parsed.data.JWT_SECRET === 'academy-platform-jwt-super-secret-key-32-chars!') {
      throw new Error('Production JWT_SECRET must not use the development default');
    }
    if (parsed.data.CORS_ORIGIN.split(',').some((origin) => origin.trim() === '*')) {
      throw new Error('Production CORS_ORIGIN must not contain wildcard origins');
    }
    if (!parsed.data.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production');
    }

    const databaseUrl = new URL(parsed.data.DATABASE_URL);
    if (!['postgresql:', 'postgres:'].includes(databaseUrl.protocol)) {
      throw new Error('Production DATABASE_URL must use PostgreSQL');
    }

    const username = decodeURIComponent(databaseUrl.username).toLowerCase();
    if (!username || ['postgres', 'academy', 'root'].includes(username)) {
      throw new Error(
        `Production DATABASE_URL must use a dedicated unprivileged runtime role (e.g. 'sportexus_app'). Administrative role '${username}' is not permitted.`,
      );
    }
  }

  // Merge the validated (and default-filled) known keys back into the full raw config
  // so that ALL environment variables — including email delivery vars like MAIL_PROVIDER,
  // RESEND_API_KEY, MAIL_FROM_EMAIL, etc. — remain accessible via ConfigService.get().
  return { ...config, ...parsed.data };
}
