import { describe, expect, it, vi } from 'vitest';
import { assertRuntimeDatabaseRole } from './runtime-role-guard';

const client = (row: Record<string, unknown> | undefined) => ({
  $queryRaw: vi.fn().mockResolvedValue(row ? [row] : []),
});
const logger = () => ({ warn: vi.fn(), log: vi.fn() });
const restricted = {
  role: 'sportexus_app',
  superuser: false,
  bypass_rls: false,
  owns_tables: false,
};

describe('assertRuntimeDatabaseRole (S3 startup guard)', () => {
  it('accepts a restricted runtime role in production', async () => {
    const log = logger();
    await expect(
      assertRuntimeDatabaseRole(client(restricted), 'production', log),
    ).resolves.toMatchObject({
      role: 'sportexus_app',
    });
    expect(log.warn).not.toHaveBeenCalled();
  });

  it.each([
    [
      { ...restricted, role: 'neondb_owner', bypass_rls: true, owns_tables: true },
      /BYPASSRLS, owns application tables/,
    ],
    [{ ...restricted, role: 'postgres', superuser: true }, /is a superuser/],
    [{ ...restricted, role: 'owner', owns_tables: true }, /owns application tables/],
  ])('refuses to start in production with an RLS-bypassing role (%o)', async (row, pattern) => {
    await expect(assertRuntimeDatabaseRole(client(row), 'production', logger())).rejects.toThrow(
      pattern,
    );
  });

  it('only warns outside production', async () => {
    const log = logger();
    await assertRuntimeDatabaseRole(
      client({ ...restricted, bypass_rls: true }),
      'development',
      log,
    );
    expect(log.warn).toHaveBeenCalledWith(expect.stringMatching(/allowed outside production/));
  });

  it('fails when the role cannot be determined', async () => {
    await expect(
      assertRuntimeDatabaseRole(client(undefined), 'development', logger()),
    ).rejects.toThrow(/Cannot determine/);
  });
});
