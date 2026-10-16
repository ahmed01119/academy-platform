import type { PrismaClient, Prisma } from '@prisma/client';

export interface TenantTransactionOptions {
  tenantId: string;
  actorUserId?: string;
}

export type TenantTransactionClient = Prisma.TransactionClient;

/**
 * Executes a callback within an isolated PostgreSQL transaction where the session
 * variable `app.current_tenant_id` is set locally for the transaction (`is_local = true`).
 *
 * Requirements:
 * - Fail closed if tenantId is missing or empty string.
 * - Sets `app.current_tenant_id` in PostgreSQL for transaction-level RLS.
 * - Sets `app.current_actor_user_id` if provided for audit/policy context.
 * - All queries inside the callback execute on the isolated transaction client `tx`.
 */
export async function withTenantTransaction<T>(
  prisma: PrismaClient,
  options: TenantTransactionOptions,
  callback: (tx: TenantTransactionClient) => Promise<T>,
): Promise<T> {
  const { tenantId, actorUserId } = options;

  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('Tenant context is required for tenant-scoped operations (INV-T2 fail-closed)');
  }

  return prisma.$transaction(async (tx) => {
    // Set transaction-local session variables for PostgreSQL RLS
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId.trim()}, true)`;
    if (actorUserId && typeof actorUserId === 'string' && actorUserId.trim() !== '') {
      await tx.$executeRaw`SELECT set_config('app.current_actor_user_id', ${actorUserId.trim()}, true)`;
    }

    return callback(tx);
  });
}
