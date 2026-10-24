import { z } from 'zod';

// ==========================================
// 1. SaaS Subscriptions (Academy -> Platform)
// ==========================================

export const TenantSubscriptionItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  planCode: z.enum(['STARTER', 'PRO', 'ENTERPRISE', 'CUSTOM']),
  planName: z.string(),
  status: z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED', 'PENDING']),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
  negotiatedPrice: z.number().nullable().optional(),
  currentPrice: z.number(),
  currency: z.string(),
  startDate: z.string().or(z.date()),
  renewalDate: z.string().or(z.date()),
  trialEndsAt: z.string().or(z.date()).nullable().optional(),
  graceEndsAt: z.string().or(z.date()).nullable().optional(),
  autoRenew: z.boolean(),
  maxBranches: z.number(),
  maxPlayers: z.number(),
  maxCoaches: z.number(),
  features: z.record(z.unknown()),
});

export type TenantSubscriptionItem = z.infer<typeof TenantSubscriptionItemSchema>;

export const UpdateTenantSubscriptionRequestSchema = z.object({
  planCode: z.enum(['STARTER', 'PRO', 'ENTERPRISE', 'CUSTOM']).optional(),
  status: z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED', 'PENDING']).optional(),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']).optional(),
  negotiatedPrice: z.number().min(0).optional(),
  renewalDate: z.string().optional(),
  trialEndsAt: z.string().nullable().optional(),
  graceEndsAt: z.string().nullable().optional(),
  autoRenew: z.boolean().optional(),
  reason: z.string().trim().max(500).optional(),
});

export type UpdateTenantSubscriptionRequest = z.infer<typeof UpdateTenantSubscriptionRequestSchema>;

export const SaaSInvoiceItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  subscriptionId: z.string().uuid().nullable().optional(),
  invoiceNumber: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['PAID', 'PENDING', 'OVERDUE', 'VOID']),
  dueDate: z.string().or(z.date()),
  paidAt: z.string().or(z.date()).nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
});

export type SaaSInvoiceItem = z.infer<typeof SaaSInvoiceItemSchema>;

// ==========================================
// 2. Player Subscriptions (Player -> Academy)
// ==========================================

export const PlayerSubscriptionPlanItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  branchName: z.string().nullable().optional(),
  sport: z.enum(['FOOTBALL']),
  name: z.string(),
  description: z.string().nullable().optional(),
  billingPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'PER_SESSION']),
  feeAmount: z.number(),
  currency: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().or(z.date()),
});

export type PlayerSubscriptionPlanItem = z.infer<typeof PlayerSubscriptionPlanItemSchema>;

export const CreatePlayerSubscriptionPlanRequestSchema = z.object({
  branchId: z.string().uuid().optional(),
  sport: z.enum(['FOOTBALL']).default('FOOTBALL'),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  billingPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'PER_SESSION']).default('MONTHLY'),
  feeAmount: z.number().min(0),
  currency: z.string().max(3).default('EGP'),
});

export type CreatePlayerSubscriptionPlanRequest = z.infer<
  typeof CreatePlayerSubscriptionPlanRequestSchema
>;

export const PlayerSubscriptionItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  playerId: z.string().uuid(),
  playerName: z.string(),
  planId: z.string().uuid().nullable().optional(),
  planName: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'PARTIAL', 'OVERDUE', 'EXEMPT', 'PAUSED', 'EXPIRED']),
  startDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  renewalDate: z.string().or(z.date()).nullable().optional(),
  feeAmount: z.number(),
  discountAmount: z.number(),
  discountReason: z.string().nullable().optional(),
  paidAmount: z.number(),
  outstandingBalance: z.number(),
  lastPaymentDate: z.string().or(z.date()).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type PlayerSubscriptionItem = z.infer<typeof PlayerSubscriptionItemSchema>;

