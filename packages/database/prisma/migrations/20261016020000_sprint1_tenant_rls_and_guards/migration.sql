-- Migration: Sprint 1 Tenant RLS, Foreign Key Composite Safeguards, and Append-Only Attendance Corrections

-- CreateTable: attendance_idempotency
CREATE TABLE "attendance_idempotency" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "session_id" UUID NOT NULL,
    "response" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_idempotency_pkey" PRIMARY KEY ("id")
);

-- Indexes for attendance_idempotency
CREATE UNIQUE INDEX "attendance_idempotency_tenant_id_key_key" ON "attendance_idempotency"("tenant_id", "key");
CREATE INDEX "attendance_idempotency_tenant_id_idx" ON "attendance_idempotency"("tenant_id");
CREATE INDEX "attendance_idempotency_session_id_idx" ON "attendance_idempotency"("session_id");

-- Foreign keys for attendance_idempotency
ALTER TABLE "attendance_idempotency" ADD CONSTRAINT "attendance_idempotency_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_idempotency" ADD CONSTRAINT "attendance_idempotency_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Composite Unique Constraints to prevent cross-tenant referencing
CREATE UNIQUE INDEX "branches_tenant_id_id_key" ON "branches"("tenant_id", "id");
CREATE UNIQUE INDEX "attendance_sessions_tenant_id_id_key" ON "attendance_sessions"("tenant_id", "id");
CREATE UNIQUE INDEX "attendance_records_tenant_id_id_key" ON "attendance_records"("tenant_id", "id");

-- Drop existing single-column foreign keys that could allow cross-tenant referencing
ALTER TABLE "attendance_sessions" DROP CONSTRAINT IF EXISTS "attendance_sessions_branch_id_fkey";
ALTER TABLE "attendance_records" DROP CONSTRAINT IF EXISTS "attendance_records_session_id_fkey";
ALTER TABLE "attendance_corrections" DROP CONSTRAINT IF EXISTS "attendance_corrections_record_id_fkey";
ALTER TABLE "tenant_memberships" DROP CONSTRAINT IF EXISTS "tenant_memberships_branch_id_fkey";
ALTER TABLE "invitations" DROP CONSTRAINT IF EXISTS "invitations_branch_id_fkey";

-- Add composite foreign keys referencing (tenant_id, id)
ALTER TABLE "attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_tenant_id_branch_id_fkey"
  FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_records"
  ADD CONSTRAINT "attendance_records_tenant_id_session_id_fkey"
  FOREIGN KEY ("tenant_id", "session_id") REFERENCES "attendance_sessions"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_corrections"
  ADD CONSTRAINT "attendance_corrections_tenant_id_record_id_fkey"
  FOREIGN KEY ("tenant_id", "record_id") REFERENCES "attendance_records"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_memberships"
  ADD CONSTRAINT "tenant_memberships_tenant_id_branch_id_fkey"
  FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_tenant_id_branch_id_fkey"
  FOREIGN KEY ("tenant_id", "branch_id") REFERENCES "branches"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Helper function: current_app_user_id()
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN current_setting('app.actor_user_id', true) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN current_setting('app.actor_user_id', true)::uuid
    WHEN current_setting('app.current_actor_user_id', true) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN current_setting('app.current_actor_user_id', true)::uuid
    ELSE NULL
  END
$$;

-- ----------------------------------------------------
-- Row Level Security (RLS) for tenant_memberships
-- ----------------------------------------------------
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_memberships_tenant_select ON public.tenant_memberships
  FOR SELECT TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
    OR (
      public.current_app_tenant_id() IS NULL
      AND (
        user_id = public.current_app_user_id()
        OR current_setting('app.auth_context', true) = 'auth_discovery'
      )
    )
  );

CREATE POLICY tenant_memberships_tenant_insert ON public.tenant_memberships
  FOR INSERT TO PUBLIC
  WITH CHECK (
    tenant_id = public.current_app_tenant_id()
    OR current_setting('app.auth_context', true) = 'auth_discovery'
  );

CREATE POLICY tenant_memberships_tenant_update ON public.tenant_memberships
  FOR UPDATE TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
    OR current_setting('app.auth_context', true) = 'auth_discovery'
  )
  WITH CHECK (
    tenant_id = public.current_app_tenant_id()
    OR current_setting('app.auth_context', true) = 'auth_discovery'
  );

CREATE POLICY tenant_memberships_tenant_delete ON public.tenant_memberships
  FOR DELETE TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
  );

-- ----------------------------------------------------
-- Row Level Security (RLS) for invitations
-- ----------------------------------------------------
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY invitations_tenant_select ON public.invitations
  FOR SELECT TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
    OR current_setting('app.auth_context', true) = 'invitation_lookup'
  );

