import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation';

const productionConfig = {
  NODE_ENV: 'production',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a-production-only-secret-with-sufficient-entropy',
  CORS_ORIGIN: 'https://academy.example.com',
  COOKIE_SECURE: true,
  // Synthetic test value (not a real secret).
  INTERNAL_PROXY_SECRET: 'test-only-proxy-secret-0123456789abcdef',
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

  it('rejects insecure production cookies', () => {
    expect(() => validateEnv({ ...productionConfig, COOKIE_SECURE: false })).toThrow(
      'COOKIE_SECURE must be enabled',
    );
  });

  it('parses the string false as false instead of truthy', () => {
    expect(validateEnv({ NODE_ENV: 'development', COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(
      false,
    );
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

describe('trusted web proxy configuration (S1)', () => {
  const validRuntime = {
    ...productionConfig,
    DATABASE_URL: 'postgresql://academy_runtime:example@localhost:5432/academy',
  };

  it('requires INTERNAL_PROXY_SECRET in production (staging also runs NODE_ENV=production)', () => {
    const { INTERNAL_PROXY_SECRET: _omit, ...withoutSecret } = validRuntime;
    expect(() => validateEnv(withoutSecret)).toThrow('INTERNAL_PROXY_SECRET');
  });

  it('rejects a short or blank secret', () => {
    expect(() => validateEnv({ ...validRuntime, INTERNAL_PROXY_SECRET: 'too-short' })).toThrow(
      'at least 32 characters',
    );
    expect(() => validateEnv({ ...validRuntime, INTERNAL_PROXY_SECRET: ' '.repeat(40) })).toThrow(
      'INTERNAL_PROXY_SECRET',
    );
  });

  it('accepts TRUST_PROXY_HOPS 0-3 and rejects anything else', () => {
    expect(validateEnv({ NODE_ENV: 'development' }).TRUST_PROXY_HOPS).toBe(0);
    expect(validateEnv({ NODE_ENV: 'development', TRUST_PROXY_HOPS: '2' }).TRUST_PROXY_HOPS).toBe(
      2,
    );
    for (const bad of ['-1', '4', '1.5', 'abc']) {
      expect(() => validateEnv({ NODE_ENV: 'development', TRUST_PROXY_HOPS: bad })).toThrow();
    }
  });

  it('does not require the secret in development', () => {
    expect(validateEnv({ NODE_ENV: 'development' }).INTERNAL_PROXY_SECRET).toBeUndefined();
  });

  it('keeps the forgot-password debug code off unless explicitly enabled', () => {
    expect(validateEnv({ NODE_ENV: 'development' }).AUTH_EXPOSE_DEBUG_OTP).toBe(false);
    expect(
      validateEnv({ NODE_ENV: 'development', AUTH_EXPOSE_DEBUG_OTP: 'false' })
        .AUTH_EXPOSE_DEBUG_OTP,
    ).toBe(false);
    expect(
      validateEnv({ NODE_ENV: 'development', AUTH_EXPOSE_DEBUG_OTP: 'true' }).AUTH_EXPOSE_DEBUG_OTP,
    ).toBe(true);
  });
});
