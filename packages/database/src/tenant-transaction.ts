import type { Prisma, PrismaClient } from '@prisma/client';

export interface TransactionExecutionOptions {
  /**
   * Maximum time (in milliseconds) the transaction will wait to acquire a connection from the pool.
   * Defaults to 15000 ms (15 seconds).
   */
  maxWait?: number;
  /**
   * Maximum time (in milliseconds) the interactive transaction can run before timing out.
   * Defaults to 30000 ms (30 seconds).
   */
  timeout?: number;
}

export interface TenantTransactionOptions extends TransactionExecutionOptions {
  tenantId: string;
  actorUserId?: string;
}

export type TenantTransactionClient = Prisma.TransactionClient;

const UUID_PATTERN = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;

const DEFAULT_TRANSACTION_OPTIONS: { maxWait: number; timeout: number } = {
  maxWait: 15000, // 15 seconds to acquire a connection
  timeout: 30000, // 30 seconds execution limit for interactive transactions
};

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

  const maxWait =
    typeof tenantIdOrOptions === 'object' && tenantIdOrOptions?.maxWait
      ? tenantIdOrOptions.maxWait
      : DEFAULT_TRANSACTION_OPTIONS.maxWait;
  const timeout =
    typeof tenantIdOrOptions === 'object' && tenantIdOrOptions?.timeout
      ? tenantIdOrOptions.timeout
      : DEFAULT_TRANSACTION_OPTIONS.timeout;

  if (!tenantId || typeof tenantId !== 'string' || !UUID_PATTERN.test(tenantId.trim())) {
    throw new Error('A valid authorized tenant ID is required');
  }

  const cleanTenantId = tenantId.trim();

  return client.$transaction(
    async (tx) => {
      // Set PostgreSQL transaction-local session variables for RLS and audit tracking in a single round-trip
      if (actorUserId && typeof actorUserId === 'string' && actorUserId.trim() !== '') {
        const cleanActor = actorUserId.trim();
        await tx.$executeRaw`SELECT 
          set_config('app.tenant_id', ${cleanTenantId}, true),
          set_config('app.current_tenant_id', ${cleanTenantId}, true),
          set_config('app.actor_user_id', ${cleanActor}, true),
          set_config('app.current_actor_user_id', ${cleanActor}, true)`;
      } else {
        await tx.$executeRaw`SELECT 
          set_config('app.tenant_id', ${cleanTenantId}, true),
          set_config('app.current_tenant_id', ${cleanTenantId}, true)`;
      }

      return operation(tx);
    },
    { maxWait, timeout },
  );
}

export interface AuthLookupOptions extends TransactionExecutionOptions {
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
  const maxWait = options.maxWait ?? DEFAULT_TRANSACTION_OPTIONS.maxWait;
  const timeout = options.timeout ?? DEFAULT_TRANSACTION_OPTIONS.timeout;

  return client.$transaction(
    async (tx) => {
      if (actorUserId && UUID_PATTERN.test(actorUserId)) {
        await tx.$executeRaw`SELECT 
          set_config('app.auth_context', ${context}, true),
          set_config('app.actor_user_id', ${actorUserId}, true),
          set_config('app.current_actor_user_id', ${actorUserId}, true)`;
      } else {
        await tx.$executeRaw`SELECT set_config('app.auth_context', ${context}, true)`;
      }
      return operation(tx);
    },
    { maxWait, timeout },
  );
}

export interface PlatformAdminTransactionOptions extends TransactionExecutionOptions {
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
  const maxWait = options.maxWait ?? DEFAULT_TRANSACTION_OPTIONS.maxWait;
  const timeout = options.timeout ?? DEFAULT_TRANSACTION_OPTIONS.timeout;

  return client.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT 
        set_config('app.actor_user_id', ${actorUserId}, true),
        set_config('app.current_actor_user_id', ${actorUserId}, true)`;
      return operation(tx);
    },
    { maxWait, timeout },
  );
}

export interface PortalUserTransactionOptions extends TransactionExecutionOptions {
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
  const maxWait = options.maxWait ?? DEFAULT_TRANSACTION_OPTIONS.maxWait;
  const timeout = options.timeout ?? DEFAULT_TRANSACTION_OPTIONS.timeout;

  return client.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT 
        set_config('app.actor_user_id', ${actorUserId}, true),
        set_config('app.current_actor_user_id', ${actorUserId}, true)`;
      return operation(tx);
    },
    { maxWait, timeout },
  );
}
