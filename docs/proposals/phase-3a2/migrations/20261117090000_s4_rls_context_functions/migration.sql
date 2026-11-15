-- =====================================================================================================================
-- M2 (Phase 3A.2, S4 + context functions for S3). DRAFT FOR REVIEW - not in prisma/migrations, not applied anywhere
-- except the isolated test database.
--
-- Purpose
--   1. S4: remove anonymous access to academy_applications (introduced by 20261104105500, which Neon recorded as
--      applied without running it) and restrict which columns the runtime role may write.
--   2. Give every context-free query from the S3 audit a safe path under a restricted, non-BYPASSRLS runtime role:
--      RLS policies for own rows, or a narrow SECURITY DEFINER function with its own authorization checks.
--   3. Make the validated functions the ONLY write path for audit logs, notifications and join requests by revoking
--      the runtime role's direct INSERT (otherwise the checks could be bypassed).
--
-- Safety
--   * Idempotent: DROP ... IF EXISTS / CREATE OR REPLACE / REVOKE / GRANT; safe to re-run after a partial failure.
--   * Works on both histories: Neon (20261104105500 never executed) and fresh databases (it was executed).
--   * The owner / BYPASSRLS role (current Neon API connection) is unaffected by every REVOKE and policy here, so the
--     currently deployed code keeps working until the runtime-role switch.
--   * One data change: plaintext portal claim codes are replaced by their SHA-256 hash (section 7). Outstanding codes
--     stay valid because the new code path hashes the submitted code the same way.
--
-- Runtime roles: academy_runtime (self-host/VPS), academy_runtime_ci (CI), sportexus_app (Neon). Each grant runs only
-- if the role exists. academy_app_user (legacy name from 20261023180000) is included in every REVOKE.
--
-- Rollback (as a NEW forward migration; never edit _prisma_migrations): see the end of this file.
-- =====================================================================================================================


-- ---------------------------------------------------------------------------------------------------------------------
-- 1. RLS helper hardening
-- ---------------------------------------------------------------------------------------------------------------------
-- A suspended platform administrator no longer satisfies the platform-admin policies (login already refuses them;
-- this closes the gap for any path that does not go through login). Body otherwise unchanged.
-- No SET search_path on these four SQL helpers, on purpose: a SET clause stops PostgreSQL from inlining a SQL function,
-- and these run once per row inside RLS policies. They are not exposed to search_path hijacking: every relation is
-- schema-qualified and current_setting / operators / casts resolve in pg_catalog, which is always searched first.
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT (is_platform_super_admin OR is_platform_owner) AND NOT is_suspended
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
      SELECT is_platform_owner AND NOT is_suspended
      FROM public.users
      WHERE id = public.current_app_user_id()
    ),
    false
  );
$$;

-- Trigger functions (plpgsql, never inlined): pin search_path without changing their bodies.
ALTER FUNCTION public.prevent_audit_log_mutation() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_attendance_correction_mutation() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_attendance_events_mutation() SET search_path = public, pg_temp;


-- ---------------------------------------------------------------------------------------------------------------------
-- 2. academy_applications (S4)
-- ---------------------------------------------------------------------------------------------------------------------
-- Final policy set:
--   academy_applications_platform_admin  (unchanged)  ALL     super admin / platform owner (not suspended)
--   academy_applications_applicant       (re-created) SELECT  own rows only, any status; NO anonymous clause
--   academy_applications_insert          (re-created) INSERT  own row, PENDING_REVIEW, review fields empty
DROP POLICY IF EXISTS academy_applications_applicant ON public.academy_applications;
CREATE POLICY academy_applications_applicant ON public.academy_applications
  FOR SELECT TO PUBLIC
  USING (applicant_user_id = public.current_app_user_id());

DROP POLICY IF EXISTS academy_applications_insert ON public.academy_applications;
CREATE POLICY academy_applications_insert ON public.academy_applications
  FOR INSERT TO PUBLIC
  WITH CHECK (
    applicant_user_id = public.current_app_user_id()
    AND status = 'PENDING_REVIEW'
    AND review_notes IS NULL
    AND reviewed_by_user_id IS NULL
    AND reviewed_at IS NULL
    AND provisioned_tenant_id IS NULL
  );

