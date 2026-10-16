import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Execute tenant-owned queries in one database transaction.
 *
 * The tenant ID MUST come from a verified server-side authorization decision,
 * never directly from a request header, body, or query parameter.
 *
 * Transaction-local PostgreSQL settings prevent tenant context from leaking
 * between requests on pooled connections.
 */
export async function withTenantTransaction<T>(
  client: PrismaClient,
  authorizedTenantId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const uuidPattern = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
  if (!uuidPattern.test(authorizedTenantId)) {
    throw new Error('A valid authorized tenant ID is required');
  }

  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${authorizedTenantId}, true)`;
    return operation(tx);
  });
}
