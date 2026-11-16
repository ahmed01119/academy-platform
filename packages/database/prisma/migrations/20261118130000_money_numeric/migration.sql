-- =====================================================================================================================
-- K16: money is stored as numeric(12, 2) instead of double precision
-- =====================================================================================================================
-- double precision cannot represent most cent values exactly (0.1 + 0.2 <> 0.3), so ledger sums, outstanding
-- balances and cashier totals could drift by fractions of a cent. numeric(12, 2) is exact: up to 9,999,999,999.99
-- per value. Existing values are converted in place (rounded to the cent by the cast). The API converts the
-- values to numbers at the read boundary (backend/src/common/money.ts); the API contract is unchanged.
--
-- Rollback (forward migration): ALTER ... SET DATA TYPE double precision for the same columns.
-- =====================================================================================================================

-- AlterTable
ALTER TABLE "saas_plans" ALTER COLUMN "price_monthly" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "price_yearly" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "tenant_subscriptions" ALTER COLUMN "negotiated_price" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "saas_invoices" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "player_subscription_plans" ALTER COLUMN "fee_amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "player_subscriptions" ALTER COLUMN "fee_amount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "discount_amount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "paid_amount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "outstanding_balance" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "academy_financial_transactions" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "session_cashier_closings" ALTER COLUMN "total_cash_collected" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "total_electronic_collected" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "total_expenses" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "net_cash_movement" SET DATA TYPE DECIMAL(12,2);