-- Slug availability without exposing application rows (registration runs before the applicant exists).
-- MORE_INFO_REQUESTED also reserves the slug: today's code does not, so such an application could later fail to
-- provision on a slug collision.
CREATE OR REPLACE FUNCTION public.academy_slug_in_use(p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenants WHERE slug = lower(trim(p_slug)))
      OR EXISTS (
        SELECT 1 FROM public.academy_applications
        WHERE academy_slug = lower(trim(p_slug))
          AND status IN ('PENDING_REVIEW', 'MORE_INFO_REQUESTED', 'APPROVED')
      );
$$;


-- ---------------------------------------------------------------------------------------------------------------------
-- 3. player_registration_requests
-- ---------------------------------------------------------------------------------------------------------------------
-- Same tenant rule as before, through the shared helper (the old raw ::uuid cast raised an error, instead of matching
-- nothing, when app.tenant_id held a malformed value).
DROP POLICY IF EXISTS player_registration_requests_tenant ON public.player_registration_requests;
CREATE POLICY player_registration_requests_tenant ON public.player_registration_requests
  FOR ALL TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id())
  WITH CHECK (tenant_id = public.current_app_tenant_id());

-- Login gating: the applicant sees their own requests (any status), nothing else.
DROP POLICY IF EXISTS player_registration_requests_applicant ON public.player_registration_requests;
CREATE POLICY player_registration_requests_applicant ON public.player_registration_requests
  FOR SELECT TO PUBLIC
  USING (applicant_user_id = public.current_app_user_id());


-- ---------------------------------------------------------------------------------------------------------------------
-- 4. append_audit_log: the only audit write path for the runtime role
-- ---------------------------------------------------------------------------------------------------------------------
-- Actor and tenant are NOT parameters: they are read from the transaction-local context set by the application's
-- context helpers (withTenantTransaction after TenantGuard; withAuthLookupTransaction / withPlatformAdminTransaction /
-- withPortalUserTransaction after authentication or server-side verification). The optional p_expected_* values are
-- the caller's claims; they must match the context, which catches code that logs for one tenant while running under
-- another.
-- Authorization: an event attributed to a tenant must come from someone linked to that tenant:
--   a membership in it (any status, so the revoking/revoked step itself can be logged), or a portal link (player or
--   guardian record in it), or an active platform administrator.
-- Integrity: insert only (no UPDATE/DELETE path; the append-only trigger stays); returns only the new id.
-- Robustness: oversized client-controlled values (user agent, metadata) are truncated, never rejected, so a valid
-- business transaction is not aborted by audit formatting. Only authorization failures raise.
CREATE OR REPLACE FUNCTION public.append_audit_log(
  p_action text,
  p_resource_type text,
  p_resource_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_expected_tenant_id uuid DEFAULT NULL,
  p_expected_actor_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant uuid := public.current_app_tenant_id();
  v_actor uuid := public.current_app_user_id();
  v_metadata jsonb := p_metadata;
  v_id uuid := gen_random_uuid();
BEGIN
  IF p_action IS NULL OR p_action !~ '^[A-Z][A-Z0-9_]{2,99}$' THEN
    RAISE EXCEPTION 'AUDIT_ACTION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_resource_type IS NULL OR p_resource_type !~ '^[A-Za-z][A-Za-z0-9_]{1,63}$' THEN
    RAISE EXCEPTION 'AUDIT_RESOURCE_TYPE_INVALID' USING ERRCODE = '22023';
  END IF;

  IF p_expected_tenant_id IS NOT NULL AND p_expected_tenant_id IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION 'AUDIT_TENANT_CONTEXT_MISMATCH' USING ERRCODE = '42501';
  END IF;
  IF p_expected_actor_user_id IS NOT NULL AND p_expected_actor_user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'AUDIT_ACTOR_CONTEXT_MISMATCH' USING ERRCODE = '42501';
  END IF;

  IF v_actor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_actor) THEN
    RAISE EXCEPTION 'AUDIT_ACTOR_UNKNOWN' USING ERRCODE = '42501';
  END IF;

  IF v_tenant IS NOT NULL THEN
    IF v_actor IS NULL THEN
      RAISE EXCEPTION 'AUDIT_TENANT_EVENT_REQUIRES_ACTOR' USING ERRCODE = '42501';
    END IF;
    IF NOT (
      EXISTS (SELECT 1 FROM public.tenant_memberships WHERE tenant_id = v_tenant AND user_id = v_actor)
      OR EXISTS (SELECT 1 FROM public.players WHERE tenant_id = v_tenant AND user_id = v_actor)
      OR EXISTS (SELECT 1 FROM public.guardians WHERE tenant_id = v_tenant AND user_id = v_actor)
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = v_actor AND (is_platform_super_admin OR is_platform_owner) AND NOT is_suspended
      )
    ) THEN
      RAISE EXCEPTION 'AUDIT_ACTOR_NOT_LINKED_TO_TENANT' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_metadata IS NOT NULL AND jsonb_typeof(v_metadata) <> 'object' THEN
    v_metadata := jsonb_build_object('value', v_metadata);
  END IF;
  IF v_metadata IS NOT NULL AND octet_length(v_metadata::text) > 16384 THEN
    v_metadata := jsonb_build_object('truncated', true, 'originalBytes', octet_length(v_metadata::text));
  END IF;

  INSERT INTO public.audit_logs (
    id, tenant_id, actor_user_id, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at
  )
  VALUES (
    v_id, v_tenant, v_actor, p_action, p_resource_type, left(p_resource_id, 128), v_metadata,
    left(p_ip_address, 64), left(p_user_agent, 512), now()
  );
  RETURN v_id;
