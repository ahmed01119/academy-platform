import { PrismaClient } from '@prisma/client';

/**
 * Factory for Prisma clients. Callers must not share a global mutable client
 * across tenants without request-scoped filtering.
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