CREATE POLICY invitations_tenant_insert ON public.invitations
  FOR INSERT TO PUBLIC
  WITH CHECK (
    tenant_id = public.current_app_tenant_id()
  );

CREATE POLICY invitations_tenant_update ON public.invitations
  FOR UPDATE TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
    OR current_setting('app.auth_context', true) = 'invitation_lookup'
  )
  WITH CHECK (
    tenant_id = public.current_app_tenant_id()
    OR current_setting('app.auth_context', true) = 'invitation_lookup'
  );

CREATE POLICY invitations_tenant_delete ON public.invitations
  FOR DELETE TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
  );

-- ----------------------------------------------------
-- Row Level Security (RLS) for attendance_sessions
-- ----------------------------------------------------
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY attendance_sessions_tenant_select ON public.attendance_sessions
  FOR SELECT TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id());

CREATE POLICY attendance_sessions_tenant_insert ON public.attendance_sessions
  FOR INSERT TO PUBLIC
  WITH CHECK (tenant_id = public.current_app_tenant_id());

CREATE POLICY attendance_sessions_tenant_update ON public.attendance_sessions
  FOR UPDATE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id())
  WITH CHECK (tenant_id = public.current_app_tenant_id());

CREATE POLICY attendance_sessions_tenant_delete ON public.attendance_sessions
  FOR DELETE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id());

-- ----------------------------------------------------
-- Row Level Security (RLS) for attendance_records
-- ----------------------------------------------------
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records FORCE ROW LEVEL SECURITY;

CREATE POLICY attendance_records_tenant_select ON public.attendance_records
  FOR SELECT TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id());

CREATE POLICY attendance_records_tenant_insert ON public.attendance_records
  FOR INSERT TO PUBLIC
  WITH CHECK (tenant_id = public.current_app_tenant_id());

CREATE POLICY attendance_records_tenant_update ON public.attendance_records
  FOR UPDATE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id())
  WITH CHECK (tenant_id = public.current_app_tenant_id());

CREATE POLICY attendance_records_tenant_delete ON public.attendance_records
  FOR DELETE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id());

-- ----------------------------------------------------
-- Row Level Security (RLS) and Append-Only for attendance_corrections
-- ----------------------------------------------------
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections FORCE ROW LEVEL SECURITY;

CREATE POLICY attendance_corrections_tenant_select ON public.attendance_corrections
  FOR SELECT TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id());

CREATE POLICY attendance_corrections_tenant_insert ON public.attendance_corrections
  FOR INSERT TO PUBLIC
  WITH CHECK (tenant_id = public.current_app_tenant_id());

-- Trigger to enforce append-only behavior on attendance_corrections
CREATE OR REPLACE FUNCTION public.prevent_attendance_correction_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'attendance_corrections are append-only: % is forbidden', TG_OP
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER attendance_corrections_append_only
BEFORE UPDATE OR DELETE ON public.attendance_corrections
FOR EACH ROW EXECUTE FUNCTION public.prevent_attendance_correction_mutation();

-- ----------------------------------------------------
-- Row Level Security (RLS) for attendance_idempotency
-- ----------------------------------------------------
ALTER TABLE public.attendance_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_idempotency FORCE ROW LEVEL SECURITY;

CREATE POLICY attendance_idempotency_tenant_select ON public.attendance_idempotency
  FOR SELECT TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id());

CREATE POLICY attendance_idempotency_tenant_insert ON public.attendance_idempotency
  FOR INSERT TO PUBLIC
  WITH CHECK (tenant_id = public.current_app_tenant_id());

CREATE POLICY attendance_idempotency_tenant_update ON public.attendance_idempotency
  FOR UPDATE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id())
  WITH CHECK (tenant_id = public.current_app_tenant_id());

CREATE POLICY attendance_idempotency_tenant_delete ON public.attendance_idempotency
  FOR DELETE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id());

-- ----------------------------------------------------
-- Discovery policies for tenants and branches
-- ----------------------------------------------------
CREATE POLICY tenants_auth_discovery ON public.tenants
  FOR SELECT TO PUBLIC
  USING (
    public.current_app_tenant_id() IS NULL
    AND (
      id IN (
        SELECT tm.tenant_id
        FROM public.tenant_memberships tm
        WHERE tm.user_id = public.current_app_user_id()
      )
      OR current_setting('app.auth_context', true) = 'auth_discovery'
      OR current_setting('app.auth_context', true) = 'invitation_lookup'
    )
  );

CREATE POLICY branches_auth_discovery ON public.branches
  FOR SELECT TO PUBLIC
  USING (
    public.current_app_tenant_id() IS NULL
    AND (
      id IN (
        SELECT tm.branch_id
        FROM public.tenant_memberships tm
        WHERE tm.user_id = public.current_app_user_id()
          AND tm.branch_id IS NOT NULL
      )
      OR current_setting('app.auth_context', true) = 'auth_discovery'
    )
  );
