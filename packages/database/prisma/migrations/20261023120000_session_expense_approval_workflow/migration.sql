-- Migration: 20261023120000_session_expense_approval_workflow
-- Support configurable expense approval workflow (submitted, approved, rejected, reversed),
-- idempotency safeguards, and separation of duties for coach training-session expenses.

-- 1. Add REJECTED to FinancialTransactionStatus enum
ALTER TYPE "FinancialTransactionStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- 2. Add approval, rejection, and idempotency columns to academy_financial_transactions
ALTER TABLE "academy_financial_transactions"
  ADD COLUMN IF NOT EXISTS "approved_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

-- 3. Add foreign key for approved_by_user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'academy_financial_transactions_approved_by_user_id_fkey'
  ) THEN
    ALTER TABLE "academy_financial_transactions"
      ADD CONSTRAINT "academy_financial_transactions_approved_by_user_id_fkey"
      FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Create index on [tenant_id, idempotency_key]
CREATE INDEX IF NOT EXISTS "academy_financial_transactions_tenant_id_idempotency_key_idx"
  ON "academy_financial_transactions"("tenant_id", "idempotency_key");
