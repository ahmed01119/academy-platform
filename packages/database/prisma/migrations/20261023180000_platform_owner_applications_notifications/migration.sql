-- Platform owner flag, academy/player applications, and in-app notifications.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_platform_owner" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING_REVIEW', 'MORE_INFO_REQUESTED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'ACADEMY_APPLICATION',
    'PLAYER_REGISTRATION',
    'EXPENSE_APPROVAL',
    'EVALUATION_PUBLISHED',
    'SUBSCRIPTION',
    'SECURITY',
    'SYSTEM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "academy_applications" (
  "id" UUID NOT NULL,
  "applicant_user_id" UUID NOT NULL,
  "academy_name" TEXT NOT NULL,
  "academy_slug" TEXT NOT NULL,
  "sport" "SportCode" NOT NULL DEFAULT 'FOOTBALL',
  "city" TEXT,
  "contact_phone" TEXT,
  "contact_email" TEXT NOT NULL,
  "notes" TEXT,
  "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "review_notes" TEXT,
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMPTZ(3),
  "provisioned_tenant_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "academy_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "player_registration_requests" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "applicant_user_id" UUID,
  "player_name" TEXT NOT NULL,
  "contact_email" TEXT NOT NULL,
  "contact_phone" TEXT,
  "date_of_birth" DATE,
  "guardian_name" TEXT,
  "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "review_notes" TEXT,
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_registration_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "app_notifications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "tenant_id" UUID,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT,
  "read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_notifications_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "academy_applications"
    ADD CONSTRAINT "academy_applications_applicant_user_id_fkey"
    FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "academy_applications"
    ADD CONSTRAINT "academy_applications_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "player_registration_requests"
    ADD CONSTRAINT "player_registration_requests_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "player_registration_requests"
    ADD CONSTRAINT "player_registration_requests_applicant_user_id_fkey"
    FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "player_registration_requests"
    ADD CONSTRAINT "player_registration_requests_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "app_notifications"
    ADD CONSTRAINT "app_notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "app_notifications"
    ADD CONSTRAINT "app_notifications_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "academy_applications_status_created_at_idx"
  ON "academy_applications"("status", "created_at");
CREATE INDEX IF NOT EXISTS "academy_applications_applicant_user_id_idx"
  ON "academy_applications"("applicant_user_id");
CREATE INDEX IF NOT EXISTS "academy_applications_academy_slug_idx"
  ON "academy_applications"("academy_slug");
CREATE INDEX IF NOT EXISTS "player_registration_requests_tenant_id_status_idx"
  ON "player_registration_requests"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "app_notifications_user_id_created_at_idx"
  ON "app_notifications"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "app_notifications_user_id_read_at_idx"
  ON "app_notifications"("user_id", "read_at");

ALTER TABLE "academy_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_registration_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academy_applications" FORCE ROW LEVEL SECURITY;
ALTER TABLE "player_registration_requests" FORCE ROW LEVEL SECURITY;
ALTER TABLE "app_notifications" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS academy_applications_platform_admin ON public.academy_applications;
CREATE POLICY academy_applications_platform_admin ON public.academy_applications
  FOR ALL TO PUBLIC
  USING (public.is_current_user_super_admin())
  WITH CHECK (public.is_current_user_super_admin());

DROP POLICY IF EXISTS academy_applications_applicant ON public.academy_applications;
CREATE POLICY academy_applications_applicant ON public.academy_applications
  FOR SELECT TO PUBLIC
  USING (applicant_user_id = public.current_app_user_id());

DROP POLICY IF EXISTS player_registration_requests_tenant ON public.player_registration_requests;
CREATE POLICY player_registration_requests_tenant ON public.player_registration_requests
  FOR ALL TO PUBLIC
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS app_notifications_owner ON public.app_notifications;
CREATE POLICY app_notifications_owner ON public.app_notifications
  FOR ALL TO PUBLIC
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS app_notifications_platform_admin ON public.app_notifications;
CREATE POLICY app_notifications_platform_admin ON public.app_notifications
  FOR ALL TO PUBLIC
  USING (public.is_current_user_super_admin());

CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT is_platform_super_admin OR is_platform_owner
      FROM public.users
      WHERE id = public.current_app_user_id()
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_platform_owner()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT is_platform_owner
      FROM public.users
      WHERE id = public.current_app_user_id()
    ),
    false
  );
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_runtime_ci') THEN
    GRANT SELECT (is_platform_owner) ON TABLE public.users TO academy_runtime_ci;
    GRANT SELECT, INSERT, UPDATE ON TABLE public.academy_applications TO academy_runtime_ci;
    GRANT SELECT, INSERT, UPDATE ON TABLE public.player_registration_requests TO academy_runtime_ci;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_notifications TO academy_runtime_ci;
    GRANT EXECUTE ON FUNCTION public.is_current_user_platform_owner() TO academy_runtime_ci;
    GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO academy_runtime_ci;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_runtime') THEN
    GRANT SELECT (is_platform_owner) ON TABLE public.users TO academy_runtime;
    GRANT SELECT, INSERT, UPDATE ON TABLE public.academy_applications TO academy_runtime;
    GRANT SELECT, INSERT, UPDATE ON TABLE public.player_registration_requests TO academy_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_notifications TO academy_runtime;
    GRANT EXECUTE ON FUNCTION public.is_current_user_platform_owner() TO academy_runtime;
    GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO academy_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_app_user') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.academy_applications TO academy_app_user;
    GRANT SELECT, INSERT, UPDATE ON TABLE public.player_registration_requests TO academy_app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_notifications TO academy_app_user;
    GRANT EXECUTE ON FUNCTION public.is_current_user_platform_owner() TO academy_app_user;
    GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO academy_app_user;
  END IF;
END $$;
