-- Migration: 20261021060000_performance_evaluations_and_portals
-- Implements:
-- 1. Platform Super Admin flag on Users
-- 2. Player and Guardian User identity account links & claims
-- 3. Evaluation Criteria Templates with RLS
-- 4. Player Performance Evaluations with RLS, auditability and optimistic concurrency

-- 1. User Platform Super Admin flag
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "is_platform_super_admin" BOOLEAN NOT NULL DEFAULT false;

-- 2. Player Account Link & Claims
ALTER TABLE "public"."players" ADD COLUMN IF NOT EXISTS "user_id" UUID;
ALTER TABLE "public"."players" ADD COLUMN IF NOT EXISTS "claim_token" TEXT;
ALTER TABLE "public"."players" ADD COLUMN IF NOT EXISTS "claim_expires_at" TIMESTAMPTZ(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = 'players' AND indexname = 'players_user_id_key'
  ) THEN
    CREATE UNIQUE INDEX "players_user_id_key" ON "public"."players"("user_id") WHERE "user_id" IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' AND table_name = 'players' AND constraint_name = 'players_user_id_fkey'
  ) THEN
    ALTER TABLE "public"."players" ADD CONSTRAINT "players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Guardian Account Link & Claims
ALTER TABLE "public"."guardians" ADD COLUMN IF NOT EXISTS "user_id" UUID;
ALTER TABLE "public"."guardians" ADD COLUMN IF NOT EXISTS "claim_token" TEXT;
ALTER TABLE "public"."guardians" ADD COLUMN IF NOT EXISTS "claim_expires_at" TIMESTAMPTZ(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = 'guardians' AND indexname = 'guardians_user_id_idx'
  ) THEN
    CREATE INDEX "guardians_user_id_idx" ON "public"."guardians"("user_id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' AND table_name = 'guardians' AND constraint_name = 'guardians_user_id_fkey'
  ) THEN
    ALTER TABLE "public"."guardians" ADD CONSTRAINT "guardians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Evaluation Templates Table
CREATE TABLE IF NOT EXISTS "public"."evaluation_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "sport" "SportCode" NOT NULL DEFAULT 'FOOTBALL',
  "age_category" VARCHAR(50),
  "name" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "criteria" JSONB NOT NULL DEFAULT '[]',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "evaluation_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "evaluation_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "evaluation_templates_tenant_id_id_key" ON "public"."evaluation_templates"("tenant_id", "id");
CREATE INDEX IF NOT EXISTS "evaluation_templates_tenant_id_idx" ON "public"."evaluation_templates"("tenant_id");
CREATE INDEX IF NOT EXISTS "evaluation_templates_tenant_id_sport_age_category_idx" ON "public"."evaluation_templates"("tenant_id", "sport", "age_category");

ALTER TABLE "public"."evaluation_templates" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'evaluation_templates' 
      AND policyname = 'tenant_isolation_evaluation_templates'
  ) THEN
    CREATE POLICY "tenant_isolation_evaluation_templates" ON "public"."evaluation_templates"
      FOR ALL
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;
END $$;

-- 5. Player Evaluations Table
CREATE TABLE IF NOT EXISTS "public"."player_evaluations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "session_id" UUID,
  "evaluator_user_id" UUID NOT NULL,
  "template_id" UUID,
  "evaluation_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "technical_score" DOUBLE PRECISION NOT NULL,
  "tactical_score" DOUBLE PRECISION NOT NULL,
  "physical_score" DOUBLE PRECISION NOT NULL,
  "behavioral_score" DOUBLE PRECISION NOT NULL,
  "overall_score" DOUBLE PRECISION NOT NULL,
  "metrics" JSONB NOT NULL DEFAULT '{}',
  "strengths" TEXT,
  "areas_for_improvement" TEXT,
  "private_coach_notes" TEXT,
  "guardian_feedback" TEXT,
  "suggested_goals" TEXT,
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "player_evaluations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_evaluations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_evaluations_player_id_fkey" FOREIGN KEY ("tenant_id", "player_id") REFERENCES "public"."players"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_evaluations_session_id_fkey" FOREIGN KEY ("tenant_id", "session_id") REFERENCES "public"."attendance_sessions"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "player_evaluations_evaluator_user_id_fkey" FOREIGN KEY ("evaluator_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "player_evaluations_template_id_fkey" FOREIGN KEY ("tenant_id", "template_id") REFERENCES "public"."evaluation_templates"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "player_evaluations_tenant_id_id_key" ON "public"."player_evaluations"("tenant_id", "id");
CREATE INDEX IF NOT EXISTS "player_evaluations_tenant_id_idx" ON "public"."player_evaluations"("tenant_id");
CREATE INDEX IF NOT EXISTS "player_evaluations_tenant_id_player_id_idx" ON "public"."player_evaluations"("tenant_id", "player_id");
CREATE INDEX IF NOT EXISTS "player_evaluations_tenant_id_session_id_idx" ON "public"."player_evaluations"("tenant_id", "session_id");
CREATE INDEX IF NOT EXISTS "player_evaluations_tenant_id_evaluator_user_id_idx" ON "public"."player_evaluations"("tenant_id", "evaluator_user_id");
CREATE INDEX IF NOT EXISTS "player_evaluations_tenant_id_evaluation_date_idx" ON "public"."player_evaluations"("tenant_id", "evaluation_date");
CREATE INDEX IF NOT EXISTS "player_evaluations_tenant_id_overall_score_idx" ON "public"."player_evaluations"("tenant_id", "overall_score");

ALTER TABLE "public"."player_evaluations" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'player_evaluations' 
      AND policyname = 'tenant_isolation_player_evaluations'
  ) THEN
    CREATE POLICY "tenant_isolation_player_evaluations" ON "public"."player_evaluations"
      FOR ALL
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;
END $$;

-- 6. Grants for academy_runtime_ci
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'academy_runtime_ci') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.evaluation_templates, public.player_evaluations TO academy_runtime_ci;
    GRANT UPDATE (user_id, claim_token, claim_expires_at) ON TABLE public.players, public.guardians TO academy_runtime_ci;
    GRANT SELECT (is_platform_super_admin) ON TABLE public.users TO academy_runtime_ci;
  END IF;
END $$;
