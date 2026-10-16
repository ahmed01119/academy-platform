export { PrismaClient, Prisma } from '@prisma/client';
export { createPrismaClient } from './client';
export {
  withTenantTransaction,
  type TenantTransactionOptions,
  type TenantTransactionClient,
} from './tenant-transaction';
