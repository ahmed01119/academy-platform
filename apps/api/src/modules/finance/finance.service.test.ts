import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FinanceService } from './finance.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { TenantContext } from '@academy/shared';

type MockFn = ReturnType<typeof vi.fn>;

interface MockFinanceTx {
  tenant: { findUnique: MockFn };
  saaSPlan: { findFirst: MockFn };
  tenantSubscription: { create: MockFn; findUnique: MockFn };
  playerSubscriptionPlan: { findMany: MockFn; create: MockFn };
  playerSubscription: {
    findMany: MockFn;
    findFirst: MockFn;
    findUnique: MockFn;
    create: MockFn;
    update: MockFn;
  };
  player: { findUnique: MockFn };
  academyFinancialTransaction: {
    create: MockFn;
    findMany: MockFn;
    findUnique: MockFn;
    update: MockFn;
  };
  attendanceSession: { findUnique: MockFn };
  sessionCashierClosing: { upsert: MockFn };
}

describe('FinanceService', () => {
  let service: FinanceService;
  let mockTx: MockFinanceTx;
  let mockPrisma: { withTenantTransaction: MockFn };
  let mockAudit: { logEvent: MockFn };

  const tenantContext: TenantContext = {
    tenantId: '00000000-0000-4000-8000-000000000101',
    actorUserId: '00000000-0000-4000-8000-000000000001',
    role: 'OWNER',
  };

  const playerId = '00000000-0000-4000-8000-000000000201';
  const branchId = '00000000-0000-4000-8000-000000000301';
  const sessionId = '00000000-0000-4000-8000-000000000401';
  const subId = '00000000-0000-4000-8000-000000000501';

  beforeEach(() => {
    mockTx = {
      tenant: {
        findUnique: vi.fn(),
      },
      saaSPlan: {
        findFirst: vi.fn(),
      },
      tenantSubscription: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      playerSubscriptionPlan: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
      playerSubscription: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      player: {
        findUnique: vi.fn(),
      },
      academyFinancialTransaction: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      attendanceSession: {
        findUnique: vi.fn(),
      },
      sessionCashierClosing: {
        upsert: vi.fn(),
      },
    };

    mockPrisma = {
      withTenantTransaction: vi.fn(async (_ctx, fn) => fn(mockTx)),
    };

    mockAudit = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    service = new FinanceService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('getTenantSubscription', () => {
    it('returns academy SaaS subscription plan details and limits', async () => {
      mockTx.tenant.findUnique.mockResolvedValue({
        id: tenantContext.tenantId,
        name: 'Stars Academy',
        subscription: {
          id: '00000000-0000-4000-8000-000000000999',
          tenantId: tenantContext.tenantId,
          planCode: 'PRO',
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          negotiatedPrice: null,
          currency: 'EGP',
          startDate: new Date('2026-01-01'),
          renewalDate: new Date('2026-02-01'),
          trialEndsAt: null,
          graceEndsAt: null,
          autoRenew: true,
          plan: {
            name: 'Professional Academy',
            priceMonthly: 1299,
            maxBranches: 5,
            maxPlayers: 250,
            maxCoaches: 20,
            features: { qrAttendance: true, sessionCashier: true },
          },
        },
      });

      const res = await service.getTenantSubscription(tenantContext);
      expect(res.planCode).toBe('PRO');
      expect(res.currentPrice).toBe(1299);
      expect(res.maxBranches).toBe(5);
      expect(res.features).toHaveProperty('sessionCashier', true);
    });
  });

  describe('recordPayment', () => {
    it('records financial transaction and decrements player balance atomically', async () => {
      mockTx.player.findUnique.mockResolvedValue({
        id: playerId,
        firstName: 'Omar',
        lastName: 'Al-Ghamdi',
      });

      mockTx.academyFinancialTransaction.create.mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000888',
        tenantId: tenantContext.tenantId,
        branchId,
        sessionId,
        playerId,
        subscriptionId: subId,
        recordedByUserId: tenantContext.actorUserId,
        type: 'MEMBERSHIP_FEE',
        amount: 350,
        currency: 'SAR',
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        receiptNumber: 'REC-2026-1234',
        referenceNumber: 'REF-CSH',
        notes: 'Monthly installment',
        createdAt: new Date(),
        branch: { name: 'Main Branch' },
        player: { firstName: 'Omar', lastName: 'Al-Ghamdi' },
        recordedByUser: { name: 'Coach Ahmed' },
      });

      mockTx.playerSubscription.findUnique.mockResolvedValue({
        id: subId,
        paidAmount: 300,
        outstandingBalance: 350,
      });

      const res = await service.recordPayment(tenantContext, {
        playerId,
        subscriptionId: subId,
        branchId,
        sessionId,
        amount: 350,
        paymentMethod: 'CASH',
        notes: 'Monthly installment',
      });

      expect(res.amount).toBe(350);
      expect(res.paymentMethod).toBe('CASH');
      expect(mockTx.playerSubscription.update).toHaveBeenCalledWith({
        where: { id: subId },
        data: expect.objectContaining({
          paidAmount: 650,
          outstandingBalance: 0,
          status: 'ACTIVE',
        }),
      });
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FINANCIAL_PAYMENT_COLLECTED',
        }),
      );
    });
  });

  describe('reverseTransaction', () => {
    it('marks transaction REVERSED and restores player balance with reason', async () => {
      mockTx.academyFinancialTransaction.findUnique.mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000888',
        tenantId: tenantContext.tenantId,
        branchId,
        sessionId,
        playerId,
        subscriptionId: subId,
        recordedByUserId: tenantContext.actorUserId,
        type: 'MEMBERSHIP_FEE',
        amount: 350,
        currency: 'SAR',
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        receiptNumber: 'REC-2026-1234',
        notes: 'Mistaken duplicate entry',
        branch: { name: 'Main Branch' },
        player: { firstName: 'Omar', lastName: 'Al-Ghamdi' },
        recordedByUser: { name: 'Coach Ahmed' },
      });

      mockTx.academyFinancialTransaction.update.mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000888',
        tenantId: tenantContext.tenantId,
        branchId,
        sessionId,
        playerId,
        subscriptionId: subId,
        recordedByUserId: tenantContext.actorUserId,
        type: 'MEMBERSHIP_FEE',
        amount: 350,
        currency: 'SAR',
        paymentMethod: 'CASH',
        status: 'REVERSED',
        receiptNumber: 'REC-2026-1234',
        referenceNumber: null,
        notes: 'Mistaken duplicate entry',
        reversalReason: 'Wrong receipt issued by cashier',
        reversedAt: new Date(),
        createdAt: new Date(),
        branch: { name: 'Main Branch' },
        player: { firstName: 'Omar', lastName: 'Al-Ghamdi' },
        recordedByUser: { name: 'Coach Ahmed' },
      });

      mockTx.playerSubscription.findUnique.mockResolvedValue({
        id: subId,
        paidAmount: 650,
        outstandingBalance: 0,
      });

      const res = await service.reverseTransaction(
        tenantContext,
        '00000000-0000-4000-8000-000000000888',
        { reason: 'Wrong receipt issued by cashier' },
      );

      expect(res.status).toBe('REVERSED');
      expect(mockTx.playerSubscription.update).toHaveBeenCalledWith({
        where: { id: subId },
        data: expect.objectContaining({
          paidAmount: 300,
          outstandingBalance: 350,
          status: 'PARTIAL',
        }),
      });
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FINANCIAL_TRANSACTION_REVERSED',
        }),
      );
    });
  });

  describe('getSessionCashierSummary', () => {
    it('summarizes cash vs electronic collections, expenses, and net movement', async () => {
      mockTx.attendanceSession.findUnique.mockResolvedValue({
        id: sessionId,
        tenantId: tenantContext.tenantId,
        branchId,
        groupName: 'U-11 Squad',
        sessionDate: new Date('2026-10-23'),
        startTime: '16:00',
        endTime: '17:30',
        status: 'CLOSED',
        branch: { name: 'Main Branch' },
        records: [
          { playerId: 'p1', status: 'PRESENT' },
          { playerId: 'p2', status: 'LATE' },
          { playerId: 'p3', status: 'ABSENT' },
        ],
        cashierClosing: null,
      });

      mockTx.academyFinancialTransaction.findMany.mockResolvedValue([
        {
          id: 'tx1',
          tenantId: tenantContext.tenantId,
          branchId,
          sessionId,
          type: 'MEMBERSHIP_FEE',
          amount: 500,
          currency: 'SAR',
          paymentMethod: 'CASH',
          status: 'COMPLETED',
          receiptNumber: 'REC-1',
          createdAt: new Date(),
          branch: { name: 'Main Branch' },
          player: { firstName: 'Omar', lastName: 'Al-Ghamdi' },
          recordedByUser: { name: 'Coach Ahmed' },
        },
        {
          id: 'tx2',
          tenantId: tenantContext.tenantId,
          branchId,
          sessionId,
          type: 'MEMBERSHIP_FEE',
          amount: 300,
          currency: 'SAR',
          paymentMethod: 'CARD',
          status: 'COMPLETED',
          receiptNumber: 'REC-2',
          createdAt: new Date(),
          branch: { name: 'Main Branch' },
          player: { firstName: 'Saud', lastName: 'Al-Shehri' },
          recordedByUser: { name: 'Coach Ahmed' },
        },
        {
          id: 'tx3',
          tenantId: tenantContext.tenantId,
          branchId,
          sessionId,
          type: 'SESSION_EXPENSE',
          amount: 100,
          currency: 'SAR',
          paymentMethod: 'CASH',
          status: 'COMPLETED',
          receiptNumber: 'EXP-1',
          createdAt: new Date(),
          branch: { name: 'Main Branch' },
          player: null,
          recordedByUser: { name: 'Coach Ahmed' },
        },
      ]);

      const summary = await service.getSessionCashierSummary(tenantContext, sessionId);

      expect(summary.totalAttendees).toBe(2);
      expect(summary.totalAbsent).toBe(1);
      expect(summary.totalCashCollected).toBe(500);
      expect(summary.totalElectronicCollected).toBe(300);
      expect(summary.totalExpenses).toBe(100);
      expect(summary.netCashMovement).toBe(400); // 500 cash - 100 cash expense
    });
  });
});
