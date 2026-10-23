-- Migration: Sprint 2 Academy Profile, Branch Capacity, Player Management, and Enrollment History

-- 1. Create Enums
CREATE TYPE "PlayerGender" AS ENUM ('MALE', 'FEMALE');
CREATE TYPE "PlayerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED');
CREATE TYPE "GuardianRelationship" AS ENUM ('FATHER', 'MOTHER', 'GUARDIAN', 'RELATIVE', 'OTHER');
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED');

-- 2. Alter Existing Tables
ALTER TABLE "branches"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "capacity" INTEGER,
  ADD COLUMN "manager_user_id" UUID;

ALTER TABLE "tenants"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "logo_url" TEXT;

-- 3. Create Tables
CREATE TABLE "players" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "gender" "PlayerGender" NOT NULL DEFAULT 'MALE',
    "date_of_birth" DATE NOT NULL,
    "national_id" TEXT,
    "photo_url" TEXT,
    "emergency_contact_name" TEXT NOT NULL,
    "emergency_contact_phone" TEXT NOT NULL,
    "medical_notes" TEXT,
    "status" "PlayerStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guardians" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "relationship" "GuardianRelationship" NOT NULL DEFAULT 'FATHER',
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "player_enrollments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "sport" "SportCode" NOT NULL DEFAULT 'FOOTBALL',
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "player_enrollments_pkey" PRIMARY KEY ("id")
);

-- 4. Indexes & Unique Constraints
CREATE UNIQUE INDEX "players_tenant_id_id_key" ON "players"("tenant_id", "id");
CREATE INDEX "players_tenant_id_idx" ON "players"("tenant_id");
CREATE INDEX "players_tenant_id_status_idx" ON "players"("tenant_id", "status");
CREATE INDEX "players_tenant_id_last_name_first_name_idx" ON "players"("tenant_id", "last_name", "first_name");

CREATE UNIQUE INDEX "guardians_tenant_id_id_key" ON "guardians"("tenant_id", "id");
CREATE INDEX "guardians_tenant_id_idx" ON "guardians"("tenant_id");
CREATE INDEX "guardians_player_id_idx" ON "guardians"("player_id");

CREATE UNIQUE INDEX "player_enrollments_tenant_id_id_key" ON "player_enrollments"("tenant_id", "id");
CREATE INDEX "player_enrollments_tenant_id_idx" ON "player_enrollments"("tenant_id");
CREATE INDEX "player_enrollments_player_id_idx" ON "player_enrollments"("player_id");
CREATE INDEX "player_enrollments_branch_id_idx" ON "player_enrollments"("branch_id");
CREATE INDEX "player_enrollments_tenant_id_status_idx" ON "player_enrollments"("tenant_id", "status");

-- 5. Foreign Key Constraints (with composite tenant isolation safeguards)
ALTER TABLE "branches"
  ADD CONSTRAINT "branches_manager_user_id_fkey"
  FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "players"
  ADD CONSTRAINT "players_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guardians"
  ADD CONSTRAINT "guardians_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guardians"
  ADD CONSTRAINT "guardians_tenant_id_player_id_fkey"
  FOREIGN KEY ("tenant_id", "player_id") REFERENCES "players"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "player_enrollments"
  ADD CONSTRAINT "player_enrollments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "player_enrollments"
  ADD CONSTRAINT "player_enrollments_tenant_id_player_id_fkey"
  FOREIGN KEY ("tenant_id", "player_id") REFERENCES "players"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "player_enrollments"
  ADD CONSTRAINT "player_enrollments_tenant_id_branch_id_fkey"
  FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Row Level Security (RLS) Enforcement & Isolation Policies
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players FORCE ROW LEVEL SECURITY;

CREATE POLICY players_tenant_select ON public.players
  FOR SELECT TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id());

CREATE POLICY players_tenant_insert ON public.players
  FOR INSERT TO PUBLIC
  WITH CHECK (tenant_id = public.current_app_tenant_id());

CREATE POLICY players_tenant_update ON public.players
  FOR UPDATE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id())
  WITH CHECK (tenant_id = public.current_app_tenant_id());

CREATE POLICY players_tenant_delete ON public.players
  FOR DELETE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id());

ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians FORCE ROW LEVEL SECURITY;

CREATE POLICY guardians_tenant_select ON public.guardians
  FOR SELECT TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id());

CREATE POLICY guardians_tenant_insert ON public.guardians
  FOR INSERT TO PUBLIC
  WITH CHECK (tenant_id = public.current_app_tenant_id());

CREATE POLICY guardians_tenant_update ON public.guardians
  FOR UPDATE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id())
  WITH CHECK (tenant_id = public.current_app_tenant_id());

CREATE POLICY guardians_tenant_delete ON public.guardians
  FOR DELETE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id());

ALTER TABLE public.player_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_enrollments FORCE ROW LEVEL SECURITY;

CREATE POLICY player_enrollments_tenant_select ON public.player_enrollments
  FOR SELECT TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id());

CREATE POLICY player_enrollments_tenant_insert ON public.player_enrollments
  FOR INSERT TO PUBLIC
  WITH CHECK (tenant_id = public.current_app_tenant_id());

CREATE POLICY player_enrollments_tenant_update ON public.player_enrollments
  FOR UPDATE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id())
  WITH CHECK (tenant_id = public.current_app_tenant_id());

CREATE POLICY player_enrollments_tenant_delete ON public.player_enrollments
  FOR DELETE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id());

-- 7. Grant Privileges to Runtime Role if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_runtime_ci') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.players, public.guardians, public.player_enrollments TO academy_runtime_ci;
    REVOKE TRUNCATE ON TABLE public.players, public.guardians, public.player_enrollments FROM academy_runtime_ci;
  END IF;
END $$;
