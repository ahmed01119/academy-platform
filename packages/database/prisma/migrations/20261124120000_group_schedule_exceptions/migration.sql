-- Owner request 2026-11-24: a group has a fixed weekly timetable (training_schedules). The admin can change one
-- occurrence without touching the timetable: cancel it, move it to another date/time, or add an extra session. The coach
-- and the players are notified of each change. Changing the fixed timetable itself stays an update of
-- training_schedules.
--
-- schedule_exceptions holds those one-off changes:
--   CANCELLED  schedule_id + original_date                          (that occurrence does not take place)
--   MOVED      schedule_id + original_date + session_date/start/end (that occurrence takes place at another time)
--   EXTRA      session_date/start/end                               (an additional session for the group)
-- One change per occurrence (unique schedule_id + original_date). Additive only: no existing row changes.

CREATE TYPE "ScheduleExceptionKind" AS ENUM ('CANCELLED', 'MOVED', 'EXTRA');

CREATE TABLE "schedule_exceptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "schedule_id" UUID,
  "kind" "ScheduleExceptionKind" NOT NULL,
  "original_date" DATE,
  "session_date" DATE,
  "start_time" TEXT,
  "end_time" TEXT,
  "location" TEXT,
  "reason" TEXT,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_exceptions_tenant_id_id_key" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "schedule_exceptions_tenant_id_group_id_fkey" FOREIGN KEY ("tenant_id", "group_id")
    REFERENCES "training_groups"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedule_exceptions_tenant_id_schedule_id_fkey" FOREIGN KEY ("tenant_id", "schedule_id")
    REFERENCES "training_schedules"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedule_exceptions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id")
    REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "schedule_exceptions_shape" CHECK (
    CASE "kind"
      WHEN 'CANCELLED' THEN "schedule_id" IS NOT NULL AND "original_date" IS NOT NULL
      WHEN 'MOVED' THEN "schedule_id" IS NOT NULL AND "original_date" IS NOT NULL
        AND "session_date" IS NOT NULL AND "start_time" IS NOT NULL AND "end_time" IS NOT NULL
      WHEN 'EXTRA' THEN "session_date" IS NOT NULL AND "start_time" IS NOT NULL AND "end_time" IS NOT NULL
    END
  ),
  CONSTRAINT "schedule_exceptions_times" CHECK (
    ("start_time" IS NULL AND "end_time" IS NULL)
    OR ("start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "start_time" < "end_time")
  )
);

CREATE INDEX "schedule_exceptions_tenant_id_idx" ON "schedule_exceptions"("tenant_id");
CREATE INDEX "schedule_exceptions_group_id_session_date_idx" ON "schedule_exceptions"("group_id", "session_date");
CREATE INDEX "schedule_exceptions_group_id_original_date_idx" ON "schedule_exceptions"("group_id", "original_date");
CREATE UNIQUE INDEX "schedule_exceptions_one_change_per_occurrence"
  ON "schedule_exceptions"("schedule_id", "original_date") WHERE "original_date" IS NOT NULL;

-- Tenant isolation, as for training_schedules.
ALTER TABLE "schedule_exceptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "schedule_exceptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_schedule_exceptions ON "schedule_exceptions"
  FOR ALL
  USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Player / guardian portal (no tenant context): read the timetable and its changes for the groups of the user's own
-- player(s). group_members is already limited to those players by group_members_portal_user. SELECT only.
DROP POLICY IF EXISTS training_schedules_portal_user ON public.training_schedules;
CREATE POLICY training_schedules_portal_user ON public.training_schedules
  FOR SELECT TO PUBLIC
  USING (group_id IN (SELECT gm.group_id FROM public.group_members gm));
CREATE POLICY schedule_exceptions_portal_user ON public.schedule_exceptions
  FOR SELECT TO PUBLIC
  USING (group_id IN (SELECT gm.group_id FROM public.group_members gm));

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app', 'academy_app_user'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.schedule_exceptions TO %I', r);
    EXECUTE format('REVOKE TRUNCATE ON TABLE public.schedule_exceptions FROM %I', r);
  END LOOP;
END
$$;
