import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayoutsService } from './payouts.service';

const TENANT = '22222222-2222-4222-8222-222222222222';
const ACTOR = '99999999-9999-4999-8999-999999999999';

describe('PayoutsService', () => {
  let tx: any;
  let audit: any;
  let service: PayoutsService;

  beforeEach(() => {
    tx = {
      tenant: {
        findUnique: vi.fn().mockResolvedValue({ id: TENANT, currency: 'egp' }),
        findMany: vi.fn().mockResolvedValue([{ id: TENANT, name: 'Stars' }]),
      },
      onlinePayment: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 1950 } }),
        groupBy: vi.fn().mockResolvedValue([
          {
            tenantId: TENANT,
            currency: 'EGP',
            _sum: { amount: 1950 },
            _count: { _all: 2 },
            _max: { paidAt: new Date('2026-11-21T10:00:00Z') },
          },
        ]),
      },
      academyPayout: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 1000 } }),
        groupBy: vi
          .fn()
          .mockResolvedValue([
            { tenantId: TENANT, currency: 'EGP', _sum: { amount: 1000 }, _max: { paidAt: null } },
          ]),
        create: vi.fn().mockImplementation(({ data }: any) => ({
          id: 'po-1',
          ...data,
          createdAt: new Date('2026-11-22T10:00:00Z'),
          tenant: { name: 'Stars' },
          recordedBy: { name: 'Owner' },
        })),
      },
      $executeRaw: vi.fn().mockResolvedValue(1),
    };
    const prisma = { withPlatformAdminTransaction: vi.fn((_o: any, cb: any) => cb(tx)) };
    audit = { logEvent: vi.fn().mockResolvedValue(undefined) };
    service = new PayoutsService(prisma as any, audit);
  });

  it('owes each academy what was collected online minus what was transferred', async () => {
    const [row] = await service.listBalances(ACTOR);
    expect(row).toMatchObject({
      academyName: 'Stars',
      currency: 'EGP',
      collectedOnline: 1950,
      paymentsCount: 2,
      paidOut: 1000,
      balance: 950,
    });
    expect(tx.onlinePayment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { purpose: 'PLAYER_SUBSCRIPTION', status: 'PAID' } }),
    );
  });

  it('records a transfer within the balance, in the academy currency, and audits it', async () => {
    const item = await service.recordPayout(ACTOR, {
      tenantId: TENANT,
      amount: 950,
      reference: 'BANK-1',
      paidAt: '2026-11-22',
    });
    expect(tx.$executeRaw).toHaveBeenCalled(); // per-academy lock before the balance check
    expect(tx.academyPayout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 950, currency: 'EGP', recordedByUserId: ACTOR }),
      }),
    );
    expect(item).toMatchObject({ amount: 950, academyName: 'Stars', recordedByName: 'Owner' });
    expect(audit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACADEMY_PAYOUT_RECORDED' }),
    );
  });

  it('refuses a transfer larger than what the academy is owed', async () => {
    await expect(
      service.recordPayout(ACTOR, { tenantId: TENANT, amount: 950.01 }),
    ).rejects.toMatchObject({ response: { code: 'PAYOUT_EXCEEDS_BALANCE' } });
    expect(tx.academyPayout.create).not.toHaveBeenCalled();
  });

  it('refuses an unknown academy', async () => {
    tx.tenant.findUnique.mockResolvedValue(null);
    await expect(
      service.recordPayout(ACTOR, { tenantId: TENANT, amount: 1 }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
