import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation';

const productionConfig = {
  NODE_ENV: 'production',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a-production-only-secret-with-sufficient-entropy',
  CORS_ORIGIN: 'https://academy.example.com',
};

describe('production database configuration', () => {
  it('requires a database connection in production', () => {
    expect(() => validateEnv(productionConfig)).toThrow('DATABASE_URL is required in production');
  });

  it.each(['postgres', 'academy', 'root'])('rejects privileged username %s', (username) => {
    expect(() =>
      validateEnv({
        ...productionConfig,
        DATABASE_URL: `postgresql://${username}:example@localhost:5432/academy`,
      }),
    ).toThrow('dedicated unprivileged runtime role');
  });

  it('rejects non-PostgreSQL production connections', () => {
    expect(() =>
      validateEnv({ ...productionConfig, DATABASE_URL: 'mysql://runtime@localhost/db' }),
    ).toThrow('must use PostgreSQL');
  });

  it('accepts a dedicated runtime role', () => {
    const env = validateEnv({
      ...productionConfig,
      DATABASE_URL: 'postgresql://academy_runtime:example@localhost:5432/academy',
    });
    expect(env.NODE_ENV).toBe('production');
  });

  it('requires shared Redis in production', () => {
    expect(() => validateEnv({ ...productionConfig, REDIS_URL: undefined })).toThrow(
      'REDIS_URL is required',
    );
  });

  it('rejects the development JWT secret in production', () => {
    expect(() =>
      validateEnv({
        ...productionConfig,
        JWT_SECRET: 'academy-platform-jwt-super-secret-key-32-chars!',
      }),
    ).toThrow('must not use the development default');
  });

  it('rejects wildcard CORS in production', () => {
    expect(() =>
      validateEnv({ ...productionConfig, CORS_ORIGIN: 'https://academy.example.com, *' }),
    ).toThrow('must not contain wildcard origins');
  });

  it('keeps database optional in local development', () => {
    expect(validateEnv({ NODE_ENV: 'development' }).DATABASE_URL).toBeUndefined();
  });
});
