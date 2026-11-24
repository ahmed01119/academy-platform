-- Owner decision 2026-11-24: an academy has three staff roles.
--   OWNER   everything, money included;
--   MANAGER the admin: branches, groups, players, sessions, attendance, evaluations, staff; no money;
--   COACH   own groups only.
-- BRANCH_MANAGER, RECEPTIONIST and ACCOUNTANT become MANAGER; VIEWER is retired (its memberships are revoked and its
-- pending invitations withdrawn). The enum values stay (removing a Postgres enum value would mean rebuilding the type
-- and every function that names it); the application grants them nothing and no longer assigns them.
--
-- Reversible: the affected rows were exported before this migration (database-backups/, not committed). branch_id is
-- kept on converted memberships; it is ignored for MANAGER (not a branch-scoped role).

UPDATE public.tenant_memberships
SET role = 'MANAGER', updated_at = now()
WHERE role IN ('BRANCH_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT');

UPDATE public.tenant_memberships
SET status = 'REVOKED', updated_at = now()
WHERE role = 'VIEWER' AND status <> 'REVOKED';

UPDATE public.invitations
SET role = 'MANAGER'
WHERE role IN ('BRANCH_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT') AND status = 'PENDING';

UPDATE public.invitations
SET status = 'REVOKED'
WHERE role = 'VIEWER' AND status = 'PENDING';