END;
$$;


-- ---------------------------------------------------------------------------------------------------------------------
-- 5. create_app_notification: the only notification write path for the runtime role
-- ---------------------------------------------------------------------------------------------------------------------
-- Sender = current_app_user_id() (required; anonymous flows notify only through submit_player_join_request).
-- Tenant notification (p_tenant_id set):
--   * must match the transaction's tenant context when one is set;
--   * sender: ACTIVE member of that tenant, or active platform administrator;
--   * recipient: ACTIVE member of that tenant, or portal-linked to it (player/guardian record), or the applicant of a
--     join request in it (reviewers notify applicants who are not members yet).
-- Platform notification (p_tenant_id NULL), allowed when:
--   * the recipient is an active platform administrator (e.g. "new academy application"), or
--   * the sender is an active platform administrator (e.g. application decisions, admin invitations), or
--   * the recipient is the sender.
-- Content: type must be a NotificationType; href must be an application-relative path (no scheme, no //host, no
-- backslash, no whitespace), so a notification can never link off-site. Long text is truncated.
CREATE OR REPLACE FUNCTION public.create_app_notification(
  p_recipient_user_id uuid,
  p_tenant_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_href text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sender uuid := public.current_app_user_id();
  v_context_tenant uuid := public.current_app_tenant_id();
  v_type public."NotificationType";
  v_sender_is_admin boolean;
  v_recipient_is_admin boolean;
  v_id uuid := gen_random_uuid();
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_SENDER_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_recipient_user_id IS NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_RECIPIENT_REQUIRED' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_type := p_type::public."NotificationType";
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'NOTIFICATION_TYPE_INVALID' USING ERRCODE = '22023';
  END;
  IF coalesce(trim(p_title), '') = '' OR coalesce(trim(p_body), '') = '' THEN
    RAISE EXCEPTION 'NOTIFICATION_CONTENT_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_href IS NOT NULL AND (
    p_href !~ '^/' OR p_href ~ '^//' OR p_href ~ '[\\[:space:]]' OR length(p_href) > 500
  ) THEN
    RAISE EXCEPTION 'NOTIFICATION_HREF_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT (is_platform_super_admin OR is_platform_owner) AND NOT is_suspended INTO v_sender_is_admin
  FROM public.users WHERE id = v_sender;
  IF v_sender_is_admin IS NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_SENDER_UNKNOWN' USING ERRCODE = '42501';
  END IF;
  SELECT (is_platform_super_admin OR is_platform_owner) AND NOT is_suspended INTO v_recipient_is_admin
  FROM public.users WHERE id = p_recipient_user_id;
  IF v_recipient_is_admin IS NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_RECIPIENT_UNKNOWN' USING ERRCODE = '22023';
  END IF;

  IF p_tenant_id IS NOT NULL THEN
    IF v_context_tenant IS NOT NULL AND v_context_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'NOTIFICATION_TENANT_CONTEXT_MISMATCH' USING ERRCODE = '42501';
    END IF;
    IF NOT (
      v_sender_is_admin
      OR EXISTS (
        SELECT 1 FROM public.tenant_memberships
        WHERE tenant_id = p_tenant_id AND user_id = v_sender AND status = 'ACTIVE'
      )
    ) THEN
      RAISE EXCEPTION 'NOTIFICATION_SENDER_NOT_IN_TENANT' USING ERRCODE = '42501';
    END IF;
    IF NOT (
      EXISTS (
        SELECT 1 FROM public.tenant_memberships
        WHERE tenant_id = p_tenant_id AND user_id = p_recipient_user_id AND status = 'ACTIVE'
      )
      OR EXISTS (SELECT 1 FROM public.players WHERE tenant_id = p_tenant_id AND user_id = p_recipient_user_id)
      OR EXISTS (SELECT 1 FROM public.guardians WHERE tenant_id = p_tenant_id AND user_id = p_recipient_user_id)
      OR EXISTS (
        SELECT 1 FROM public.player_registration_requests
        WHERE tenant_id = p_tenant_id AND applicant_user_id = p_recipient_user_id
      )
    ) THEN
      RAISE EXCEPTION 'NOTIFICATION_RECIPIENT_NOT_IN_TENANT' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT (v_recipient_is_admin OR v_sender_is_admin OR p_recipient_user_id = v_sender) THEN
    RAISE EXCEPTION 'NOTIFICATION_NOT_PERMITTED' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.app_notifications (id, user_id, tenant_id, type, title, body, href, created_at)
  VALUES (v_id, p_recipient_user_id, p_tenant_id, v_type, left(trim(p_title), 200), left(trim(p_body), 2000), p_href, now());
  RETURN v_id;
