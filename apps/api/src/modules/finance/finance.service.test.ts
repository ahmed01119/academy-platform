import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FinanceService } from './finance.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
    findFirst: MockFn;
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
        findFirst: vi.fn().mockResolvedValue(null),
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

  describe('recordSessionExpense', () => {
    const coachUserId = '00000000-0000-4000-8000-000000000002';
    const coachContext: TenantContext = {
      tenantId: tenantContext.tenantId,
      actorUserId: coachUserId,
      role: 'COACH',
    };

    it('submits valid expense by assigned coach in PENDING status for separation of duties review', async () => {
      mockTx.attendanceSession.findUnique.mockResolvedValue({
        id: sessionId,
        tenantId: tenantContext.tenantId,
        branchId,
        coachUserId,
        group: { coaches: [] },
      });

      mockTx.academyFinancialTransaction.create.mockResolvedValue({
        id: 'exp-1',
        tenantId: tenantContext.tenantId,
        branchId,
        sessionId,
        recordedByUserId: coachUserId,
        type: 'SESSION_EXPENSE',
        amount: 85.5,
        currency: 'SAR',
        paymentMethod: 'CASH',
        status: 'PENDING',
        receiptNumber: 'EXP-2026-0001',
        notes: 'Bottled water for squad',
        approvedByUserId: null,
        approvedAt: null,
        rejectionReason: null,
        idempotencyKey: null,
        createdAt: new Date(),
        branch: { name: 'Main Branch' },
        recordedByUser: { name: 'Coach Tarek' },
        approvedByUser: null,
      });

      const res = await service.recordSessionExpense(coachContext, sessionId, {
        amount: 85.5,
        paymentMethod: 'CASH',
        notes: 'Bottled water for squad',
      });

      expect(res.status).toBe('PENDING');
      expect(res.amount).toBe(85.5);
      expect(mockTx.academyFinancialTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            approvedByUserId: null,
            approvedAt: null,
          }),
        }),
      );
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_EXPENSE_SUBMITTED',
        }),
      );
    });

    it('rejects expense submission by unassigned coach with ForbiddenException', async () => {
      mockTx.attendanceSession.findUnique.mockResolvedValue({
        id: sessionId,
        tenantId: tenantContext.tenantId,
        branchId,
        coachUserId: 'different-coach',
        group: { coaches: [{ coachUserId: 'another-coach' }] },
      });

      await expect(
        service.recordSessionExpense(coachContext, sessionId, {
          amount: 50,
          paymentMethod: 'CASH',
          notes: 'Unassigned coach attempt',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('auto-approves expense submitted by academy OWNER with COMPLETED status', async () => {
      mockTx.attendanceSession.findUnique.mockResolvedValue({
        id: sessionId,
        tenantId: tenantContext.tenantId,
        branchId,
        coachUserId: 'any-coach',
        group: { coaches: [] },
      });

      mockTx.academyFinancialTransaction.create.mockResolvedValue({
        id: 'exp-owner-1',
        tenantId: tenantContext.tenantId,
        branchId,
        sessionId,
        recordedByUserId: tenantContext.actorUserId,
        type: 'SESSION_EXPENSE',
        amount: 150,
        currency: 'SAR',
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        receiptNumber: 'EXP-2026-0002',
        notes: 'Emergency medical kit',
        approvedByUserId: tenantContext.actorUserId,
        approvedAt: new Date(),
        rejectionReason: null,
        idempotencyKey: null,
        createdAt: new Date(),
        branch: { name: 'Main Branch' },
        recordedByUser: { name: 'Owner Admin' },
        approvedByUser: { name: 'Owner Admin' },
      });

      const res = await service.recordSessionExpense(tenantContext, sessionId, {
        amount: 150,
        paymentMethod: 'CASH',
        notes: 'Emergency medical kit',
      });

      expect(res.status).toBe('COMPLETED');
      expect(mockTx.academyFinancialTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            approvedByUserId: tenantContext.actorUserId,
          }),
        }),
      );
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_EXPENSE_APPROVED',
        }),
      );
    });

    it('deduplicates submission when matching idempotencyKey exists', async () => {
      mockTx.attendanceSession.findUnique.mockResolvedValue({
        id: sessionId,
        tenantId: tenantContext.tenantId,
        branchId,
        coachUserId,
        group: { coaches: [] },
      });

      mockTx.academyFinancialTransaction.findFirst.mockResolvedValue({
        id: 'exp-existing',
        tenantId: tenantContext.tenantId,
        branchId,
        sessionId,
        recordedByUserId: coachUserId,
        type: 'SESSION_EXPENSE',
        amount: 50,
        currency: 'SAR',
        paymentMethod: 'CASH',
        status: 'PENDING',
        receiptNumber: 'EXP-IDEM-1',
        notes: 'Hydration',
        idempotencyKey: 'key-12345',
        createdAt: new Date(),
        branch: { name: 'Main Branch' },
        recordedByUser: { name: 'Coach Tarek' },
        approvedByUser: null,
      });

      const res = await service.recordSessionExpense(coachContext, sessionId, {
        amount: 50,
        paymentMethod: 'CASH',
        notes: 'Hydration',
        idempotencyKey: 'key-12345',
      });

      expect(res.id).toBe('exp-existing');
      expect(mockTx.academyFinancialTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects invalid or non-positive amount with BadRequestException', async () => {
      await expect(
        service.recordSessionExpense(coachContext, sessionId, {
          amount: -25,
          paymentMethod: 'CASH',
          notes: 'Negative value',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.recordSessionExpense(coachContext, sessionId, {
          amount: 0,
          paymentMethod: 'CASH',
          notes: 'Zero value',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveSessionExpense', () => {
    const coachUserId = '00000000-0000-4000-8000-000000000002';
    const managerContext: TenantContext = {
      tenantId: tenantContext.tenantId,
      actorUserId: '00000000-0000-4000-8000-000000000003',
      role: 'MANAGER',
    };

    it('manager approves coach pending expense and transitions to COMPLETED', async () => {
      mockTx.academyFinancialTransaction.findUnique.mockResolvedValue({
        id: 'exp-pending-1',
        tenantId: tenantContext.tenantId,
        branchId,
        sessionId,
        recordedByUserId: coachUserId,
        type: 'SESSION_EXPENSE',
        amount: 60,
        currency: 'SAR',
        status: 'PENDING',
        receiptNumber: 'EXP-1',
        notes: 'First aid tape',
        createdAt: new Date(),
        branch: { name: 'Main Branch' },
        recordedByUser: { name: 'Coach Tarek' },
      });

      mockTx.academyFinancialTransaction.update.mockResolvedValue({
        id: 'exp-pending-1',
        tenantId: tenantContext.tenantId,
        branchId,
        sessionId,
        recordedByUserId: coachUserId,
        type: 'SESSION_EXPENSE',
        amount: 60,
        currency: 'SAR',
        status: 'COMPLETED',
        receiptNumber: 'EXP-1',
        notes: 'First aid tape',
        approvedByUserId: managerContext.actorUserId,
        approvedAt: new Date(),
        createdAt: new Date(),
        branch: { name: 'Main Branch' },
        recordedByUser: { name: 'Coach Tarek' },
        approvedByUser: { name: 'Manager Sarah' },
      });

      const res = await service.approveSessionExpense(managerContext, 'exp-pending-1', {
        notes: 'Verified receipt',
      });

      expect(res.status).toBe('COMPLETED');
      expect(mockTx.academyFinancialTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            approvedByUserId: managerContext.actorUserId,
          }),
        }),
      );
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_EXPENSE_APPROVED',
        }),
      );
    });

    it('enforces separation of duties: non-owner staff cannot approve their own expense', async () => {
      mockTx.academyFinancialTransaction.findUnique.mockResolvedValue({
        id: 'exp-pending-2',
        tenantId: tenantContext.tenantId,
        branchId,
        sessionId,
        recordedByUserId: managerContext.actorUserId,
        type: 'SESSION_EXPENSE',
        amount: 100,
        currency: 'SAR',
        status: 'PENDING',
        branch: { name: 'Main Branch' },
        recordedByUser: { name: 'Manager Sarah' },
      });

      await expect(
        service.approveSessionExpense(managerContext, 'exp-pending-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects approval on already completed or rejected expenses', async () => {
      mockTx.academyFinancialTransaction.findUnique.mockResolvedValue({
        id: 'exp-already-done',
        tenantId: tenantContext.tenantId,
        branchId,
        sessionId,
        recordedByUserId: coachUserId,
        type: 'SESSION_EXPENSE',
        amount: 40,
        currency: 'SAR',
        status: 'COMPLETED',
        branch: { name: 'Main Branch' },
        recordedByUser: { name: 'Coach Tarek' },
      });

      await expect(
        service.approveSessionExpense(managerContext, 'exp-already-done'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectSessionExpense', () => {
    const coachUserId = '00000000-0000-4000-8000-000000000002';
    const managerContext: TenantContext = {
      tenantId: tenantContext.tenantId,
      actorUserId: '00000000-0000-4000-8000-000000000003',
      role: 'MANAGER',
    };

    it('manager rejects pending expense with mandatory reason', async () => {
      mockTx.academyFinancialTransaction.findUnique.mockResolvedValue({
        id: 'exp-reject-1',
        tenantId: tenantContext.tenantId,
        branchId,
        sessionId,
        recordedByUserId: coachUserId,
        type: 'SESSION_EXPENSE',
        amount: 120,
        currency: 'SAR',
        status: 'PENDING',
        receiptNumber: 'EXP-REJ',
        notes: 'Personal taxi fare',
        createdAt: new Date(),
        branch: { name: 'Main Branch' },
        recordedByUser: { name: 'Coach Tarek' },
      });

      mockTx.academyFinancialTransaction.update.mockResolvedValue({
        id: 'exp-reject-1',
        tenantId: tenantContext.tenantId,
        branchId,
        sessionId,
        recordedByUserId: coachUserId,
        type: 'SESSION_EXPENSE',
        amount: 120,
        currency: 'SAR',
        status: 'REJECTED',
        receiptNumber: 'EXP-REJ',
        notes: 'Personal taxi fare',
        rejectionReason: 'Transportation not covered by academy policy',
        rejectedByUserId: managerContext.actorUserId,
        createdAt: new Date(),
        branch: { name: 'Main Branch' },
        recordedByUser: { name: 'Coach Tarek' },
        approvedByUser: null,
      });

      const res = await service.rejectSessionExpense(managerContext, 'exp-reject-1', {
        reason: 'Transportation not covered by academy policy',
      });

      expect(res.status).toBe('REJECTED');
      expect(mockTx.academyFinancialTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            rejectionReason: 'Transportation not covered by academy policy',
          }),
        }),
      );
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_EXPENSE_REJECTED',
        }),
      );
    });
  });

  describe('getSessionCashierSummary', () => {
    it('summarizes cash vs electronic collections, only counting COMPLETED expenses', async () => {
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
        group: { coaches: [{ coachUserId: tenantContext.actorUserId }] },
        coachUserId: tenantContext.actorUserId,
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
        // Approved/Completed expense -> counts toward totalExpenses
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
        // PENDING expense -> MUST NOT count toward totalExpenses or deduct from netCashMovement
        {
          id: 'tx4',
          tenantId: tenantContext.tenantId,
          branchId,
          sessionId,
          type: 'SESSION_EXPENSE',
          amount: 75,
          currency: 'SAR',
          paymentMethod: 'CASH',
          status: 'PENDING',
          receiptNumber: 'EXP-PENDING',
          createdAt: new Date(),
          branch: { name: 'Main Branch' },
          player: null,
          recordedByUser: { name: 'Coach Ahmed' },
        },
        // REJECTED expense -> MUST NOT count toward totalExpenses
        {
          id: 'tx5',
          tenantId: tenantContext.tenantId,
          branchId,
          sessionId,
          type: 'SESSION_EXPENSE',
          amount: 50,
          currency: 'SAR',
          paymentMethod: 'CASH',
          status: 'REJECTED',
          receiptNumber: 'EXP-REJ',
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
      expect(summary.totalExpenses).toBe(100); // Only COMPLETED 100 counted, not 100+75+50
      expect(summary.netCashMovement).toBe(400); // 500 cash - 100 cash expense
    });

    it('denies cashier access to unassigned coach with ForbiddenException', async () => {
      const unassignedCoachContext: TenantContext = {
        tenantId: tenantContext.tenantId,
        actorUserId: 'unassigned-coach-id',
        role: 'COACH',
      };

      mockTx.attendanceSession.findUnique.mockResolvedValue({
        id: sessionId,
        tenantId: tenantContext.tenantId,
        branchId,
        groupName: 'U-11 Squad',
        sessionDate: new Date('2026-10-23'),
        startTime: '16:00',
        endTime: '17:30',
        status: 'OPEN',
        branch: { name: 'Main Branch' },
        records: [],
        coachUserId: 'different-coach',
        group: { coaches: [] },
      });

      await expect(
        service.getSessionCashierSummary(unassignedCoachContext, sessionId),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
