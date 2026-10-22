-- Migration: 20261022080000_player_qr_credentials_and_offline_attendance
-- Implements:
-- 1. Player unique, revocable QR membership credentials
-- 2. Configurable tenant lateness grace period
-- 3. Offline attendance synchronization and device timestamp tracking

-- 1. Tenant configurable lateness grace period
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "lateness_grace_minutes" INTEGER NOT NULL DEFAULT 15;

-- 2. Player QR membership credentials and readable membership number
ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "membership_number" TEXT,
  ADD COLUMN IF NOT EXISTS "qr_card_code" TEXT,
  ADD COLUMN IF NOT EXISTS "qr_card_issued_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "qr_card_revoked_at" TIMESTAMPTZ(3);

-- Populate existing players with default credentials if missing
UPDATE "players"
SET
  qr_card_code = COALESCE(qr_card_code, md5(id::text || gen_random_uuid()::text)),
  qr_card_issued_at = COALESCE(qr_card_issued_at, NOW()),
  membership_number = COALESCE(membership_number, 'PLY-' || UPPER(SUBSTRING(id::text, 1, 8)))
WHERE qr_card_code IS NULL;

-- Unique constraint on qr_card_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_qr_card_code_key'
  ) THEN
    ALTER TABLE "players" ADD CONSTRAINT "players_qr_card_code_key" UNIQUE ("qr_card_code");
  END IF;
END $$;

-- Index for rapid QR card lookups scoped to tenant
CREATE INDEX IF NOT EXISTS "players_tenant_id_qr_card_code_idx"
  ON "players"("tenant_id", "qr_card_code");

-- 3. AttendanceRecord offline sync and device timestamp fields
ALTER TABLE "attendance_records"
  ADD COLUMN IF NOT EXISTS "device_observed_time" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "is_offline_sync" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sync_status" TEXT NOT NULL DEFAULT 'CONFIRMED';
