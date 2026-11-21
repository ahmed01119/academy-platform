import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import {
  PrismaClient,
  withTenantTransaction,
  withAuthLookupTransaction,
  withPlatformAdminTransaction,
  withPortalUserTransaction,
  withPaymentWebhookTransaction,
  type TenantTransactionOptions,
  type TenantTransactionClient,
  type AuthLookupOptions,
  type PlatformAdminTransactionOptions,
  type PortalUserTransactionOptions,
} from '@academy/database';
import { assertRuntimeDatabaseRole } from './runtime-role-guard';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
    // S3: refuse an RLS-bypassing database role in production (warning elsewhere).
    await assertRuntimeDatabaseRole(this, process.env.NODE_ENV);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Runs tenant-scoped queries within an isolated transaction with app.tenant_id set.
   * Fail-closed: Throws an error if tenantId is missing or invalid.
   */
  async withTenantTransaction<T>(
    options: TenantTransactionOptions | string,
    callback: (tx: TenantTransactionClient) => Promise<T>,
  ): Promise<T> {
    return withTenantTransaction(this, options, callback);
  }

  /**
   * Runs discovery or invitation lookup queries within a controlled auth context.
   */
  async withAuthLookupTransaction<T>(
    options: AuthLookupOptions,
    callback: (tx: TenantTransactionClient) => Promise<T>,
  ): Promise<T> {
    return withAuthLookupTransaction(this, options, callback);
  }

  /**
   * Runs platform management queries under Platform Super Admin context.
   */
  async withPlatformAdminTransaction<T>(
    options: PlatformAdminTransactionOptions,
    callback: (tx: TenantTransactionClient) => Promise<T>,
  ): Promise<T> {
    return withPlatformAdminTransaction(this, options, callback);
  }

  /**
   * Runs the payment provider's webhook lookup (signature already verified). See withPaymentWebhookTransaction.
   */
  async withPaymentWebhookTransaction<T>(
    callback: (tx: TenantTransactionClient) => Promise<T>,
  ): Promise<T> {
    return withPaymentWebhookTransaction(this, callback);
  }

  /**
   * Runs player/guardian self-service queries with user identity bound for RLS.
   */
  async withPortalUserTransaction<T>(
    options: PortalUserTransactionOptions,
    callback: (tx: TenantTransactionClient) => Promise<T>,
  ): Promise<T> {
    return withPortalUserTransaction(this, options, callback);
  }
}
