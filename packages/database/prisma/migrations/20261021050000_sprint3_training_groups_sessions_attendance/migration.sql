-- Sprint 3 Database Migration: Training Groups, Recurring Schedules, Coach & Player Assignments,
-- Temporary QR Check-In, and Append-Only Attendance Event Stream.

-- 1. Create Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GroupStatus') THEN
    CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GroupMemberStatus') THEN
    CREATE TYPE "GroupMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScheduleStatus') THEN
    CREATE TYPE "ScheduleStatus" AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceEventSource') THEN
    CREATE TYPE "AttendanceEventSource" AS ENUM ('MANUAL', 'QR_CHECKIN', 'BULK_MARK', 'SYSTEM');
  END IF;
END $$;

-- 2. Training Groups Table
CREATE TABLE IF NOT EXISTS "training_groups" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "sport" "SportCode" NOT NULL DEFAULT 'FOOTBALL',
  "name" TEXT NOT NULL,
  "description" TEXT,
  "age_category" TEXT,
  "capacity" INTEGER,
  "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "training_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "training_groups_tenant_id_id_key" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "training_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "training_groups_tenant_id_branch_id_fkey" FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "training_groups_tenant_id_idx" ON "training_groups"("tenant_id");
CREATE INDEX IF NOT EXISTS "training_groups_branch_id_idx" ON "training_groups"("branch_id");
CREATE INDEX IF NOT EXISTS "training_groups_tenant_id_status_idx" ON "training_groups"("tenant_id", "status");