END;
$$;


-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Public directory and anonymous join requests
-- ---------------------------------------------------------------------------------------------------------------------
-- Landing-page academy list: ACTIVE tenants, directory fields only (no contact data).
CREATE OR REPLACE FUNCTION public.list_public_academies()
RETURNS TABLE (id uuid, name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.id, t.name, t.slug FROM public.tenants t WHERE t.status = 'ACTIVE' ORDER BY t.name, t.id;
$$;

-- Join request (public endpoint; applicant = current_app_user_id(), NULL when anonymous).
-- Checks: academy must be ACTIVE (today any existing academy, including SUSPENDED and PROVISIONING, accepts
-- requests); a signed-in applicant must exist and not be suspended; inputs validated; at most 5 pending requests per
-- academy and contact e-mail (anti-spam: each request notifies the academy's managers).
-- The request is always created as PENDING_REVIEW with empty review fields; reviewers' notifications are created
-- here, in the same transaction, with the same text as today. Returns only the new request's own data.
CREATE OR REPLACE FUNCTION public.submit_player_join_request(
  p_tenant_id uuid,
  p_player_name text,
  p_contact_email text,
  p_contact_phone text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_guardian_name text DEFAULT NULL
)
RETURNS TABLE (
  request_id uuid,
  tenant_name text,
  applicant_user_id uuid,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_applicant uuid := public.current_app_user_id();
  v_tenant_name text;
  v_name text := trim(coalesce(p_player_name, ''));
  v_email text := lower(trim(coalesce(p_contact_email, '')));
  v_phone text := nullif(trim(coalesce(p_contact_phone, '')), '');
  v_guardian text := nullif(trim(coalesce(p_guardian_name, '')), '');
  v_id uuid := gen_random_uuid();
  v_now timestamptz := now();
BEGIN
  IF v_applicant IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_applicant AND NOT is_suspended) THEN
    RAISE EXCEPTION 'APPLICANT_NOT_PERMITTED' USING ERRCODE = '42501';
  END IF;

  SELECT t.name INTO v_tenant_name FROM public.tenants t WHERE t.id = p_tenant_id AND t.status = 'ACTIVE';
  IF v_tenant_name IS NULL THEN
    RAISE EXCEPTION 'ACADEMY_NOT_AVAILABLE' USING ERRCODE = 'P0002';
  END IF;

  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'PLAYER_NAME_INVALID' USING ERRCODE = '22023';
  END IF;
  IF length(v_email) > 254 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'CONTACT_EMAIL_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_phone IS NOT NULL AND length(v_phone) > 32 THEN
    RAISE EXCEPTION 'CONTACT_PHONE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_guardian IS NOT NULL AND length(v_guardian) > 120 THEN
    RAISE EXCEPTION 'GUARDIAN_NAME_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_date_of_birth IS NOT NULL AND (p_date_of_birth < DATE '1900-01-01' OR p_date_of_birth > current_date) THEN
    RAISE EXCEPTION 'DATE_OF_BIRTH_INVALID' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(*) FROM public.player_registration_requests r
    WHERE r.tenant_id = p_tenant_id AND r.contact_email = v_email AND r.status = 'PENDING_REVIEW'
  ) >= 5 THEN
    RAISE EXCEPTION 'TOO_MANY_PENDING_REQUESTS' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.player_registration_requests (
    id, tenant_id, applicant_user_id, player_name, contact_email, contact_phone, date_of_birth, guardian_name,
    status, created_at, updated_at
  )
  VALUES (
    v_id, p_tenant_id, v_applicant, v_name, v_email, v_phone, p_date_of_birth, v_guardian,
    'PENDING_REVIEW', v_now, v_now
  );

  INSERT INTO public.app_notifications (id, user_id, tenant_id, type, title, body, href, created_at)
  SELECT gen_random_uuid(), m.user_id, p_tenant_id, 'PLAYER_REGISTRATION', 'New Player Join Request',
         '"' || left(v_name, 120) || '" submitted a join request for review.', '/players?tab=applications', v_now
  FROM public.tenant_memberships m
  WHERE m.tenant_id = p_tenant_id
    AND m.status = 'ACTIVE'
    AND m.role IN ('OWNER', 'MANAGER', 'BRANCH_MANAGER');

  RETURN QUERY SELECT v_id, v_tenant_name, v_applicant, 'PENDING_REVIEW'::text, v_now, v_now;
END;
$$;


-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Portal claim redemption (claim codes hashed at rest)
-- ---------------------------------------------------------------------------------------------------------------------
-- Existing plaintext codes become their SHA-256 hex digest. The new code path hashes the submitted code
-- (trimmed, upper-cased) before calling the function, so outstanding codes keep working. Already-hashed values
-- (64 lower-case hex characters) are left alone, which makes this statement idempotent.
UPDATE public.players
SET claim_token = encode(sha256(convert_to(upper(trim(claim_token)), 'UTF8')), 'hex')
WHERE claim_token IS NOT NULL AND claim_token !~ '^[0-9a-f]{64}$';
UPDATE public.guardians
SET claim_token = encode(sha256(convert_to(upper(trim(claim_token)), 'UTF8')), 'hex')
WHERE claim_token IS NOT NULL AND claim_token !~ '^[0-9a-f]{64}$';

-- Links the record holding an unexpired claim code to the signed-in user (current_app_user_id(); no user id
-- parameter), clears the code (single use) and writes the audit entry, all in one statement per table.
-- Checks: signed-in, not suspended; academy ACTIVE; code unexpired; the record is unlinked or already linked to the
-- same user. NEW for guardians: a guardian record linked to another account can no longer be taken over (today only
-- players are protected). One account can hold at most one player profile (existing unique index on players.user_id).
-- Errors: CLAIM_INVALID for every invalid/expired/unknown code (no distinction), CLAIM_ALREADY_LINKED when a valid
-- code belongs to a record linked to someone else.
CREATE OR REPLACE FUNCTION public.redeem_portal_claim(p_claim_hash text)
RETURNS TABLE (entity_type text, entity_id uuid, tenant_id uuid, first_name text, last_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_actor uuid := public.current_app_user_id();
  v_id uuid;
  v_tenant uuid;
  v_first text;
  v_last text;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_actor AND NOT is_suspended) THEN
    RAISE EXCEPTION 'CLAIM_REQUIRES_ACTIVE_ACCOUNT' USING ERRCODE = '42501';
  END IF;
  IF p_claim_hash IS NULL OR p_claim_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'CLAIM_INVALID' USING ERRCODE = '22023';
  END IF;

  UPDATE public.players p
  SET user_id = v_actor, claim_token = NULL, claim_expires_at = NULL, updated_at = now()
  FROM public.tenants t
  WHERE t.id = p.tenant_id AND t.status = 'ACTIVE'
    AND p.claim_token = p_claim_hash AND p.claim_expires_at >= now()
    AND (p.user_id IS NULL OR p.user_id = v_actor)
  RETURNING p.id, p.tenant_id, p.first_name, p.last_name INTO v_id, v_tenant, v_first, v_last;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (id, tenant_id, actor_user_id, action, resource_type, resource_id, created_at)
    VALUES (gen_random_uuid(), v_tenant, v_actor, 'PORTAL_PLAYER_ACCOUNT_CLAIMED', 'Player', v_id::text, now());
    RETURN QUERY SELECT 'PLAYER'::text, v_id, v_tenant, v_first, v_last;
    RETURN;
  END IF;

  UPDATE public.guardians g
  SET user_id = v_actor, claim_token = NULL, claim_expires_at = NULL, updated_at = now()
  FROM public.tenants t
  WHERE t.id = g.tenant_id AND t.status = 'ACTIVE'
    AND g.claim_token = p_claim_hash AND g.claim_expires_at >= now()
    AND (g.user_id IS NULL OR g.user_id = v_actor)
  RETURNING g.id, g.tenant_id, g.first_name, g.last_name INTO v_id, v_tenant, v_first, v_last;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (id, tenant_id, actor_user_id, action, resource_type, resource_id, created_at)
    VALUES (gen_random_uuid(), v_tenant, v_actor, 'PORTAL_GUARDIAN_ACCOUNT_CLAIMED', 'Guardian', v_id::text, now());
    RETURN QUERY SELECT 'GUARDIAN'::text, v_id, v_tenant, v_first, v_last;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.players p JOIN public.tenants t ON t.id = p.tenant_id
    WHERE p.claim_token = p_claim_hash AND p.claim_expires_at >= now() AND t.status = 'ACTIVE'
    UNION ALL
    SELECT 1 FROM public.guardians g JOIN public.tenants t ON t.id = g.tenant_id
    WHERE g.claim_token = p_claim_hash AND g.claim_expires_at >= now() AND t.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'CLAIM_ALREADY_LINKED' USING ERRCODE = '23505';
  END IF;
  RAISE EXCEPTION 'CLAIM_INVALID' USING ERRCODE = '22023';
END;
$$;


-- ---------------------------------------------------------------------------------------------------------------------
-- 8. Function ownership and EXECUTE privileges
-- ---------------------------------------------------------------------------------------------------------------------
-- Owner = the migration role (neondb_owner on Neon; the admin role elsewhere), as for every existing definer function.
-- EXECUTE is revoked from PUBLIC (PostgreSQL grants it to PUBLIC by default) and granted to the runtime roles only.
REVOKE ALL ON FUNCTION public.academy_slug_in_use(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_audit_log(text, text, text, jsonb, text, text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_app_notification(uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_public_academies() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_player_join_request(uuid, text, text, text, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_portal_claim(text) FROM PUBLIC;

DO $$
DECLARE
  r text;
  f text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      FOREACH f IN ARRAY ARRAY[
        'public.academy_slug_in_use(text)',
        'public.append_audit_log(text, text, text, jsonb, text, text, uuid, uuid)',
        'public.create_app_notification(uuid, uuid, text, text, text, text)',
        'public.list_public_academies()',
        'public.submit_player_join_request(uuid, text, text, text, date, text)',
        'public.redeem_portal_claim(text)',
        -- RLS helpers are invoked inside policies with the caller's privileges.
        'public.current_app_tenant_id()',
        'public.current_app_user_id()',
        'public.is_current_user_super_admin()',
        'public.is_current_user_platform_owner()'
      ] LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', f, r);
      END LOOP;
    END IF;
  END LOOP;
END $$;


-- ---------------------------------------------------------------------------------------------------------------------
-- 9. Table and column privileges of the runtime roles (narrowed)
-- ---------------------------------------------------------------------------------------------------------------------
-- REVOKE of a table privilege also removes the same privilege from every column, so the column GRANTs below are the
-- complete remaining write privileges.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app', 'academy_app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      -- audit_logs: SELECT (RLS: own tenant, platform admins) only; writes via append_audit_log.
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM %I', r);
      -- app_notifications: read own (RLS) and mark as read; creation via create_app_notification; no deletes.
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.app_notifications FROM %I', r);
      -- academy_applications: no deletes; column-limited insert and update (below).
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.academy_applications FROM %I', r);
      -- player_registration_requests: creation via submit_player_join_request; review-column updates (below).
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.player_registration_requests FROM %I', r);
    END IF;
  END LOOP;

  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT ON TABLE public.audit_logs TO %I', r);
      EXECUTE format('GRANT SELECT ON TABLE public.app_notifications TO %I', r);
      EXECUTE format('GRANT UPDATE (read_at) ON TABLE public.app_notifications TO %I', r);

      -- Applicant-supplied columns only. Excluded: status (database default PENDING_REVIEW), review_notes,
      -- reviewed_by_user_id, reviewed_at, provisioned_tenant_id. RLS academy_applications_insert additionally
      -- requires applicant = actor, PENDING_REVIEW and empty review fields.
      EXECUTE format('GRANT SELECT ON TABLE public.academy_applications TO %I', r);
      EXECUTE format(
        'GRANT INSERT (id, applicant_user_id, academy_name, academy_slug, sport, city, contact_phone, contact_email, '
        'notes, created_at, updated_at) ON TABLE public.academy_applications TO %I', r);
      -- Review columns only; the only UPDATE policy is academy_applications_platform_admin, so only active platform
      -- administrators can change them. Applicant-supplied columns can no longer be rewritten after submission.
      EXECUTE format(
        'GRANT UPDATE (status, review_notes, reviewed_by_user_id, reviewed_at, provisioned_tenant_id, updated_at) '
        'ON TABLE public.academy_applications TO %I', r);

      EXECUTE format('GRANT SELECT ON TABLE public.player_registration_requests TO %I', r);
      -- Review columns only; RLS limits them to the request's own tenant.
      EXECUTE format(
        'GRANT UPDATE (status, review_notes, reviewed_by_user_id, reviewed_at, updated_at) '
        'ON TABLE public.player_registration_requests TO %I', r);
    END IF;
  END LOOP;
END $$;

-- =====================================================================================================================
-- Rollback (forward migration, reverse order). Do NOT restore the anonymous SELECT clause of 20261104105500.
--   DROP FUNCTION IF EXISTS public.redeem_portal_claim(text), public.submit_player_join_request(uuid, text, text,
--     text, date, text), public.list_public_academies(), public.create_app_notification(uuid, uuid, text, text, text,
--     text), public.append_audit_log(text, text, text, jsonb, text, text, uuid, uuid), public.academy_slug_in_use(text);
--   Re-grant the previous privileges per runtime role (they are listed in the pre-M2 catalog snapshot), e.g.
--     GRANT INSERT ON public.audit_logs, public.app_notifications, public.academy_applications,
--       public.player_registration_requests TO <role>; GRANT UPDATE, DELETE ON ... TO <role>;
--   DROP POLICY player_registration_requests_applicant; recreate player_registration_requests_tenant with the raw cast;
--   keep academy_applications_applicant as is (own rows); keep or drop academy_applications_insert.
--   Re-create is_current_user_super_admin / _platform_owner without "AND NOT is_suspended";
--   ALTER FUNCTION prevent_*_mutation() RESET search_path.
--   Claim codes: hashing is one-way. The old code path cannot redeem hashed codes; staff re-issue codes (the feature
--   has no UI today and Neon holds 0 outstanding codes; verify before rollback).
-- =====================================================================================================================
