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
    typeof tenantIdOrOptions === 'string' ? tenantIdOrOptions : tenantIdOrOptions?.tenantId;
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
      await tx.$executeRaw`SELECT set_config('app.actor_user_id', ${actorUserId.trim()}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_actor_user_id', ${actorUserId.trim()}, true)`;
    }

    return operation(tx);
  });
}

export interface AuthLookupOptions {
  actorUserId?: string;
  context?: 'auth_discovery' | 'invitation_lookup';
}

/**
 * Execute discovery and invitation lookup queries under controlled auth context.
 */
export async function withAuthLookupTransaction<T>(
  client: PrismaClient,
  options: AuthLookupOptions,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const actorUserId = options.actorUserId?.trim();
  const context = options.context ?? 'auth_discovery';

  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.auth_context', ${context}, true)`;
    if (actorUserId && UUID_PATTERN.test(actorUserId)) {
      await tx.$executeRaw`SELECT set_config('app.actor_user_id', ${actorUserId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_actor_user_id', ${actorUserId}, true)`;
    }
    return operation(tx);
  });
}

export interface PlatformAdminTransactionOptions {
  actorUserId: string;
}

/**
 * Execute platform management queries under Platform Super Admin context.
 */
export async function withPlatformAdminTransaction<T>(
  client: PrismaClient,
  options: PlatformAdminTransactionOptions,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const actorUserId = options.actorUserId?.trim();
  if (!actorUserId || !UUID_PATTERN.test(actorUserId)) {
    throw new Error('A valid actor user ID is required for platform operations');
  }

  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.actor_user_id', ${actorUserId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_actor_user_id', ${actorUserId}, true)`;
    return operation(tx);
  });
}

export interface PortalUserTransactionOptions {
  actorUserId: string;
}

/**
 * Execute player/guardian self-service queries with user identity bound for RLS.
 */
export async function withPortalUserTransaction<T>(
  client: PrismaClient,
  options: PortalUserTransactionOptions,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const actorUserId = options.actorUserId?.trim();
  if (!actorUserId || !UUID_PATTERN.test(actorUserId)) {
    throw new Error('A valid actor user ID is required for portal operations');
  }

  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.actor_user_id', ${actorUserId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_actor_user_id', ${actorUserId}, true)`;
    return operation(tx);
  });
}

