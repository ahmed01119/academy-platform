-- Sprint 1: Secure Onboarding and Scoped Invitation Redemption Boundaries.
-- Provides narrowly scoped, auditable database functions with SECURITY DEFINER
-- and strict search_path, preventing privilege escalation while allowing the
-- least-privilege runtime role to safely onboard tenants and redeem invitations.

-- 1. Scoped Tenant Provisioning Function
CREATE OR REPLACE FUNCTION public.provision_tenant_onboarding(
  p_user_id uuid,
  p_tenant_name text,
  p_tenant_slug text,
  p_branch_name text DEFAULT 'Main Branch',
  p_branch_code text DEFAULT 'MAIN',
  p_sport text DEFAULT 'FOOTBALL'
)
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  branch_id uuid,
  branch_name text,
  membership_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_user_email text;
  v_tenant_id uuid := gen_random_uuid();
  v_branch_id uuid := gen_random_uuid();
  v_membership_id uuid := gen_random_uuid();
  v_sport_id uuid := gen_random_uuid();
  v_tenant_slug text;
  v_tenant_name text;
  v_branch_name text;
  v_sport_enum public."SportCode";
BEGIN
  -- 1. Input validations
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED' USING ERRCODE = '23502';
  END IF;

  v_tenant_name := trim(COALESCE(p_tenant_name, ''));
  IF v_tenant_name = '' THEN
    RAISE EXCEPTION 'TENANT_NAME_REQUIRED' USING ERRCODE = '22023';
  END IF;

  v_tenant_slug := lower(trim(COALESCE(p_tenant_slug, '')));
  IF v_tenant_slug = '' THEN
    RAISE EXCEPTION 'TENANT_SLUG_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- 2. Verify user exists
  SELECT email INTO v_user_email
  FROM public.users
  WHERE id = p_user_id;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Parse sport enum safely
  BEGIN
    v_sport_enum := p_sport::public."SportCode";
  EXCEPTION WHEN others THEN
    v_sport_enum := 'FOOTBALL'::public."SportCode";
  END;

  v_branch_name := trim(COALESCE(p_branch_name, 'Main Branch'));

  -- 4. Create tenant (slug uniqueness is enforced by unique index "tenants_slug_key")
  INSERT INTO public.tenants (id, name, slug, status, currency, timezone, updated_at)
  VALUES (
    v_tenant_id,
    v_tenant_name,
    v_tenant_slug,
    'ACTIVE',
    'EGP',
    'Africa/Cairo',
    now()
  );

  -- 5. Create initial branch
  INSERT INTO public.branches (id, tenant_id, code, name, city, country, status, updated_at)
  VALUES (
    v_branch_id,
    v_tenant_id,
    upper(trim(COALESCE(p_branch_code, 'MAIN'))),
    v_branch_name,
    'Cairo',
    'EG',
    'ACTIVE',
    now()
  );

  -- 6. Create primary sport
  INSERT INTO public.tenant_sports (id, tenant_id, sport, is_primary)
  VALUES (
    v_sport_id,
    v_tenant_id,
    v_sport_enum,
    true
  );

  -- 7. Create owner membership
  INSERT INTO public.tenant_memberships (id, tenant_id, user_id, branch_id, role, status, updated_at)
  VALUES (
    v_membership_id,
    v_tenant_id,
    p_user_id,
    v_branch_id,
    'OWNER',
    'ACTIVE',
    now()
  );

  RETURN QUERY SELECT v_tenant_id, v_tenant_name, v_tenant_slug, v_branch_id, v_branch_name, v_membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_tenant_onboarding(uuid, text, text, text, text, text) FROM PUBLIC;

-- 2. Scoped Invitation Redemption Function
CREATE OR REPLACE FUNCTION public.redeem_invitation_and_activate_membership(
  p_actor_user_id uuid,
  p_token_hash text
)
RETURNS TABLE (
  invitation_id uuid,
  tenant_id uuid,
  tenant_name text,
  role text,
  branch_id uuid,
  membership_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_user_email text;
  v_user_verified boolean;
  v_invitation record;
  v_tenant_name text;
  v_membership_id uuid;
BEGIN
  -- 1. Validate inputs
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED' USING ERRCODE = '23502';
  END IF;

  IF trim(COALESCE(p_token_hash, '')) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- 2. Fetch actor user and verify email verification
  SELECT email, is_email_verified
  INTO v_user_email, v_user_verified
  FROM public.users
  WHERE id = p_actor_user_id;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT COALESCE(v_user_verified, false) THEN
    RAISE EXCEPTION 'EMAIL_NOT_VERIFIED' USING ERRCODE = '42501';
  END IF;

  -- 3. Lock invitation row FOR UPDATE to prevent concurrent redemption
  SELECT id, tenant_id, branch_id, role, email, status, expires_at
  INTO v_invitation
  FROM public.invitations
  WHERE token = p_token_hash
  FOR UPDATE;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_INVITATION' USING ERRCODE = 'P0002';
  END IF;

  -- 4. Verify invitation is pending and not expired
  IF v_invitation.status <> 'PENDING' OR v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_INVITATION' USING ERRCODE = 'P0002';
  END IF;

  -- 5. Strict email identity match (case-insensitive, trimmed)
  IF lower(trim(v_invitation.email)) <> lower(trim(v_user_email)) THEN
    RAISE EXCEPTION 'INVITATION_EMAIL_MISMATCH' USING ERRCODE = '42501';
  END IF;

  -- 6. Verify tenant is active
  SELECT name INTO v_tenant_name
  FROM public.tenants
  WHERE id = v_invitation.tenant_id AND status = 'ACTIVE';

  IF v_tenant_name IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_ACTIVE' USING ERRCODE = 'P0002';
  END IF;

  -- 7. Verify branch if specified
  IF v_invitation.branch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.branches
      WHERE id = v_invitation.branch_id
        AND tenant_id = v_invitation.tenant_id
        AND status = 'ACTIVE'
    ) THEN
      RAISE EXCEPTION 'BRANCH_INVALID' USING ERRCODE = '23503';
    END IF;
  END IF;

  -- 8. Consume invitation atomically
  UPDATE public.invitations
  SET status = 'ACCEPTED'
  WHERE id = v_invitation.id;

  -- 9. Create or update membership
  INSERT INTO public.tenant_memberships (
    id,
    tenant_id,
    user_id,
    branch_id,
    role,
    status,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_invitation.tenant_id,
    p_actor_user_id,
    v_invitation.branch_id,
    v_invitation.role,
    'ACTIVE',
    now()
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE
  SET role = EXCLUDED.role,
      branch_id = EXCLUDED.branch_id,
      status = 'ACTIVE',
      updated_at = now()
  RETURNING id INTO v_membership_id;

  RETURN QUERY SELECT
    v_invitation.id,
    v_invitation.tenant_id,
    v_tenant_name,
    v_invitation.role::text,
    v_invitation.branch_id,
    v_membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invitation_and_activate_membership(uuid, text) FROM PUBLIC;

-- 3. Scoped Invitation Preview Function
CREATE OR REPLACE FUNCTION public.inspect_invitation_preview(
  p_token_hash text
)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  tenant_name text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  IF trim(COALESCE(p_token_hash, '')) = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT i.id, i.email, i.role::text, t.name, i.expires_at
  FROM public.invitations i
  JOIN public.tenants t ON t.id = i.tenant_id
  WHERE i.token = p_token_hash
    AND i.status = 'PENDING'
    AND i.expires_at > now()
    AND t.status = 'ACTIVE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_INVITATION' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.inspect_invitation_preview(text) FROM PUBLIC;
