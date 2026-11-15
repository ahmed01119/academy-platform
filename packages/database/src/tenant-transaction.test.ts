import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { withTenantTransaction } from './tenant-transaction';

/** Captures each tagged-template $executeRaw call as { sql, values }. */
function captureRaw(onCall?: () => void) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const fn = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ sql: strings.join('?'), values });
    onCall?.();
    return 1;
  });
  return { fn, calls };
}

/** The config keys set by a captured statement, in order. */
const configKeys = (sql: string | undefined) =>
  [...(sql ?? '').matchAll(/set_config\('([a-z_.]+)'/g)].map((m) => m[1]);

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
    const raw = captureRaw(() => events.push('context'));
    const tx = { $executeRaw: raw.fn };
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
    // Context is set in ONE round trip, before the tenant operation runs.
    expect(events).toEqual(['context', 'operation']);
    expect(raw.calls).toHaveLength(1);
    expect(configKeys(raw.calls[0]?.sql)).toEqual(['app.tenant_id', 'app.current_tenant_id']);
    // Values are bound parameters, never interpolated into the SQL text.
    expect(raw.calls[0]?.values).toEqual([tenantId, tenantId]);
    expect(raw.calls[0]?.sql).not.toContain(tenantId);
  });

  it('sets session config with actorUserId inside transaction', async () => {
    const raw = captureRaw();
    const mockTx = { $executeRaw: raw.fn };

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
    expect(raw.calls).toHaveLength(1);
    expect(configKeys(raw.calls[0]?.sql)).toEqual([
      'app.tenant_id',
      'app.current_tenant_id',
      'app.actor_user_id',
      'app.current_actor_user_id',
    ]);
    expect(raw.calls[0]?.values).toEqual([tenantId, tenantId, actorUserId, actorUserId]);
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

  it('sets auth discovery context in withAuthLookupTransaction', async () => {
    const raw = captureRaw();
    const tx = { $executeRaw: raw.fn };
    const client = {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    } as unknown as PrismaClient;

    const actorUserId = '11111111-2222-3333-4444-555555555555';
    await (
      await import('./tenant-transaction')
    ).withAuthLookupTransaction(
      client,
      { actorUserId, context: 'auth_discovery' },
      async (transaction) => {
        expect(transaction).toBe(tx);
        return 'ok';
      },
    );

    expect(raw.calls).toHaveLength(1);
    expect(configKeys(raw.calls[0]?.sql)).toEqual([
      'app.auth_context',
      'app.actor_user_id',
      'app.current_actor_user_id',
    ]);
    expect(raw.calls[0]?.values).toEqual(['auth_discovery', actorUserId, actorUserId]);
  });
});
