-- Integration test suite for secure onboarding and invitation redemption boundaries.
-- Runs under the restricted runtime role (academy_runtime_ci) with FORCE RLS active.
BEGIN;
SET LOCAL ROLE academy_runtime_ci;

DO $$
DECLARE
  v_user_a_id uuid := '00000000-0000-4000-8000-000000000901';
  v_user_b_unverified_id uuid := '00000000-0000-4000-8000-000000000902';
  v_user_c_mismatch_id uuid := '00000000-0000-4000-8000-000000000903';
  v_user_d_verified_id uuid := '00000000-0000-4000-8000-000000000904';
  v_user_e_expired_id uuid := '00000000-0000-4000-8000-000000000905';
  v_onboarding record;
  v_redemption record;
  v_preview record;
  v_invitation_id uuid := '00000000-0000-4000-8000-000000000951';
  v_expired_inv_id uuid := '00000000-0000-4000-8000-000000000952';
  v_unverified_inv_id uuid := '00000000-0000-4000-8000-000000000953';
  v_token_hash text := 'ci_test_token_hash_coach_001';
  v_expired_token_hash text := 'ci_test_token_hash_expired_002';
  v_unverified_token_hash text := 'ci_test_token_hash_unverified_003';
  v_onboarding_token text := 'raw_secret_onboarding_token_32_bytes_user_a';
  v_onboarding_token_hash text := encode(sha256('raw_secret_onboarding_token_32_bytes_user_a'::bytea), 'hex');
  v_redemption_challenge text := 'raw_secret_redemption_challenge_32_bytes_user_d';
  v_redemption_challenge_hash text := encode(sha256('raw_secret_redemption_challenge_32_bytes_user_d'::bytea), 'hex');
  v_expired_user_challenge text := 'raw_secret_challenge_expired_user_e';
  v_expired_user_challenge_hash text := encode(sha256('raw_secret_challenge_expired_user_e'::bytea), 'hex');
  v_unverified_challenge text := 'raw_secret_challenge_unverified_b';
  v_unverified_challenge_hash text := encode(sha256('raw_secret_challenge_unverified_b'::bytea), 'hex');
  v_mismatch_challenge text := 'raw_secret_challenge_mismatch_c';
  v_mismatch_challenge_hash text := encode(sha256('raw_secret_challenge_mismatch_c'::bytea), 'hex');
  v_tenant_id uuid;
  v_failed boolean := false;
