-- =====================================================================================================================
-- Online payments, phase B: an academy pays its platform subscription online (owner decision 2026-11-22)
-- =====================================================================================================================
-- tenant_subscriptions and saas_invoices are written only by platform staff (RLS: is_current_user_super_admin()). When
-- Paymob confirms that an academy paid its platform subscription, nobody from the platform is signed in, so the renewal
-- is done by one definer function that acts only on a confirmed payment:
--
--   fulfil_platform_subscription_payment(payment_id) -> saas_invoices.id
--
-- Caller: the payment webhook context only (app.auth_context = 'payment_webhook', set by the API after it verified the
-- provider's HMAC, the order id, the amount and the currency).
-- Payment: purpose PLATFORM_SUBSCRIPTION, status PAID (the webhook marks it PAID in the same transaction), billing_months
-- between 1 and 12 (fixed by the API when the checkout started, together with the amount).
-- Effect: the academy's subscription becomes ACTIVE, renewal_date moves forward by billing_months from the later of the
-- current renewal date and now, grace_ends_at is cleared; a PAID invoice is created and linked to the payment.
-- Idempotent: a payment already linked to an invoice returns that invoice and changes nothing.
-- Errors (SQLSTATE P0001 unless noted): PAYMENT_CONTEXT_REQUIRED (42501), PAYMENT_NOT_FOUND, PAYMENT_NOT_PAID,
-- PAYMENT_PERIOD_INVALID, SUBSCRIPTION_NOT_FOUND.
-- Rollback (forward migration): DROP FUNCTION public.fulfil_platform_subscription_payment(uuid); then drop the two columns.
-- =====================================================================================================================

ALTER TABLE "online_payments" ADD COLUMN "billing_months" INTEGER,
ADD COLUMN "saas_invoice_id" UUID;

CREATE UNIQUE INDEX "online_payments_saas_invoice_id_key" ON "online_payments"("saas_invoice_id");

ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_saas_invoice_id_fkey" FOREIGN KEY ("saas_invoice_id") REFERENCES "saas_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "online_payments" ADD CONSTRAINT "online_payments_billing_months_check"
  CHECK (billing_months IS NULL OR billing_months BETWEEN 1 AND 12);

CREATE OR REPLACE FUNCTION public.fulfil_platform_subscription_payment(p_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.online_payments%ROWTYPE;
  v_sub public.tenant_subscriptions%ROWTYPE;
  v_invoice uuid;
  v_now timestamptz := now();
BEGIN
  IF current_setting('app.auth_context', true) IS DISTINCT FROM 'payment_webhook' THEN
    RAISE EXCEPTION 'PAYMENT_CONTEXT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_payment
  FROM public.online_payments
  WHERE id = p_payment_id AND purpose = 'PLATFORM_SUBSCRIPTION'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_payment.saas_invoice_id IS NOT NULL THEN
    RETURN v_payment.saas_invoice_id;
  END IF;
  IF v_payment.status <> 'PAID' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_PAID' USING ERRCODE = 'P0001';
  END IF;
  IF v_payment.billing_months IS NULL OR v_payment.billing_months NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'PAYMENT_PERIOD_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_sub FROM public.tenant_subscriptions WHERE tenant_id = v_payment.tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.tenant_subscriptions
  SET status = 'ACTIVE',
      renewal_date = greatest(v_sub.renewal_date, v_now) + make_interval(months => v_payment.billing_months),
      grace_ends_at = NULL,
      updated_at = v_now
  WHERE id = v_sub.id;

  INSERT INTO public.saas_invoices (
    id, tenant_id, subscription_id, invoice_number, amount, currency, status, due_date, paid_at, payment_method, notes,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_payment.tenant_id, v_sub.id,
    'INV-' || to_char(v_now AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(v_payment.id::text, '-', ''), 1, 10)),
    v_payment.amount, v_payment.currency, 'PAID', (v_now AT TIME ZONE 'UTC')::date, v_now, 'ONLINE',
    'Paymob order ' || coalesce(v_payment.provider_order_id, '?') || ', ' || v_payment.billing_months || ' month(s)',
    v_now, v_now
  )
  RETURNING id INTO v_invoice;

  UPDATE public.online_payments SET saas_invoice_id = v_invoice, updated_at = v_now WHERE id = v_payment.id;
  RETURN v_invoice;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfil_platform_subscription_payment(uuid) FROM PUBLIC;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.fulfil_platform_subscription_payment(uuid) TO %I', r);
  END LOOP;
END
$$;
