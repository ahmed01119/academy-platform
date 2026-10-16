import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation';

describe('production database configuration', () => {
  it('requires a database connection in production', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(
      'DATABASE_URL is required in production',
    );
  });

  it.each(['postgres', 'academy', 'root'])('rejects privileged username %s', (username) => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: `postgresql://${username}:example@localhost:5432/academy`,
      }),
    ).toThrow('dedicated unprivileged runtime role');
  });

  it('rejects non-PostgreSQL production connections', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'production', DATABASE_URL: 'mysql://runtime@localhost/db' }),
    ).toThrow('must use PostgreSQL');
  });

  it('accepts a dedicated runtime role', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://academy_runtime:example@localhost:5432/academy',
    });
    expect(env.NODE_ENV).toBe('production');
  });

  it('keeps database optional in local development', () => {
    expect(validateEnv({ NODE_ENV: 'development' }).DATABASE_URL).toBeUndefined();
  });
});