BEGIN
  -- 1. Verify restricted runtime role identity
  IF (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'SECURITY FAILURE: test is not running under restricted non-bypass role';
  END IF;

  -- 2. Verify direct INSERT on public.tenants is strictly denied
  BEGIN
    INSERT INTO public.tenants (id, name, slug, status, currency, timezone, updated_at)
    VALUES (gen_random_uuid(), 'Hacker Academy', 'hacker-academy', 'ACTIVE', 'EGP', 'Africa/Cairo', now());
    v_failed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role was able to directly INSERT into public.tenants';
  END IF;

  -- 3. Create global user A (owner) with valid onboarding challenge hash
  INSERT INTO public.users (
    id, email, password_hash, name, phone, updated_at
  )
  VALUES (
    v_user_a_id, 'owner_a@example.com', '$argon2id$mock', 'Owner A', '+201000000001', now()
  );
  PERFORM public.issue_user_onboarding_token(v_user_a_id, v_onboarding_token_hash);

  -- 4. Test anti-impersonation: attempt onboarding without valid token MUST FAIL
  v_failed := false;
  BEGIN
    PERFORM public.provision_tenant_onboarding(
      v_user_a_id,
      'Forged Academy',
      'forged-academy',
      'Main Branch',
      'MAIN',
      'FOOTBALL',
      'attacker_fake_token'
    );
    v_failed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: onboarding succeeded with forged/unauthorized token';
  END IF;

  -- 5. Test atomic onboarding through provision_tenant_onboarding with VALID token
  SELECT * INTO v_onboarding FROM public.provision_tenant_onboarding(
    v_user_a_id,
    'Al Ahly Academy',
    'al-ahly-academy',
    'Main Branch',
    'MAIN',
    'FOOTBALL',
    v_onboarding_token
  );

  IF v_onboarding.tenant_id IS NULL OR v_onboarding.membership_id IS NULL THEN
    RAISE EXCEPTION 'FAILURE: provision_tenant_onboarding returned null IDs';
  END IF;

  v_tenant_id := v_onboarding.tenant_id;

  -- 6. Test replay prevention: second call with same onboarding token MUST FAIL
  v_failed := false;
  BEGIN
    PERFORM public.provision_tenant_onboarding(
      v_user_a_id,
      'Replayed Academy',
      'replayed-academy',
      'Main Branch',
      'MAIN',
      'FOOTBALL',
      v_onboarding_token
    );
    v_failed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: onboarding token was replayed successfully';
  END IF;

  -- 7. Test rollback on missing user
  v_failed := false;
  BEGIN
    PERFORM public.provision_tenant_onboarding(
      '00000000-0000-4000-8000-000000000999',
      'Phantom Academy',
      'phantom-academy',
      'Main Branch',
      'MAIN',
      'FOOTBALL',
      'any_token'
    );
    v_failed := true;
  EXCEPTION WHEN others THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: onboarding succeeded for non-existent user';
  END IF;

  -- 8. Create invitation under Tenant A context
  PERFORM set_config('app.tenant_id', v_tenant_id::text, true);

  -- Invitation 1: For verified coach D
  INSERT INTO public.invitations (
    id, tenant_id, email, role, token, status, expires_at
  )
  VALUES (
    v_invitation_id,
    v_tenant_id,
    'coach_d@example.com',
    'COACH',
    v_token_hash,
    'PENDING',
    now() + interval '7 days'
  );

  -- Invitation 2: For unverified coach B
  INSERT INTO public.invitations (
    id, tenant_id, email, role, token, status, expires_at
  )
  VALUES (
    v_unverified_inv_id,
    v_tenant_id,
    'coach_b@example.com',
    'COACH',
    v_unverified_token_hash,
    'PENDING',
    now() + interval '7 days'
  );

  -- Invitation 3: Expired invitation
  INSERT INTO public.invitations (
    id, tenant_id, email, role, token, status, expires_at
  )
  VALUES (
    v_expired_inv_id,
    v_tenant_id,
    'coach_e@example.com',
    'COACH',
    v_expired_token_hash,
    'PENDING',
    now() - interval '1 hour'
  );

  -- Clear tenant context: simulate public/unauthenticated invitation arrival
  PERFORM set_config('app.tenant_id', '', true);

  -- 9. Test invitation preview capability
  SELECT * INTO v_preview FROM public.inspect_invitation_preview(v_token_hash);
  IF v_preview.email <> 'coach_d@example.com' OR v_preview.role <> 'COACH' THEN
    RAISE EXCEPTION 'FAILURE: inspect_invitation_preview returned unexpected data';
  END IF;

  -- 10. Create users for redemption testing with permitted columns and verified via security definer
  INSERT INTO public.users (id, email, password_hash, name, updated_at)
  VALUES (v_user_b_unverified_id, 'coach_b@example.com', '$argon2id$mock', 'Unverified Coach', now());

  INSERT INTO public.users (id, email, password_hash, name, updated_at)
  VALUES (v_user_c_mismatch_id, 'attacker@example.com', '$argon2id$mock', 'Attacker', now());
  PERFORM public.request_email_verification('attacker@example.com', 'tok_verify_c', now() + interval '1 hour');
  PERFORM public.verify_user_email('tok_verify_c');
  PERFORM public.issue_user_redemption_challenge(v_user_c_mismatch_id, v_mismatch_challenge_hash, now() + interval '5 minutes');

  INSERT INTO public.users (id, email, password_hash, name, updated_at)
  VALUES (v_user_d_verified_id, 'coach_d@example.com', '$argon2id$mock', 'Verified Coach', now());
  PERFORM public.request_email_verification('coach_d@example.com', 'tok_verify_d', now() + interval '1 hour');
  PERFORM public.verify_user_email('tok_verify_d');
  PERFORM public.issue_user_redemption_challenge(v_user_d_verified_id, v_redemption_challenge_hash, now() + interval '5 minutes');

  INSERT INTO public.users (id, email, password_hash, name, updated_at)
  VALUES (v_user_e_expired_id, 'coach_e@example.com', '$argon2id$mock', 'Expired Coach', now());
  PERFORM public.request_email_verification('coach_e@example.com', 'tok_verify_e', now() + interval '1 hour');
  PERFORM public.verify_user_email('tok_verify_e');
  PERFORM public.issue_user_redemption_challenge(v_user_e_expired_id, v_expired_user_challenge_hash, now() + interval '5 minutes');

  -- 11. Test unverified email rejection
  v_failed := false;
  BEGIN
    PERFORM public.redeem_invitation_and_activate_membership(
      v_user_b_unverified_id,
      v_unverified_token_hash,
      v_unverified_challenge
    );
    v_failed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: unverified user was able to redeem invitation';
  END IF;

  -- 12. Test email mismatch rejection
  v_failed := false;
  BEGIN
    PERFORM public.redeem_invitation_and_activate_membership(
      v_user_c_mismatch_id,
      v_token_hash,
      v_mismatch_challenge
    );
    v_failed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: user with mismatched email was able to redeem invitation';
  END IF;

  -- 13. Test impersonation attempt on User D with invalid redemption challenge
  v_failed := false;
  BEGIN
    PERFORM public.redeem_invitation_and_activate_membership(
      v_user_d_verified_id,
      v_token_hash,
      'attacker_fake_redemption_challenge'
    );
    v_failed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: invitation redeemed without valid user challenge (impersonation flaw)';
  END IF;

  -- 13b. Test missing redemption challenge rejection (required fix from audit)
  v_failed := false;
  BEGIN
    PERFORM public.redeem_invitation_and_activate_membership(
      v_user_d_verified_id,
      v_token_hash,
      NULL
    );
    v_failed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: invitation redeemed with missing redemption challenge';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.redeem_invitation_and_activate_membership(
      v_user_d_verified_id,
      v_token_hash,
      ''
    );
    v_failed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: invitation redeemed with empty redemption challenge';
  END IF;

  -- 14. Test expired invitation rejection
  v_failed := false;
  BEGIN
    PERFORM public.redeem_invitation_and_activate_membership(
      v_user_e_expired_id,
      v_expired_token_hash,
      v_expired_user_challenge
    );
    v_failed := true;
  EXCEPTION WHEN no_data_found THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: expired invitation was redeemed';
  END IF;

  -- 14b. Verify runtime role cannot directly overwrite sensitive columns on public.users
  v_failed := false;
  BEGIN
    UPDATE public.users SET onboarding_token = 'forged_token' WHERE id = v_user_a_id;
    v_failed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role was able to directly update onboarding_token';
  END IF;

  v_failed := false;
  BEGIN
    UPDATE public.users SET redemption_challenge = 'forged_challenge' WHERE id = v_user_d_verified_id;
    v_failed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role was able to directly update redemption_challenge';
  END IF;

  v_failed := false;
  BEGIN
    UPDATE public.users SET is_email_verified = true WHERE id = v_user_b_unverified_id;
    v_failed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role was able to directly update is_email_verified';
  END IF;

  v_failed := false;
  BEGIN
    UPDATE public.users SET password_hash = 'forged_hash' WHERE id = v_user_b_unverified_id;
    v_failed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role was able to directly update password_hash';
  END IF;

  v_failed := false;
  BEGIN
    INSERT INTO public.users (id, email, password_hash, name, is_email_verified, updated_at)
    VALUES (gen_random_uuid(), 'forged@test.com', 'hash', 'Forged', true, now());
    v_failed := true;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: runtime role was able to directly insert is_email_verified = true';
  END IF;

  -- 15. Test valid invitation redemption with valid challenge
  SELECT * INTO v_redemption FROM public.redeem_invitation_and_activate_membership(
    v_user_d_verified_id,
    v_token_hash,
    v_redemption_challenge
  );

  IF v_redemption.tenant_id <> v_tenant_id OR v_redemption.role <> 'COACH' THEN
    RAISE EXCEPTION 'FAILURE: redemption returned invalid tenant or role';
  END IF;

  -- 16. Test replay / reuse rejection (token was already accepted and challenge cleared)
  v_failed := false;
  BEGIN
    PERFORM public.redeem_invitation_and_activate_membership(
      v_user_d_verified_id,
      v_token_hash,
      v_redemption_challenge
    );
    v_failed := true;
  EXCEPTION WHEN others THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: already-accepted invitation was redeemed a second time';
  END IF;

  -- 17. Verify discovery of active membership for User D
  PERFORM set_config('app.actor_user_id', v_user_d_verified_id::text, true);
  IF (SELECT count(*) FROM public.tenant_memberships WHERE user_id = v_user_d_verified_id AND status = 'ACTIVE') <> 1 THEN
    RAISE EXCEPTION 'FAILURE: redeemed membership is not visible to actor user';
  END IF;

  -- 19. Sprint 2: Verify hardened issue_user_redemption_challenge rejects email mismatch
  v_failed := false;
  BEGIN
    -- User A attempts to issue redemption challenge using User D's invitation token
    PERFORM public.issue_user_redemption_challenge(
      v_user_a_id,
      v_token_hash,
      'fake_challenge_hash'
    );
    v_failed := true;
  EXCEPTION WHEN others THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: issue_user_redemption_challenge succeeded for mismatched user email';
  END IF;

  -- 20. Sprint 2: Verify issue_user_onboarding_token rejects user with existing membership
  v_failed := false;
  BEGIN
    PERFORM public.issue_user_onboarding_token(v_user_a_id);
    v_failed := true;
  EXCEPTION WHEN others THEN
    NULL;
  END;
  IF v_failed THEN
    RAISE EXCEPTION 'SECURITY FAILURE: issue_user_onboarding_token succeeded for user with existing memberships';
  END IF;

  -- 21. Sprint 2: Verify active player enrollment uniqueness (partial unique index)
  PERFORM set_config('app.tenant_id', v_tenant_id::text, true);
  DECLARE
    v_test_player_id uuid := gen_random_uuid();
    v_test_branch_id uuid := (SELECT id FROM public.branches WHERE tenant_id = v_tenant_id LIMIT 1);
  BEGIN
    INSERT INTO public.players (
      id, tenant_id, first_name, last_name, date_of_birth, national_id, emergency_contact_name, emergency_contact_phone, status, updated_at
    ) VALUES (
      v_test_player_id, v_tenant_id, 'Karim', 'Hassan', '2012-05-10', '29901011234567', 'Hassan', '+201011112222', 'ACTIVE', now()
    );

    INSERT INTO public.player_enrollments (
      id, tenant_id, player_id, branch_id, sport, status, start_date, updated_at
    ) VALUES (
      gen_random_uuid(), v_tenant_id, v_test_player_id, v_test_branch_id, 'FOOTBALL', 'ACTIVE', CURRENT_DATE, now()
    );

    v_failed := false;
    BEGIN
      -- Attempt second concurrent ACTIVE enrollment for same player and sport MUST FAIL
      INSERT INTO public.player_enrollments (
        id, tenant_id, player_id, branch_id, sport, status, start_date, updated_at
      ) VALUES (
        gen_random_uuid(), v_tenant_id, v_test_player_id, v_test_branch_id, 'FOOTBALL', 'ACTIVE', CURRENT_DATE, now()
      );
      v_failed := true;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
    IF v_failed THEN
      RAISE EXCEPTION 'SECURITY FAILURE: duplicate ACTIVE enrollment was accepted for the same player';
    END IF;

    -- 22. Sprint 2: Verify national ID uniqueness within same tenant
    v_failed := false;
    BEGIN
      INSERT INTO public.players (
        id, tenant_id, first_name, last_name, date_of_birth, national_id, emergency_contact_name, emergency_contact_phone, status, updated_at
      ) VALUES (
        gen_random_uuid(), v_tenant_id, 'Omar', 'Hassan', '2014-06-15', '29901011234567', 'Hassan', '+201011112222', 'ACTIVE', now()
      );
      v_failed := true;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
    IF v_failed THEN
      RAISE EXCEPTION 'SECURITY FAILURE: duplicate national_id within tenant was accepted';
    END IF;
  END;

END $$;

RESET ROLE;
ROLLBACK;
