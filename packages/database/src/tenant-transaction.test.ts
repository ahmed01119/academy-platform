import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { withTenantTransaction } from './tenant-transaction';

describe('withTenantTransaction', () => {
  it('rejects invalid tenant identifiers before opening a transaction', async () => {
    const transaction = vi.fn();
    const client = { $transaction: transaction } as unknown as PrismaClient;

    await expect(
      withTenantTransaction(client, 'untrusted-header-value', async () => 'unexpected'),
    ).rejects.toThrow('A valid authorized tenant ID is required');

    expect(transaction).not.toHaveBeenCalled();
  });

  it('sets transaction-local context before invoking tenant queries', async () => {
    const tenantId = '00000000-0000-4000-8000-000000000201';
    const events: string[] = [];
    const executeRaw = vi.fn(async () => {
      events.push('context');
      return 1;
    });
    const tx = { $executeRaw: executeRaw };
    const client = {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<string>) =>
        callback(tx),
      ),
    } as unknown as PrismaClient;

    const result = await withTenantTransaction(client, tenantId, async (transaction) => {
      expect(transaction).toBe(tx);
      events.push('operation');
      return 'done';
    });

    expect(result).toBe('done');
    expect(events).toEqual(['context', 'operation']);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('propagates transaction errors instead of returning partial results', async () => {
    const tenantId = '00000000-0000-4000-8000-000000000201';
    const tx = { $executeRaw: vi.fn(async () => 1) };
    const client = {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    } as unknown as PrismaClient;

    await expect(
      withTenantTransaction(client, tenantId, async () => {
        throw new Error('operation failed');
      }),
    ).rejects.toThrow('operation failed');
  });
});
