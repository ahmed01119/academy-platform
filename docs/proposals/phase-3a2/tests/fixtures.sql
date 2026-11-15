-- Synthetic fixtures for the M2/M3 boundary tests (isolated database only; loaded by the admin role BEFORE M2 so the
-- claim-code conversion is exercised on plaintext codes). Every id, name and address is fabricated.
-- Users:   01 platform owner, 02 super admin, 03 suspended super admin, 10 owner of A, 11 coach of A,
--          12 revoked member of A, 20 manager of B, 30/31 academy applicants, 40 portal player user of A,
--          42 account already linked to a guardian, 50 signed-in join applicant, 60 plain user, 61 suspended user
-- Tenants: A, B (ACTIVE), S (SUSPENDED), E (ACTIVE, empty: deletion test)
BEGIN;
INSERT INTO public.users (id, email, password_hash, name, is_platform_super_admin, is_platform_owner, is_suspended, updated_at) VALUES
  ('00000000-0000-4000-8000-000000000001', 'owner@example.test', '$argon2id$v=19$synthetic', 'Owner', true, true, false, now()),
  ('00000000-0000-4000-8000-000000000002', 'admin@example.test', '$argon2id$v=19$synthetic', 'Admin', true, false, false, now()),
  ('00000000-0000-4000-8000-000000000003', 'suspended-admin@example.test', '$argon2id$v=19$synthetic', 'Suspended admin', true, false, true, now()),
  ('00000000-0000-4000-8000-000000000010', 'a-owner@example.test', '$argon2id$v=19$synthetic', 'A owner', false, false, false, now()),
  ('00000000-0000-4000-8000-000000000011', 'a-coach@example.test', '$argon2id$v=19$synthetic', 'A coach', false, false, false, now()),
  ('00000000-0000-4000-8000-000000000012', 'a-revoked@example.test', '$argon2id$v=19$synthetic', 'A revoked', false, false, false, now()),
  ('00000000-0000-4000-8000-000000000020', 'b-manager@example.test', '$argon2id$v=19$synthetic', 'B manager', false, false, false, now()),
  ('00000000-0000-4000-8000-000000000030', 'applicant-a@example.test', '$argon2id$v=19$synthetic', 'Applicant A', false, false, false, now()),
  ('00000000-0000-4000-8000-000000000031', 'applicant-b@example.test', '$argon2id$v=19$synthetic', 'Applicant B', false, false, false, now()),
  ('00000000-0000-4000-8000-000000000040', 'portal-player@example.test', '$argon2id$v=19$synthetic', 'Portal player', false, false, false, now()),
  ('00000000-0000-4000-8000-000000000042', 'linked-guardian@example.test', '$argon2id$v=19$synthetic', 'Linked guardian', false, false, false, now()),
  ('00000000-0000-4000-8000-000000000050', 'join-applicant@example.test', '$argon2id$v=19$synthetic', 'Join applicant', false, false, false, now()),
  ('00000000-0000-4000-8000-000000000060', 'plain@example.test', '$argon2id$v=19$synthetic', 'Plain user', false, false, false, now()),
  ('00000000-0000-4000-8000-000000000061', 'suspended@example.test', '$argon2id$v=19$synthetic', 'Suspended user', false, false, true, now());

INSERT INTO public.tenants (id, slug, name, status, updated_at) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'tenant-a', 'Tenant A', 'ACTIVE', now()),
  ('00000000-0000-4000-8000-0000000000b1', 'tenant-b', 'Tenant B', 'ACTIVE', now()),
  ('00000000-0000-4000-8000-0000000000c1', 'tenant-s', 'Tenant S', 'SUSPENDED', now()),
  ('00000000-0000-4000-8000-0000000000e1', 'tenant-e', 'Tenant E', 'ACTIVE', now());

INSERT INTO public.tenant_memberships (id, tenant_id, user_id, role, status, updated_at) VALUES
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000010', 'OWNER', 'ACTIVE', now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000011', 'COACH', 'ACTIVE', now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000012', 'MANAGER', 'REVOKED', now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000020', 'MANAGER', 'ACTIVE', now());

INSERT INTO public.players (id, tenant_id, first_name, last_name, date_of_birth, emergency_contact_name, emergency_contact_phone, user_id, claim_token, claim_expires_at, updated_at) VALUES
  ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-0000000000a1', 'Linked', 'Player', '2012-01-01', 'Contact', '000', '00000000-0000-4000-8000-000000000040', NULL, NULL, now()),
  ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-0000000000a1', 'Claimable', 'Player', '2012-01-01', 'Contact', '000', NULL, 'ACAD-11AA22BB', now() + interval '7 days', now()),
  ('00000000-0000-4000-8000-00000000f003', '00000000-0000-4000-8000-0000000000c1', 'Suspended', 'Tenant', '2012-01-01', 'Contact', '000', NULL, 'ACAD-77AA88BB', now() + interval '7 days', now()),
  ('00000000-0000-4000-8000-00000000f004', '00000000-0000-4000-8000-0000000000a1', 'Expired', 'Claim', '2012-01-01', 'Contact', '000', NULL, 'ACAD-99AA00BB', now() - interval '1 minute', now());

INSERT INTO public.guardians (id, tenant_id, player_id, first_name, last_name, phone, user_id, claim_token, claim_expires_at, updated_at) VALUES
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000f001', 'Taken', 'Guardian', '000', '00000000-0000-4000-8000-000000000042', 'ACAD-33CC44DD', now() + interval '7 days', now()),
  ('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000f001', 'Free', 'Guardian', '000', NULL, 'ACAD-55EE66FF', now() + interval '7 days', now());

INSERT INTO public.academy_applications (id, applicant_user_id, academy_name, academy_slug, contact_email, status, updated_at) VALUES
  ('00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-000000000030', 'Alpha Academy', 'alpha-academy', 'applicant-a@example.test', 'PENDING_REVIEW', now()),
  ('00000000-0000-4000-8000-00000000aa02', '00000000-0000-4000-8000-000000000031', 'Beta Academy', 'beta-academy', 'applicant-b@example.test', 'REJECTED', now()),
  ('00000000-0000-4000-8000-00000000aa03', '00000000-0000-4000-8000-000000000031', 'Gamma Academy', 'gamma-academy', 'applicant-b@example.test', 'MORE_INFO_REQUESTED', now()),
  ('00000000-0000-4000-8000-00000000aa04', '00000000-0000-4000-8000-000000000030', 'Clash', 'tenant-a', 'applicant-a@example.test', 'PENDING_REVIEW', now());

INSERT INTO public.refresh_tokens (id, user_id, token_hash, family_id, expires_at) VALUES
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000060', 'synthetic-rt-60-a', gen_random_uuid(), now() + interval '7 days'),
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000060', 'synthetic-rt-60-b', gen_random_uuid(), now() + interval '7 days'),
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000002', 'synthetic-rt-02', gen_random_uuid(), now() + interval '7 days');
COMMIT;
