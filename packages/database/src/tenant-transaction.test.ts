import { describe, expect, it, vi } from 'vitest';
import { withTenantTransaction } from './tenant-transaction';
import type { PrismaClient } from '@prisma/client';

describe('withTenantTransaction', () => {
  it('fails closed when tenantId is missing or empty', async () => {
    const mockPrisma = {} as PrismaClient;

    await expect(
      withTenantTransaction(mockPrisma, { tenantId: '' }, async () => 'ok'),
    ).rejects.toThrow('Tenant context is required');

    await expect(
      // @ts-expect-error testing missing tenantId
      withTenantTransaction(mockPrisma, {}, async () => 'ok'),
    ).rejects.toThrow('Tenant context is required');
  });

  it('sets session config inside transaction and returns callback result', async () => {
    const executedRawQueries: unknown[] = [];
    const mockTx = {
      $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        executedRawQueries.push({ strings, values });
        return 1;
      }),
    };

    const mockPrisma = {
      $transaction: vi.fn(async (callback: (tx: typeof mockTx) => Promise<unknown>) => {
        return callback(mockTx);
      }),
    } as unknown as PrismaClient;

    const tenantId = '11111111-2222-3333-4444-555555555555';
    const actorUserId = '99999999-8888-7777-6666-555555555555';

    const result = await withTenantTransaction(
      mockPrisma,
      { tenantId, actorUserId },
      async (tx) => {
        expect(tx).toBe(mockTx);
        return { success: true };
      },
    );

    expect(result).toEqual({ success: true });
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(2);
  });
});
