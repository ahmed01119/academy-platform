-- Migration: 20261024043000_sync_schema_drift
-- Aligns database schema constraints, defaults, and indexes with schema.prisma for zero drift.

-- 1. Align default constraints on timestamps and generated IDs
ALTER TABLE "academy_applications" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "academy_financial_transactions" DROP COLUMN IF EXISTS "playerId";
ALTER TABLE "academy_financial_transactions" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "academy_financial_transactions" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "evaluation_templates" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "evaluation_templates" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "evaluation_templates" ALTER COLUMN "age_category" SET DATA TYPE TEXT;
ALTER TABLE "evaluation_templates" ALTER COLUMN "name" SET DATA TYPE TEXT;

ALTER TABLE "group_members" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "platform_announcements" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "platform_announcements" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "player_evaluations" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "player_evaluations" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "player_evaluations" ALTER COLUMN "evaluation_date" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "player_registration_requests" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "player_subscription_plans" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "player_subscription_plans" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "player_subscriptions" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "player_subscriptions" ALTER COLUMN "due_date" DROP DEFAULT;
ALTER TABLE "player_subscriptions" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "player_subscriptions" ALTER COLUMN "start_date" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "saas_invoices" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "saas_invoices" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "saas_plans" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "saas_plans" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "session_cashier_closings" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "session_cashier_closings" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "tenant_subscriptions" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "tenant_subscriptions" ALTER COLUMN "renewal_date" DROP DEFAULT;
ALTER TABLE "tenant_subscriptions" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "training_groups" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "training_schedules" ALTER COLUMN "updated_at" DROP DEFAULT;

-- 2. Align players user_id unique index and national_id index
DROP INDEX IF EXISTS "players_user_id_key";
CREATE UNIQUE INDEX "players_user_id_key" ON "players"("user_id");

DROP INDEX IF EXISTS "players_tenant_id_national_id_idx";
CREATE INDEX "players_tenant_id_national_id_idx" ON "players"("tenant_id", "national_id");

-- 3. Safely normalize duplicate/historical foreign keys
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_approved_by_user_id_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_branch_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_player_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_recorded_by_user_id_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_reversed_by_user_id_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_session_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_sub_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_tenant_id_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_tenant_id_branch_id_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_tenant_id_player_id_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_tenant_id_session_id_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_tenant_id_subscription_id_fkey";

ALTER TABLE "player_subscription_plans" DROP CONSTRAINT IF EXISTS "player_subscription_plans_branch_fkey";
ALTER TABLE "player_subscription_plans" DROP CONSTRAINT IF EXISTS "player_subscription_plans_tenant_id_fkey";
ALTER TABLE "player_subscription_plans" DROP CONSTRAINT IF EXISTS "player_subscription_plans_tenant_id_branch_id_fkey";

ALTER TABLE "player_subscriptions" DROP CONSTRAINT IF EXISTS "player_subscriptions_plan_fkey";
ALTER TABLE "player_subscriptions" DROP CONSTRAINT IF EXISTS "player_subscriptions_player_fkey";
ALTER TABLE "player_subscriptions" DROP CONSTRAINT IF EXISTS "player_subscriptions_tenant_id_fkey";
ALTER TABLE "player_subscriptions" DROP CONSTRAINT IF EXISTS "player_subscriptions_tenant_id_plan_id_fkey";
ALTER TABLE "player_subscriptions" DROP CONSTRAINT IF EXISTS "player_subscriptions_tenant_id_player_id_fkey";

ALTER TABLE "saas_invoices" DROP CONSTRAINT IF EXISTS "saas_invoices_subscription_id_fkey";
ALTER TABLE "saas_invoices" DROP CONSTRAINT IF EXISTS "saas_invoices_tenant_id_fkey";

ALTER TABLE "session_cashier_closings" DROP CONSTRAINT IF EXISTS "session_cashier_closings_branch_fkey";
ALTER TABLE "session_cashier_closings" DROP CONSTRAINT IF EXISTS "session_cashier_closings_closed_by_user_id_fkey";
ALTER TABLE "session_cashier_closings" DROP CONSTRAINT IF EXISTS "session_cashier_closings_session_fkey";
ALTER TABLE "session_cashier_closings" DROP CONSTRAINT IF EXISTS "session_cashier_closings_tenant_id_fkey";
ALTER TABLE "session_cashier_closings" DROP CONSTRAINT IF EXISTS "session_cashier_closings_tenant_id_branch_id_fkey";
ALTER TABLE "session_cashier_closings" DROP CONSTRAINT IF EXISTS "session_cashier_closings_tenant_id_session_id_fkey";

ALTER TABLE "tenant_subscriptions" DROP CONSTRAINT IF EXISTS "tenant_subscriptions_plan_code_fkey";
ALTER TABLE "tenant_subscriptions" DROP CONSTRAINT IF EXISTS "tenant_subscriptions_tenant_id_fkey";

ALTER TABLE "player_evaluations" DROP CONSTRAINT IF EXISTS "player_evaluations_tenant_id_player_id_fkey";
ALTER TABLE "player_evaluations" DROP CONSTRAINT IF EXISTS "player_evaluations_tenant_id_session_id_fkey";
ALTER TABLE "player_evaluations" DROP CONSTRAINT IF EXISTS "player_evaluations_tenant_id_template_id_fkey";

-- 4. Re-add foreign keys with exact schema constraints
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_plan_code_fkey" FOREIGN KEY ("plan_code") REFERENCES "saas_plans"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "tenant_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "player_subscription_plans" ADD CONSTRAINT "player_subscription_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_subscription_plans" ADD CONSTRAINT "player_subscription_plans_branch_fkey" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "player_subscriptions" ADD CONSTRAINT "player_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_subscriptions" ADD CONSTRAINT "player_subscriptions_player_fkey" FOREIGN KEY ("tenant_id", "player_id") REFERENCES "players"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_subscriptions" ADD CONSTRAINT "player_subscriptions_plan_fkey" FOREIGN KEY ("tenant_id", "plan_id") REFERENCES "player_subscription_plans"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academy_financial_transactions" ADD CONSTRAINT "academy_financial_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academy_financial_transactions" ADD CONSTRAINT "academy_financial_transactions_branch_fkey" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academy_financial_transactions" ADD CONSTRAINT "academy_financial_transactions_session_fkey" FOREIGN KEY ("tenant_id", "session_id") REFERENCES "attendance_sessions"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academy_financial_transactions" ADD CONSTRAINT "academy_financial_transactions_player_fkey" FOREIGN KEY ("tenant_id", "player_id") REFERENCES "players"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academy_financial_transactions" ADD CONSTRAINT "academy_financial_transactions_sub_fkey" FOREIGN KEY ("tenant_id", "subscription_id") REFERENCES "player_subscriptions"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academy_financial_transactions" ADD CONSTRAINT "academy_financial_transactions_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academy_financial_transactions" ADD CONSTRAINT "academy_financial_transactions_reversed_by_user_id_fkey" FOREIGN KEY ("reversed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academy_financial_transactions" ADD CONSTRAINT "academy_financial_transactions_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "session_cashier_closings" ADD CONSTRAINT "session_cashier_closings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_cashier_closings" ADD CONSTRAINT "session_cashier_closings_branch_fkey" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_cashier_closings" ADD CONSTRAINT "session_cashier_closings_session_fkey" FOREIGN KEY ("tenant_id", "session_id") REFERENCES "attendance_sessions"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_cashier_closings" ADD CONSTRAINT "session_cashier_closings_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
