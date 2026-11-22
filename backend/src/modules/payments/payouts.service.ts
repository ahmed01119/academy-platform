import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCode,
  type AcademyOnlineCollectionsSummary,
  type AcademyPayoutBalanceItem,
  type AcademyPayoutItem,
  type CreateAcademyPayoutRequest,
  type TenantContext,
} from '@academy/shared';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { money } from '../../common/money';

type PayoutRow = {
  id: string;
  tenantId: string;
  amount: unknown;
  currency: string;
  reference: string | null;
  notes: string | null;
  paidAt: Date;
  createdAt: Date;
  tenant: { name: string };
  recordedBy: { name: string | null } | null;
};

function toPayoutItem(p: PayoutRow): AcademyPayoutItem {
  return {
    id: p.id,
    tenantId: p.tenantId,
    academyName: p.tenant.name,
    amount: money(p.amount as number),
    currency: p.currency,
    reference: p.reference,
    notes: p.notes,
    paidAt: p.paidAt.toISOString(),
    recordedByName: p.recordedBy?.name ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

const PAYOUT_INCLUDE = {
  tenant: { select: { name: true } },
  recordedBy: { select: { name: true } },
} as const;

/** Families' online payments of academy subscriptions are collected in the platform's account. */
const COLLECTED = { purpose: 'PLAYER_SUBSCRIPTION', status: 'PAID' } as const;

/**
 * The platform owes each academy what its families paid online, minus what the platform already transferred. Platform
 * staff see the balances and the transfers; only the platform owner records a transfer (API guard), and the database
 * lets only platform staff insert one (RLS).
 */
@Injectable()
export class PayoutsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listBalances(actorUserId: string): Promise<AcademyPayoutBalanceItem[]> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const [collected, paidOut] = await Promise.all([
        tx.onlinePayment.groupBy({
          by: ['tenantId', 'currency'],
          where: COLLECTED,
          _sum: { amount: true },
          _count: { _all: true },
          _max: { paidAt: true },
        }),
        tx.academyPayout.groupBy({
          by: ['tenantId', 'currency'],
          _sum: { amount: true },
          _max: { paidAt: true },
        }),
      ]);
      const key = (tenantId: string, currency: string) => `${tenantId}|${currency.toUpperCase()}`;
      const rows = new Map<string, AcademyPayoutBalanceItem>();
      const row = (tenantId: string, currency: string) => {
        const k = key(tenantId, currency);
        let r = rows.get(k);
        if (!r) {
          r = {
            tenantId,
            academyName: '',
            currency: currency.toUpperCase(),
            collectedOnline: 0,
            paymentsCount: 0,
            paidOut: 0,
            balance: 0,
            lastPaymentAt: null,
            lastPayoutAt: null,
          };
          rows.set(k, r);
        }
        return r;
      };
      for (const c of collected) {
        const r = row(c.tenantId, c.currency);
        r.collectedOnline = money(c._sum.amount ?? 0);
        r.paymentsCount = c._count._all;
        r.lastPaymentAt = c._max.paidAt?.toISOString() ?? null;
      }
      for (const p of paidOut) {
        const r = row(p.tenantId, p.currency);
        r.paidOut = money(p._sum.amount ?? 0);
        r.lastPayoutAt = p._max.paidAt?.toISOString() ?? null;
      }
      const tenantIds = [...new Set([...rows.values()].map((r) => r.tenantId))];
      const tenants = tenantIds.length
        ? await tx.tenant.findMany({
            where: { id: { in: tenantIds } },
            select: { id: true, name: true },
          })
        : [];
      const names = new Map(tenants.map((t) => [t.id, t.name]));
      return [...rows.values()]
        .map((r) => ({
          ...r,
          academyName: names.get(r.tenantId) ?? '',
          balance: money(r.collectedOnline - r.paidOut),
        }))
        .sort((a, b) => b.balance - a.balance || a.academyName.localeCompare(b.academyName));
    });
  }

  async listPayouts(actorUserId: string, tenantId?: string): Promise<AcademyPayoutItem[]> {
    return this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const payouts = await tx.academyPayout.findMany({
        where: tenantId ? { tenantId } : {},
        include: PAYOUT_INCLUDE,
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      });
      return payouts.map(toPayoutItem);
    });
  }

  /** Records a transfer to an academy; it may not exceed what the platform still owes the academy. */
  async recordPayout(
    actorUserId: string,
    dto: CreateAcademyPayoutRequest,
  ): Promise<AcademyPayoutItem> {
    const item = await this.prisma.withPlatformAdminTransaction({ actorUserId }, async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: dto.tenantId },
        select: { id: true, currency: true },
      });
      if (!tenant) {
        throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Academy not found' });
      }
      const currency = tenant.currency.toUpperCase();
      // One transfer at a time per academy, so two simultaneous entries cannot both pass the balance check.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payout:${tenant.id}`}))`;
      const [collected, paid] = await Promise.all([
        tx.onlinePayment.aggregate({
          where: { ...COLLECTED, tenantId: tenant.id, currency },
          _sum: { amount: true },
        }),
        tx.academyPayout.aggregate({
          where: { tenantId: tenant.id, currency },
          _sum: { amount: true },
        }),
      ]);
      const balance = money(money(collected._sum.amount ?? 0) - money(paid._sum.amount ?? 0));
      if (dto.amount > balance) {
        throw new BadRequestException({
          code: 'PAYOUT_EXCEEDS_BALANCE',
          message: `المبلغ أكبر من المستحق للأكاديمية (${balance} ${currency}) (The amount exceeds what the academy is owed)`,
        });
      }
      const created = await tx.academyPayout.create({
        data: {
          tenantId: tenant.id,
          amount: dto.amount,
          currency,
          reference: dto.reference || null,
          notes: dto.notes || null,
          paidAt: dto.paidAt ? new Date(`${dto.paidAt}T12:00:00Z`) : new Date(),
          recordedByUserId: actorUserId,
        },
        include: PAYOUT_INCLUDE,
      });
      return toPayoutItem(created);
    });
    await this.audit
      .logEvent({
        tenantId: item.tenantId,
        actorUserId,
        action: 'ACADEMY_PAYOUT_RECORDED',
        resourceType: 'AcademyPayout',
        resourceId: item.id,
        metadata: { amount: item.amount, currency: item.currency, reference: item.reference },
      })
      .catch(() => undefined);
    return item;
  }

  /** The academy's own view: what its families paid online and what it received from the platform. */
  async academySummary(tenantContext: TenantContext): Promise<AcademyOnlineCollectionsSummary> {
    return this.prisma.withTenantTransaction(
      { tenantId: tenantContext.tenantId, actorUserId: tenantContext.actorUserId },
      async (tx) => {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantContext.tenantId },
          select: { currency: true },
        });
        const currency = (tenant?.currency ?? 'EGP').toUpperCase();
        const [collected, paid, payouts] = await Promise.all([
          tx.onlinePayment.aggregate({
            where: { ...COLLECTED, tenantId: tenantContext.tenantId, currency },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          tx.academyPayout.aggregate({
            where: { tenantId: tenantContext.tenantId, currency },
            _sum: { amount: true },
          }),
          tx.academyPayout.findMany({
            where: { tenantId: tenantContext.tenantId },
            include: PAYOUT_INCLUDE,
            orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
            take: 50,
          }),
        ]);
        const collectedOnline = money(collected._sum.amount ?? 0);
        const paidOut = money(paid._sum.amount ?? 0);
        return {
          currency,
          collectedOnline,
          paymentsCount: collected._count._all,
          paidOut,
          balance: money(collectedOnline - paidOut),
          payouts: payouts.map(toPayoutItem),
        };
      },
    );
  }
}
