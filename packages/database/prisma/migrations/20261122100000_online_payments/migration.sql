-- Online payments through a payment provider (Paymob), owner decision 2026-11-22:
--   * guardians / players pay their academy subscription online; the money reaches the PLATFORM's merchant account
--     and is owed to the academy (academy_payouts records what the platform has transferred);
--   * academies pay their platform subscription online (purpose PLATFORM_SUBSCRIPTION, phase B).
-- Additive only: two new enums, two new tables, their policies and grants. Nothing existing is changed.

-- CreateEnum
CREATE TYPE "OnlinePaymentPurpose" AS ENUM ('PLAYER_SUBSCRIPTION', 'PLATFORM_SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "OnlinePaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "online_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "purpose" "OnlinePaymentPurpose" NOT NULL,
    "status" "OnlinePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payer_user_id" UUID NOT NULL,
    "player_subscription_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PAYMOB',
    "provider_order_id" TEXT,
    "provider_intention_id" TEXT,
    "provider_transaction_id" TEXT,
    "failure_reason" TEXT,
    "transaction_id" UUID,
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "online_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academy_payouts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "paid_at" TIMESTAMPTZ(3) NOT NULL,
    "recorded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academy_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "online_payments_provider_order_id_key" ON "online_payments"("provider_order_id");

-- CreateIndex
CREATE INDEX "online_payments_tenant_id_idx" ON "online_payments"("tenant_id");

-- CreateIndex
CREATE INDEX "online_payments_payer_user_id_idx" ON "online_payments"("payer_user_id");

-- CreateIndex
CREATE INDEX "academy_payouts_tenant_id_idx" ON "academy_payouts"("tenant_id");

-- AddForeignKey
ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_payer_user_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academy_payouts" ADD CONSTRAINT "academy_payouts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academy_payouts" ADD CONSTRAINT "academy_payouts_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "academy_payouts" ADD CONSTRAINT "academy_payouts_amount_positive" CHECK ("amount" > 0);

-- Row-level security -------------------------------------------------------------------------------------------------
ALTER TABLE public.online_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.academy_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_payouts FORCE ROW LEVEL SECURITY;

-- online_payments: the academy (its own rows), the payer (their own payments), platform staff, and the payment
-- provider's webhook (a dedicated context that only this table admits; the webhook is authenticated by HMAC).
CREATE POLICY online_payments_access ON public.online_payments
  FOR ALL TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
    OR payer_user_id = public.current_app_user_id()
    OR public.is_current_user_super_admin()
    OR current_setting('app.auth_context', true) = 'payment_webhook'
  )
  WITH CHECK (
    tenant_id = public.current_app_tenant_id()
    OR payer_user_id = public.current_app_user_id()
    OR public.is_current_user_super_admin()
    OR current_setting('app.auth_context', true) = 'payment_webhook'
  );

-- academy_payouts: an academy reads its own payouts; only platform staff record them.
CREATE POLICY academy_payouts_read ON public.academy_payouts
  FOR SELECT TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id() OR public.is_current_user_super_admin());
CREATE POLICY academy_payouts_write ON public.academy_payouts
  FOR INSERT TO PUBLIC
  WITH CHECK (public.is_current_user_super_admin());

-- Runtime grants (same roles as 20261117100000_s3_runtime_privileges): no DELETE, no TRUNCATE ----------------------
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.online_payments TO %I', r);
    EXECUTE format('GRANT SELECT, INSERT ON TABLE public.academy_payouts TO %I', r);
  END LOOP;
END
$$;
