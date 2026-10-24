-- Migration: 20261024043000_sync_schema_drift
-- Aligns database schema constraints, defaults, and indexes with schema.prisma for zero drift.

-- 1. Align default constraints on timestamps and generated IDs
ALTER TABLE "academy_applications" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "academy_financial_transactions" DROP COLUMN IF EXISTS "playerId";
ALTER TABLE "academy_financial_transactions" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "academy_financial_transactions" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "evaluation_templates" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "evaluation_templates" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "group_members" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "platform_announcements" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "platform_announcements" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "player_evaluations" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "player_evaluations" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "player_registration_requests" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "player_subscription_plans" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "player_subscription_plans" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "player_subscriptions" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "player_subscriptions" ALTER COLUMN "due_date" DROP DEFAULT;
ALTER TABLE "player_subscriptions" ALTER COLUMN "updated_at" DROP DEFAULT;

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

-- 2. Align players user_id unique index to non-partial index matching @unique
DROP INDEX IF EXISTS "players_user_id_key";
CREATE UNIQUE INDEX "players_user_id_key" ON "players"("user_id");

-- 3. Safely normalize duplicate foreign keys if previously generated
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_tenant_id_branch_id_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_tenant_id_player_id_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_tenant_id_session_id_fkey";
ALTER TABLE "academy_financial_transactions" DROP CONSTRAINT IF EXISTS "academy_financial_transactions_tenant_id_subscription_id_fkey";
ALTER TABLE "player_subscription_plans" DROP CONSTRAINT IF EXISTS "player_subscription_plans_tenant_id_branch_id_fkey";
ALTER TABLE "player_subscriptions" DROP CONSTRAINT IF EXISTS "player_subscriptions_tenant_id_plan_id_fkey";
ALTER TABLE "player_subscriptions" DROP CONSTRAINT IF EXISTS "player_subscriptions_tenant_id_player_id_fkey";
ALTER TABLE "session_cashier_closings" DROP CONSTRAINT IF EXISTS "session_cashier_closings_tenant_id_branch_id_fkey";
ALTER TABLE "session_cashier_closings" DROP CONSTRAINT IF EXISTS "session_cashier_closings_tenant_id_session_id_fkey";
ALTER TABLE "player_evaluations" DROP CONSTRAINT IF EXISTS "player_evaluations_tenant_id_player_id_fkey";
ALTER TABLE "player_evaluations" DROP CONSTRAINT IF EXISTS "player_evaluations_tenant_id_session_id_fkey";
ALTER TABLE "player_evaluations" DROP CONSTRAINT IF EXISTS "player_evaluations_tenant_id_template_id_fkey";