export const CreatePlayerSubscriptionRequestSchema = z.object({
  playerId: z.string().uuid(),
  planId: z.string().uuid().optional(),
  feeAmount: z.number().min(0),
  discountAmount: z.number().min(0).default(0),
  discountReason: z.string().max(200).optional(),
  dueDate: z.string(),
  startDate: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export type CreatePlayerSubscriptionRequest = z.infer<typeof CreatePlayerSubscriptionRequestSchema>;

// ==========================================
// 3. Financial Transactions Ledger
// ==========================================

export const FinancialTransactionItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  branchName: z.string().nullable().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  playerId: z.string().uuid().nullable().optional(),
  playerName: z.string().nullable().optional(),
  subscriptionId: z.string().uuid().nullable().optional(),
  recordedByUserId: z.string().uuid(),
  recordedByName: z.string().nullable().optional(),
  type: z.enum(['MEMBERSHIP_FEE', 'REGISTRATION_FEE', 'SESSION_EXPENSE', 'REFUND', 'ADJUSTMENT']),
  amount: z.number(),
  currency: z.string(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'POS', 'ONLINE']),
  status: z.enum(['COMPLETED', 'REVERSED', 'PENDING', 'REJECTED']),
  receiptNumber: z.string().nullable().optional(),
  referenceNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  reversalReason: z.string().nullable().optional(),
  reversedAt: z.string().or(z.date()).nullable().optional(),
  approvedByUserId: z.string().uuid().nullable().optional(),
  approvedByName: z.string().nullable().optional(),
  approvedAt: z.string().or(z.date()).nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
});

export type FinancialTransactionItem = z.infer<typeof FinancialTransactionItemSchema>;

export const RecordPlayerPaymentRequestSchema = z.object({
  playerId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  branchId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'POS', 'ONLINE']).default('CASH'),
  receiptNumber: z.string().trim().max(100).optional(),
  referenceNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type RecordPlayerPaymentRequest = z.infer<typeof RecordPlayerPaymentRequestSchema>;

export const ReverseTransactionRequestSchema = z.object({
  reason: z.string().trim().min(5, 'Reversal reason must be at least 5 characters').max(500),
});

export type ReverseTransactionRequest = z.infer<typeof ReverseTransactionRequestSchema>;

export const RecordSessionExpenseRequestSchema = z.object({
  branchId: z.string().uuid(),
  amount: z.number().positive('Expense amount must be positive'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'POS', 'ONLINE']).default('CASH'),
  receiptNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().min(3, 'Expense reason/notes required').max(500),
  idempotencyKey: z.string().trim().max(100).optional(),
});

export type RecordSessionExpenseRequest = z.infer<typeof RecordSessionExpenseRequestSchema>;

export const ApproveExpenseRequestSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export type ApproveExpenseRequest = z.infer<typeof ApproveExpenseRequestSchema>;

export const RejectExpenseRequestSchema = z.object({
  reason: z.string().trim().min(3, 'Rejection reason must be at least 3 characters').max(500),
});

export type RejectExpenseRequest = z.infer<typeof RejectExpenseRequestSchema>;

// ==========================================
// 4. Session Cashier Closing & Reconciliation
// ==========================================

export const SessionCashierSummarySchema = z.object({
  sessionId: z.string().uuid(),
  branchId: z.string().uuid(),
  groupName: z.string(),
  sessionDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.string(),
  totalAttendees: z.number(),
  totalAbsent: z.number(),
  totalLate: z.number(),
  totalActiveSubscribers: z.number(),
  totalOverdueSubscribers: z.number(),
  totalCashCollected: z.number(),
  totalElectronicCollected: z.number(),
  totalExpenses: z.number(),
  netCashMovement: z.number(),
  isReconciled: z.boolean(),
  reconciledAt: z.string().nullable().optional(),
  closedByUserName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  transactions: z.array(FinancialTransactionItemSchema),
});

export type SessionCashierSummary = z.infer<typeof SessionCashierSummarySchema>;

export const CloseSessionCashierRequestSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export type CloseSessionCashierRequest = z.infer<typeof CloseSessionCashierRequestSchema>;

// ==========================================
// 5. Academy Financial Dashboard
// ==========================================

export const AcademyFinancialDashboardMetricsSchema = z.object({
  todayCollections: z.number(),
  sessionCollections: z.number(),
  monthlyRevenue: z.number(),
  outstandingPlayerBalances: z.number(),
  overdueSubscriptionsCount: z.number(),
  netCashMovement: z.number(),
  branchRevenue: z.record(z.number()),
  expensesByCategory: z.record(z.number()),
  paymentMethodBreakdown: z.record(z.number()),
  recentTransactions: z.array(FinancialTransactionItemSchema),
});

export type AcademyFinancialDashboardMetrics = z.infer<
  typeof AcademyFinancialDashboardMetricsSchema
>;
