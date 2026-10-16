import type { Prisma, PrismaClient } from '@prisma/client';

export interface TenantTransactionOptions {
  tenantId: string;
  actorUserId?: string;
}

export type TenantTransactionClient = Prisma.TransactionClient;

const UUID_PATTERN = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;

/**
 * Execute tenant-owned queries in one database transaction.
 *
 * The tenant ID MUST come from a verified server-side authorization decision,
 * never directly from an untrusted request header, body, or query parameter.
 *
 * Transaction-local PostgreSQL settings prevent tenant context from leaking
 * between requests on pooled connections.
 */
export async function withTenantTransaction<T>(
  client: PrismaClient,
  tenantIdOrOptions: string | TenantTransactionOptions,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const tenantId =
    typeof tenantIdOrOptions === 'string'
      ? tenantIdOrOptions
      : tenantIdOrOptions?.tenantId;
  const actorUserId =
    typeof tenantIdOrOptions === 'object' && tenantIdOrOptions !== null
      ? tenantIdOrOptions.actorUserId
      : undefined;

  if (!tenantId || typeof tenantId !== 'string' || !UUID_PATTERN.test(tenantId.trim())) {
    throw new Error('A valid authorized tenant ID is required');
  }

  const cleanTenantId = tenantId.trim();

  return client.$transaction(async (tx) => {
    // Set PostgreSQL transaction-local session variables for RLS and audit tracking
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${cleanTenantId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${cleanTenantId}, true)`;
    if (actorUserId && typeof actorUserId === 'string' && actorUserId.trim() !== '') {
      await tx.$executeRaw`SELECT set_config('app.current_actor_user_id', ${actorUserId.trim()}, true)`;
    }

    return operation(tx);
  });
}
