-- Migration: 20261023030000_superadmin_saas_billing_and_academy_finance
-- Implements:
-- 1. User security flags (mustResetPassword, isSuspended, suspendedReason)
-- 2. Platform SaaS Subscription System (SaaSPlan, TenantSubscription, SaaSInvoice)
-- 3. Academy Player Subscription System (PlayerSubscriptionPlan, PlayerSubscription)
-- 4. Academy Financial Operations & Cashier Ledger (AcademyFinancialTransaction, SessionCashierClosing)
-- 5. Platform Announcements
-- 6. PostgreSQL Row Level Security (RLS) policies for multi-tenant isolation

-- 1. Create Enums if not exist
DO $$ BEGIN
  CREATE TYPE "SaaSPlanCode" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SaaSBillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SaaSSubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED', 'PENDING');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SaaSInvoiceStatus" AS ENUM ('PAID', 'PENDING', 'OVERDUE', 'VOID');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PlayerSubscriptionStatus" AS ENUM ('ACTIVE', 'PARTIAL', 'OVERDUE', 'EXEMPT', 'PAUSED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PlayerBillingPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'PER_SESSION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "FinancialTransactionType" AS ENUM ('MEMBERSHIP_FEE', 'REGISTRATION_FEE', 'SESSION_EXPENSE', 'REFUND', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "FinancialPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'POS', 'ONLINE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "FinancialTransactionStatus" AS ENUM ('COMPLETED', 'REVERSED', 'PENDING');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PlatformAnnouncementType" AS ENUM ('INFO', 'WARNING', 'MAINTENANCE', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PlatformAnnouncementTarget" AS ENUM ('ALL', 'ACADEMY_ADMIN', 'COACH', 'GUARDIAN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. User table additions
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "must_reset_password" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_suspended" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "suspended_reason" TEXT;

-- 3. SaaS Plans
CREATE TABLE IF NOT EXISTS "saas_plans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" "SaaSPlanCode" NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price_monthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "price_yearly" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" CHAR(3) NOT NULL DEFAULT 'EGP',
  "max_branches" INTEGER NOT NULL DEFAULT 1,
  "max_players" INTEGER NOT NULL DEFAULT 50,
  "max_coaches" INTEGER NOT NULL DEFAULT 5,
  "features" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

-- Seed default platform SaaS plans
INSERT INTO "saas_plans" ("code", "name", "description", "price_monthly", "price_yearly", "currency", "max_branches", "max_players", "max_coaches", "features")
VALUES
  ('STARTER', 'Starter Academy', 'Ideal for emerging single-branch academies', 499, 4990, 'EGP', 1, 50, 5, '{"qrAttendance": true, "playerProfiles": true, "evaluations": false, "multiBranch": false}'::jsonb),
  ('PRO', 'Professional Academy', 'Comprehensive suite with performance intelligence & cashiering', 1299, 12990, 'EGP', 5, 250, 20, '{"qrAttendance": true, "playerProfiles": true, "evaluations": true, "multiBranch": true, "sessionCashier": true}'::jsonb),
  ('ENTERPRISE', 'Enterprise Sports Club', 'High-scale multi-branch network with full financial reconciliation', 2999, 29990, 'EGP', 25, 2000, 100, '{"qrAttendance": true, "playerProfiles": true, "evaluations": true, "multiBranch": true, "sessionCashier": true, "customPricing": true, "apiAccess": true}'::jsonb),
  ('CUSTOM', 'Bespoke Contract', 'Custom negotiated enterprise contract with tailored SLA', 0, 0, 'EGP', 999, 99999, 999, '{"all": true}'::jsonb)
ON CONFLICT ("code") DO NOTHING;

-- 4. Tenant Subscriptions
CREATE TABLE IF NOT EXISTS "tenant_subscriptions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL UNIQUE REFERENCES "tenants"("id") ON DELETE CASCADE,
  "plan_code" "SaaSPlanCode" NOT NULL DEFAULT 'STARTER' REFERENCES "saas_plans"("code"),
  "status" "SaaSSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "billing_cycle" "SaaSBillingCycle" NOT NULL DEFAULT 'MONTHLY',
  "negotiated_price" DOUBLE PRECISION,
  "currency" CHAR(3) NOT NULL DEFAULT 'EGP',
  "start_date" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "renewal_date" TIMESTAMPTZ(3) NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  "trial_ends_at" TIMESTAMPTZ(3),
  "grace_ends_at" TIMESTAMPTZ(3),
  "auto_renew" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

-- Ensure all current active tenants have a PRO subscription record
INSERT INTO "tenant_subscriptions" ("tenant_id", "plan_code", "status", "billing_cycle", "renewal_date")
SELECT id, 'PRO'::"SaaSPlanCode", 'ACTIVE'::"SaaSSubscriptionStatus", 'MONTHLY'::"SaaSBillingCycle", (NOW() + INTERVAL '30 days')
FROM "tenants"
ON CONFLICT ("tenant_id") DO NOTHING;

-- 5. SaaS Invoices
CREATE TABLE IF NOT EXISTS "saas_invoices" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "subscription_id" UUID REFERENCES "tenant_subscriptions"("id") ON DELETE SET NULL,
  "invoice_number" TEXT NOT NULL UNIQUE,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EGP',
  "status" "SaaSInvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "due_date" DATE NOT NULL,
  "paid_at" TIMESTAMPTZ(3),
  "payment_method" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "saas_invoices_tenant_id_idx" ON "saas_invoices"("tenant_id");

-- 6. Player Subscription Plans
CREATE TABLE IF NOT EXISTS "player_subscription_plans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" UUID,
  "sport" "SportCode" NOT NULL DEFAULT 'FOOTBALL',
  "name" TEXT NOT NULL,
  "description" TEXT,
  "billing_period" "PlayerBillingPeriod" NOT NULL DEFAULT 'MONTHLY',
  "fee_amount" DOUBLE PRECISION NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EGP',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "player_subscription_plans_tenant_id_id_key" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "player_subscription_plans_branch_fkey" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "player_subscription_plans_tenant_id_idx" ON "player_subscription_plans"("tenant_id");
CREATE INDEX IF NOT EXISTS "player_subscription_plans_tenant_id_branch_id_idx" ON "player_subscription_plans"("tenant_id", "branch_id");

-- 7. Player Subscriptions
CREATE TABLE IF NOT EXISTS "player_subscriptions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "player_id" UUID NOT NULL,
  "plan_id" UUID,
  "status" "PlayerSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "due_date" DATE NOT NULL DEFAULT (CURRENT_DATE + 30),
  "renewal_date" DATE,
  "fee_amount" DOUBLE PRECISION NOT NULL,
  "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount_reason" TEXT,
  "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "outstanding_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "last_payment_date" TIMESTAMPTZ(3),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "player_subscriptions_tenant_id_id_key" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "player_subscriptions_player_fkey" FOREIGN KEY ("tenant_id", "player_id") REFERENCES "players"("tenant_id", "id") ON DELETE CASCADE,
  CONSTRAINT "player_subscriptions_plan_fkey" FOREIGN KEY ("tenant_id", "plan_id") REFERENCES "player_subscription_plans"("tenant_id", "id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "player_subscriptions_tenant_id_idx" ON "player_subscriptions"("tenant_id");
CREATE INDEX IF NOT EXISTS "player_subscriptions_player_id_idx" ON "player_subscriptions"("player_id");
CREATE INDEX IF NOT EXISTS "player_subscriptions_tenant_id_status_idx" ON "player_subscriptions"("tenant_id", "status");

-- 8. Academy Financial Transactions (Ledger)
CREATE TABLE IF NOT EXISTS "academy_financial_transactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" UUID NOT NULL,
  "session_id" UUID,
  "playerId" UUID,
  "player_id" UUID,
  "subscription_id" UUID,
  "recorded_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "type" "FinancialTransactionType" NOT NULL DEFAULT 'MEMBERSHIP_FEE',
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EGP',
  "payment_method" "FinancialPaymentMethod" NOT NULL DEFAULT 'CASH',
  "status" "FinancialTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
  "receipt_number" TEXT,
  "reference_number" TEXT,
  "notes" TEXT,
  "reversal_reason" TEXT,
  "reversed_at" TIMESTAMPTZ(3),
  "reversed_by_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "academy_financial_transactions_tenant_id_id_key" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "academy_financial_transactions_branch_fkey" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "academy_financial_transactions_session_fkey" FOREIGN KEY ("tenant_id", "session_id") REFERENCES "attendance_sessions"("tenant_id", "id") ON DELETE SET NULL,
  CONSTRAINT "academy_financial_transactions_player_fkey" FOREIGN KEY ("tenant_id", "player_id") REFERENCES "players"("tenant_id", "id") ON DELETE SET NULL,
  CONSTRAINT "academy_financial_transactions_sub_fkey" FOREIGN KEY ("tenant_id", "subscription_id") REFERENCES "player_subscriptions"("tenant_id", "id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "academy_fin_tx_tenant_id_idx" ON "academy_financial_transactions"("tenant_id");
CREATE INDEX IF NOT EXISTS "academy_fin_tx_branch_id_idx" ON "academy_financial_transactions"("branch_id");
CREATE INDEX IF NOT EXISTS "academy_fin_tx_session_id_idx" ON "academy_financial_transactions"("session_id");
CREATE INDEX IF NOT EXISTS "academy_fin_tx_player_id_idx" ON "academy_financial_transactions"("player_id");
CREATE INDEX IF NOT EXISTS "academy_fin_tx_created_at_idx" ON "academy_financial_transactions"("tenant_id", "created_at");

-- 9. Session Cashier Closing Reconciliation
CREATE TABLE IF NOT EXISTS "session_cashier_closings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" UUID NOT NULL,
  "session_id" UUID NOT NULL UNIQUE,
  "closed_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "total_attendees" INTEGER NOT NULL DEFAULT 0,
  "total_absent" INTEGER NOT NULL DEFAULT 0,
  "total_late" INTEGER NOT NULL DEFAULT 0,
  "total_active_subscribers" INTEGER NOT NULL DEFAULT 0,
  "total_overdue_subscribers" INTEGER NOT NULL DEFAULT 0,
  "total_cash_collected" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total_electronic_collected" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total_expenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "net_cash_movement" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "is_reconciled" BOOLEAN NOT NULL DEFAULT true,
  "reconciled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "session_cashier_closings_tenant_id_id_key" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "session_cashier_closings_tenant_id_session_id_key" UNIQUE ("tenant_id", "session_id"),
  CONSTRAINT "session_cashier_closings_branch_fkey" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "session_cashier_closings_session_fkey" FOREIGN KEY ("tenant_id", "session_id") REFERENCES "attendance_sessions"("tenant_id", "id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_cashier_closings_tenant_id_idx" ON "session_cashier_closings"("tenant_id");
CREATE INDEX IF NOT EXISTS "session_cashier_closings_branch_id_idx" ON "session_cashier_closings"("branch_id");

-- 10. Platform Announcements
CREATE TABLE IF NOT EXISTS "platform_announcements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" "PlatformAnnouncementType" NOT NULL DEFAULT 'INFO',
  "target_role" "PlatformAnnouncementTarget" NOT NULL DEFAULT 'ALL',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "starts_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "ends_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

-- 11. Row-Level Security (RLS) Policies
ALTER TABLE "saas_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saas_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_subscription_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academy_financial_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_cashier_closings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_announcements" ENABLE ROW LEVEL SECURITY;

-- Plans & Announcements are visible to all authenticated users; Super Admin can write
DROP POLICY IF EXISTS saas_plans_read_all ON "saas_plans";
CREATE POLICY saas_plans_read_all ON "saas_plans" FOR SELECT TO PUBLIC USING (true);

DROP POLICY IF EXISTS saas_plans_super_admin ON "saas_plans";
CREATE POLICY saas_plans_super_admin ON "saas_plans" FOR ALL TO PUBLIC USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS announcements_read_all ON "platform_announcements";
CREATE POLICY announcements_read_all ON "platform_announcements" FOR SELECT TO PUBLIC USING (is_active = true);

DROP POLICY IF EXISTS announcements_super_admin ON "platform_announcements";
CREATE POLICY announcements_super_admin ON "platform_announcements" FOR ALL TO PUBLIC USING (public.is_current_user_super_admin());

-- Tenant Subscriptions & SaaS Invoices: tenant owner read, Super Admin full control
DROP POLICY IF EXISTS tenant_subscriptions_tenant_isolation ON "tenant_subscriptions";
CREATE POLICY tenant_subscriptions_tenant_isolation ON "tenant_subscriptions"
  FOR SELECT TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
    OR public.is_current_user_super_admin()
  );

DROP POLICY IF EXISTS tenant_subscriptions_super_admin_write ON "tenant_subscriptions";
CREATE POLICY tenant_subscriptions_super_admin_write ON "tenant_subscriptions"
  FOR ALL TO PUBLIC
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS saas_invoices_tenant_isolation ON "saas_invoices";
CREATE POLICY saas_invoices_tenant_isolation ON "saas_invoices"
  FOR SELECT TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
    OR public.is_current_user_super_admin()
  );

DROP POLICY IF EXISTS saas_invoices_super_admin_write ON "saas_invoices";
CREATE POLICY saas_invoices_super_admin_write ON "saas_invoices"
  FOR ALL TO PUBLIC
  USING (public.is_current_user_super_admin());

-- Player Subscription Plans: scoped to tenant
DROP POLICY IF EXISTS player_sub_plans_tenant_isolation ON "player_subscription_plans";
CREATE POLICY player_sub_plans_tenant_isolation ON "player_subscription_plans"
  FOR ALL TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
    OR public.is_current_user_super_admin()
  );

-- Player Subscriptions: scoped to tenant, with player self-service view
DROP POLICY IF EXISTS player_subs_tenant_isolation ON "player_subscriptions";
CREATE POLICY player_subs_tenant_isolation ON "player_subscriptions"
  FOR ALL TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
    OR public.is_current_user_super_admin()
    OR player_id IN (
      SELECT id FROM public.players WHERE user_id = public.current_app_user_id()
      UNION
      SELECT player_id FROM public.guardians WHERE user_id = public.current_app_user_id()
    )
  );

-- Academy Financial Transactions: scoped to tenant, players/guardians can see their own transactions
DROP POLICY IF EXISTS academy_fin_tx_tenant_isolation ON "academy_financial_transactions";
CREATE POLICY academy_fin_tx_tenant_isolation ON "academy_financial_transactions"
  FOR ALL TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
    OR public.is_current_user_super_admin()
    OR player_id IN (
      SELECT id FROM public.players WHERE user_id = public.current_app_user_id()
      UNION
      SELECT player_id FROM public.guardians WHERE user_id = public.current_app_user_id()
    )
  );

-- Session Cashier Closings: scoped to tenant
DROP POLICY IF EXISTS session_closings_tenant_isolation ON "session_cashier_closings";
CREATE POLICY session_closings_tenant_isolation ON "session_cashier_closings"
  FOR ALL TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
    OR public.is_current_user_super_admin()
  );
