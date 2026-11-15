import { Logger } from '@nestjs/common';

/** Minimal client surface the guard needs (PrismaClient satisfies it). */
export interface RoleQueryClient {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

export interface RuntimeRoleFacts {
  role: string;
  superuser: boolean;
  bypassRls: boolean;
  ownsTables: boolean;
}

/**
 * S3 startup guard. Row-level security protects tenants only when the API connects as a role that is not a
 * superuser, has no BYPASSRLS and owns no tables (a table owner bypasses non-forced RLS and can disable it).
 * The user-name check in env validation cannot detect such a role (e.g. Neon's neondb_owner), so the real
 * attributes are read from the database at boot.
 *
 * Production (which includes staging, NODE_ENV=production) refuses to start; other environments log a warning so
 * local development against an owner connection keeps working.
 */
export async function assertRuntimeDatabaseRole(
  client: RoleQueryClient,
  nodeEnv: string | undefined,
  logger: Pick<Logger, 'warn' | 'log'> = new Logger('RuntimeRoleGuard'),
): Promise<RuntimeRoleFacts> {
  const rows = await client.$queryRaw<
    Array<{ role: string; superuser: boolean; bypass_rls: boolean; owns_tables: boolean }>
  >`
    SELECT r.rolname AS role, r.rolsuper AS superuser, r.rolbypassrls AS bypass_rls,
           EXISTS (
             SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relowner = r.oid
           ) AS owns_tables
    FROM pg_roles r WHERE r.rolname = current_user`;
  const row = rows[0];
  if (!row) {
    throw new Error('Cannot determine the database role of the API connection');
  }
  const facts: RuntimeRoleFacts = {
    role: row.role,
    superuser: row.superuser,
    bypassRls: row.bypass_rls,
    ownsTables: row.owns_tables,
  };
  const problems = [
    facts.superuser && 'is a superuser',
    facts.bypassRls && 'has BYPASSRLS',
    facts.ownsTables && 'owns application tables',
  ].filter(Boolean);

  if (problems.length === 0) {
    logger.log(`Database runtime role verified: RLS is enforced for this connection.`);
    return facts;
  }
  const message =
    `The API database role ${problems.join(', ')}, so row-level security is not enforced. ` +
    'Connect as the restricted runtime role (e.g. sportexus_app / academy_runtime); keep the owner for migrations only.';
  if (nodeEnv === 'production') {
    throw new Error(message);
  }
  logger.warn(`${message} (allowed outside production)`);
  return facts;
}
