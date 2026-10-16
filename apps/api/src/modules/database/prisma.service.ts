import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import {
  PrismaClient,
  withTenantTransaction,
  type TenantTransactionOptions,
  type TenantTransactionClient,
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
   * Runs tenant-scoped queries within an isolated transaction with app.current_tenant_id set.
   * Fail-closed: Throws an error if tenantId is missing.
   */
  async withTenantTransaction<T>(
    options: TenantTransactionOptions,
    callback: (tx: TenantTransactionClient) => Promise<T>,
  ): Promise<T> {
    return withTenantTransaction(this, options, callback);
  }
}
