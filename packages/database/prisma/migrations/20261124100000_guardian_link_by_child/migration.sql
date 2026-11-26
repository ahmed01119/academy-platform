-- Owner decision 2026-11-24: a guardian links their account to a child who already has a player account by typing the
-- child's e-mail; the link needs BOTH
--   * the academy's record: the guardian's phone must match a guardian the academy registered for that player
--     (the academy saw the family in person), and
--   * the child's consent: the child approves from an e-mail sent to their (verified) sign-in address.
-- The API signs the approval link (guardian record + requesting account); these functions only do the narrow
-- database work. Children without an account keep the academy-issued link code (redeem_portal_claim).

-- Guardian records the requester may ask to link: guardians of the player whose account uses p_child_email, in an
-- active academy, not linked to an account yet, whose phone ends with the same 10 digits as the requester's phone.
CREATE OR REPLACE FUNCTION public.find_guardian_link_candidates(p_child_email text, p_phone_tail text)
RETURNS TABLE (
  guardian_id uuid,
  tenant_id uuid,
  tenant_name text,
  player_id uuid,
  player_first_name text,
  child_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT g.id, t.id, t.name, p.id, p.first_name, u.email
  FROM public.users u
  JOIN public.players p ON p.user_id = u.id
  JOIN public.tenants t ON t.id = p.tenant_id AND t.status = 'ACTIVE'
  JOIN public.guardians g ON g.player_id = p.id AND g.tenant_id = p.tenant_id
  WHERE lower(u.email) = lower(trim(p_child_email))
    AND NOT u.is_suspended
    AND g.user_id IS NULL
    AND p_phone_tail ~ '^[0-9]{10}$'
    AND right(regexp_replace(g.phone, '[^0-9]', '', 'g'), 10) = p_phone_tail;
$$;

-- What the child sees on the approval page; nothing once the record is linked or the academy is not active.
CREATE OR REPLACE FUNCTION public.guardian_link_request_view(p_guardian_id uuid, p_requester_user_id uuid)
RETURNS TABLE (
  tenant_name text,
  player_first_name text,
  guardian_first_name text,
  guardian_last_name text,
  requester_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.name, p.first_name, g.first_name, g.last_name, r.name
  FROM public.guardians g
  JOIN public.players p ON p.id = g.player_id AND p.tenant_id = g.tenant_id
  JOIN public.tenants t ON t.id = g.tenant_id AND t.status = 'ACTIVE'
  JOIN public.users r ON r.id = p_requester_user_id AND NOT r.is_suspended
  WHERE g.id = p_guardian_id AND g.user_id IS NULL;
$$;

-- The child approved: links the guardian record to the requesting account (once), writes the audit entry and tells
-- the academy's managers, who can check it against their records. Returns no row when the link is no longer possible.
CREATE OR REPLACE FUNCTION public.approve_guardian_link(p_guardian_id uuid, p_requester_user_id uuid)
RETURNS TABLE (tenant_id uuid, player_id uuid, player_first_name text, player_last_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_tenant uuid;
  v_player uuid;
  v_first text;
  v_last text;
  v_requester text;
BEGIN
  SELECT name INTO v_requester FROM public.users WHERE id = p_requester_user_id AND NOT is_suspended;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.guardians g
  SET user_id = p_requester_user_id, claim_token = NULL, claim_expires_at = NULL, updated_at = now()
  FROM public.tenants t
  WHERE g.id = p_guardian_id AND g.user_id IS NULL AND t.id = g.tenant_id AND t.status = 'ACTIVE'
  RETURNING g.tenant_id, g.player_id INTO v_tenant, v_player;
  IF v_tenant IS NULL THEN
    RETURN;
  END IF;

  SELECT p.first_name, p.last_name INTO v_first, v_last FROM public.players p WHERE p.id = v_player;

  INSERT INTO public.audit_logs (id, tenant_id, actor_user_id, action, resource_type, resource_id, created_at)
  VALUES (gen_random_uuid(), v_tenant, p_requester_user_id, 'GUARDIAN_LINKED_BY_CHILD_APPROVAL', 'Guardian',
          p_guardian_id::text, now());

  INSERT INTO public.app_notifications (id, user_id, tenant_id, type, title, body, href, created_at)
  SELECT gen_random_uuid(), m.user_id, v_tenant, 'PLAYER_REGISTRATION', 'Guardian account linked',
         '"' || left(coalesce(v_requester, ''), 120) || '" is now linked as guardian of "'
           || left(v_first || ' ' || v_last, 120) || '" (phone matched, approved by the player).',
         '/players/' || v_player::text, now()
  FROM public.tenant_memberships m
  WHERE m.tenant_id = v_tenant
    AND m.status = 'ACTIVE'
    AND m.role IN ('OWNER', 'MANAGER', 'BRANCH_MANAGER');

  RETURN QUERY SELECT v_tenant, v_player, v_first, v_last;
END;
$$;

REVOKE ALL ON FUNCTION public.find_guardian_link_candidates(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guardian_link_request_view(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_guardian_link(uuid, uuid) FROM PUBLIC;

DO $$
DECLARE
  r text;
  f text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);
    FOREACH f IN ARRAY ARRAY[
      'public.find_guardian_link_candidates(text, text)',
      'public.guardian_link_request_view(uuid, uuid)',
      'public.approve_guardian_link(uuid, uuid)'
    ] LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', f, r);
    END LOOP;
  END LOOP;
END
$$;
