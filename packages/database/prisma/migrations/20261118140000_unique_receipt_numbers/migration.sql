-- =====================================================================================================================
-- K11: one receipt / expense number per academy
-- =====================================================================================================================
-- Numbers were 4 random digits per year (REC-2026-1234) with no constraint, so two receipts could share a number. The
-- API now generates REC-/EXP-<yyyymmdd>-<8 base-32 characters> from a CSPRNG; this index makes the database refuse a
-- duplicate in the same academy (a manually entered duplicate answers 409). Rows without a number are not affected.
--
-- Precondition: no academy already holds two transactions with the same receipt number (the development data is
-- replaced with synthetic data before this runs; on another database, resolve duplicates first or this fails).
-- Rollback (forward migration): DROP INDEX public.academy_financial_transactions_tenant_receipt_number_key;
-- =====================================================================================================================

-- A plain unique index: PostgreSQL treats NULLs as distinct, so rows without a number never conflict. Declared in
-- schema.prisma as @@unique([tenantId, receiptNumber]).
CREATE UNIQUE INDEX IF NOT EXISTS academy_financial_transactions_tenant_receipt_number_key
  ON public.academy_financial_transactions (tenant_id, receipt_number);