-- 3. Group Coaches Assignment Table
CREATE TABLE IF NOT EXISTS "group_coaches" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "coach_user_id" UUID NOT NULL,
  "is_head_coach" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "group_coaches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "group_coaches_tenant_id_id_key" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "group_coaches_group_id_coach_user_id_key" UNIQUE ("group_id", "coach_user_id"),
  CONSTRAINT "group_coaches_tenant_id_group_id_fkey" FOREIGN KEY ("tenant_id", "group_id") REFERENCES "training_groups"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "group_coaches_coach_user_id_fkey" FOREIGN KEY ("coach_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "group_coaches_tenant_id_idx" ON "group_coaches"("tenant_id");
CREATE INDEX IF NOT EXISTS "group_coaches_coach_user_id_idx" ON "group_coaches"("coach_user_id");

-- 4. Group Members Assignment Table
CREATE TABLE IF NOT EXISTS "group_members" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "status" "GroupMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "start_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "end_date" DATE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "group_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "group_members_tenant_id_id_key" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "group_members_group_id_player_id_key" UNIQUE ("group_id", "player_id"),
  CONSTRAINT "group_members_tenant_id_group_id_fkey" FOREIGN KEY ("tenant_id", "group_id") REFERENCES "training_groups"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "group_members_tenant_id_player_id_fkey" FOREIGN KEY ("tenant_id", "player_id") REFERENCES "players"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "group_members_tenant_id_idx" ON "group_members"("tenant_id");
CREATE INDEX IF NOT EXISTS "group_members_player_id_idx" ON "group_members"("player_id");
CREATE INDEX IF NOT EXISTS "group_members_group_id_status_idx" ON "group_members"("group_id", "status");

-- 5. Training Schedules Table
CREATE TABLE IF NOT EXISTS "training_schedules" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "location" TEXT,
  "status" "ScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "training_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "training_schedules_tenant_id_id_key" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "training_schedules_tenant_id_group_id_fkey" FOREIGN KEY ("tenant_id", "group_id") REFERENCES "training_groups"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "training_schedules_tenant_id_idx" ON "training_schedules"("tenant_id");
CREATE INDEX IF NOT EXISTS "training_schedules_group_id_idx" ON "training_schedules"("group_id");

-- 6. Enhance Attendance Sessions
ALTER TABLE "attendance_sessions"
  ADD COLUMN IF NOT EXISTS "group_id" UUID,
  ADD COLUMN IF NOT EXISTS "coach_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "qr_code_secret" TEXT,
  ADD COLUMN IF NOT EXISTS "qr_code_expires_at" TIMESTAMPTZ(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'attendance_sessions_tenant_id_group_id_fkey'
  ) THEN
    ALTER TABLE "attendance_sessions"
      ADD CONSTRAINT "attendance_sessions_tenant_id_group_id_fkey"
      FOREIGN KEY ("tenant_id", "group_id") REFERENCES "training_groups"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'attendance_sessions_coach_user_id_fkey'
  ) THEN
    ALTER TABLE "attendance_sessions"
      ADD CONSTRAINT "attendance_sessions_coach_user_id_fkey"
      FOREIGN KEY ("coach_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "attendance_sessions_group_id_idx" ON "attendance_sessions"("group_id");
CREATE INDEX IF NOT EXISTS "attendance_sessions_coach_user_id_idx" ON "attendance_sessions"("coach_user_id");

-- 7. Append-Only Attendance Event Log
CREATE TABLE IF NOT EXISTS "attendance_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "record_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "previous_status" "AttendanceStatus",
  "new_status" "AttendanceStatus" NOT NULL,
  "source" "AttendanceEventSource" NOT NULL DEFAULT 'MANUAL',
  "reason" TEXT,
  "metadata" JSONB,
  "event_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_events_tenant_id_id_key" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "attendance_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_events_tenant_id_record_id_fkey" FOREIGN KEY ("tenant_id", "record_id") REFERENCES "attendance_records"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_events_tenant_id_session_id_fkey" FOREIGN KEY ("tenant_id", "session_id") REFERENCES "attendance_sessions"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_events_tenant_id_player_id_fkey" FOREIGN KEY ("tenant_id", "player_id") REFERENCES "players"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "attendance_events_tenant_id_event_at_idx" ON "attendance_events"("tenant_id", "event_at");
CREATE INDEX IF NOT EXISTS "attendance_events_session_id_idx" ON "attendance_events"("session_id");
CREATE INDEX IF NOT EXISTS "attendance_events_player_id_idx" ON "attendance_events"("player_id");
CREATE INDEX IF NOT EXISTS "attendance_events_record_id_idx" ON "attendance_events"("record_id");

-- 8. Immutable Trigger on attendance_events
CREATE OR REPLACE FUNCTION prevent_attendance_events_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'attendance_events is append-only: updates and deletes are strictly prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_events_immutable ON "attendance_events";
CREATE TRIGGER trg_attendance_events_immutable
BEFORE UPDATE OR DELETE ON "attendance_events"
FOR EACH ROW EXECUTE FUNCTION prevent_attendance_events_mutation();

-- 9. PostgreSQL Row Level Security (RLS) - Force on all new tables
ALTER TABLE "training_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_groups" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_training_groups ON "training_groups";
CREATE POLICY tenant_isolation_training_groups ON "training_groups"
FOR ALL
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "group_coaches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_coaches" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_group_coaches ON "group_coaches";
CREATE POLICY tenant_isolation_group_coaches ON "group_coaches"
FOR ALL
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_members" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_group_members ON "group_members";
CREATE POLICY tenant_isolation_group_members ON "group_members"
FOR ALL
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "training_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_schedules" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_training_schedules ON "training_schedules";
CREATE POLICY tenant_isolation_training_schedules ON "training_schedules"
FOR ALL
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "attendance_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_events" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_attendance_events ON "attendance_events";
CREATE POLICY tenant_isolation_attendance_events ON "attendance_events"
FOR ALL
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 10. Role Grants for academy_runtime_ci and academy_app_user
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_runtime_ci') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.training_groups, public.group_coaches, public.group_members, public.training_schedules TO academy_runtime_ci;
    GRANT SELECT, INSERT ON TABLE public.attendance_events TO academy_runtime_ci;
    REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.attendance_events FROM academy_runtime_ci;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.training_groups, public.group_coaches, public.group_members, public.training_schedules TO academy_app_user;
    GRANT SELECT, INSERT ON TABLE public.attendance_events TO academy_app_user;
    REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.attendance_events FROM academy_app_user;
  END IF;
END $$;
