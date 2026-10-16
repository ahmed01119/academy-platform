import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import {
  PrismaClient,
  withTenantTransaction,
  withAuthLookupTransaction,
  type TenantTransactionOptions,
  type TenantTransactionClient,
  type AuthLookupOptions,
} from '@academy/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
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
}
