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

  it('fails closed when tenantId is missing or empty in options object', async () => {
    const mockPrisma = {} as PrismaClient;

    await expect(
      withTenantTransaction(mockPrisma, { tenantId: '' }, async () => 'ok'),
    ).rejects.toThrow('A valid authorized tenant ID is required');

    await expect(
      // @ts-expect-error testing missing tenantId
      withTenantTransaction(mockPrisma, {}, async () => 'ok'),
    ).rejects.toThrow('A valid authorized tenant ID is required');
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
    expect(events).toEqual(['context', 'context', 'operation']);
    expect(executeRaw).toHaveBeenCalledTimes(2); // app.tenant_id and app.current_tenant_id
  });

  it('sets session config with actorUserId inside transaction', async () => {
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
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(3); // app.tenant_id, app.current_tenant_id, and actorUserId
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
        throw new Error('Database connection failed midway');
      }),
    ).rejects.toThrow('Database connection failed midway');
  });
});
