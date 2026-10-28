import { PrismaClient } from '@prisma/client';

/**
 * Factory for Prisma clients. Callers must not share a global mutable client
 * across tenants without transaction-local RLS context. Prefer\n * withTenantTransaction for all tenant-owned queries and use a database\n * runtime role without BYPASSRLS or table ownership privileges.
 */
export function createPrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient({
    datasources: databaseUrl
      ? {
          db: { url: databaseUrl },
        }
      : undefined,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}
