-- Sprint 1 security follow-up: fail-closed discovery and tenant-safe foreign keys.
-- Database session GUCs are not a privilege boundary: any SQL-capable runtime
-- connection can set app.auth_context. Never let that setting alone expose all tenants.
DROP POLICY IF EXISTS tenants_auth_discovery ON public.tenants;
CREATE POLICY tenants_auth_discovery ON public.tenants
  FOR SELECT TO PUBLIC
  USING (
    public.current_app_tenant_id() IS NULL
    AND public.current_app_user_id() IS NOT NULL
    AND id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = public.current_app_user_id()
        AND tm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS branches_auth_discovery ON public.branches;
CREATE POLICY branches_auth_discovery ON public.branches
  FOR SELECT TO PUBLIC
  USING (
    public.current_app_tenant_id() IS NULL
    AND public.current_app_user_id() IS NOT NULL
    AND id IN (
      SELECT tm.branch_id FROM public.tenant_memberships tm
      WHERE tm.user_id = public.current_app_user_id()
        AND tm.status = 'ACTIVE'
        AND tm.branch_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS tenant_memberships_tenant_select ON public.tenant_memberships;
CREATE POLICY tenant_memberships_tenant_select ON public.tenant_memberships
  FOR SELECT TO PUBLIC
  USING (
    tenant_id = public.current_app_tenant_id()
    OR (
      public.current_app_tenant_id() IS NULL
      AND public.current_app_user_id() IS NOT NULL
      AND user_id = public.current_app_user_id()
    )
  );

-- Auth/invitation bypass flags must not authorize tenant-wide mutations.
DROP POLICY IF EXISTS tenant_memberships_tenant_insert ON public.tenant_memberships;
CREATE POLICY tenant_memberships_tenant_insert ON public.tenant_memberships
  FOR INSERT TO PUBLIC WITH CHECK (tenant_id = public.current_app_tenant_id());

DROP POLICY IF EXISTS tenant_memberships_tenant_update ON public.tenant_memberships;
CREATE POLICY tenant_memberships_tenant_update ON public.tenant_memberships
  FOR UPDATE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id())
  WITH CHECK (tenant_id = public.current_app_tenant_id());

DROP POLICY IF EXISTS invitations_tenant_select ON public.invitations;
CREATE POLICY invitations_tenant_select ON public.invitations
  FOR SELECT TO PUBLIC USING (tenant_id = public.current_app_tenant_id());

DROP POLICY IF EXISTS invitations_tenant_update ON public.invitations;
CREATE POLICY invitations_tenant_update ON public.invitations
  FOR UPDATE TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id())
  WITH CHECK (tenant_id = public.current_app_tenant_id());

-- Composite FK SET NULL without a column list would also NULL tenant_id,
-- which is NOT NULL. Use RESTRICT until explicit reassignment is implemented.
ALTER TABLE public.tenant_memberships
  DROP CONSTRAINT IF EXISTS tenant_memberships_tenant_id_branch_id_fkey;
ALTER TABLE public.tenant_memberships
  ADD CONSTRAINT tenant_memberships_tenant_id_branch_id_fkey
  FOREIGN KEY (tenant_id, branch_id) REFERENCES public.branches(tenant_id, id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_tenant_id_branch_id_fkey;
ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_tenant_id_branch_id_fkey
  FOREIGN KEY (tenant_id, branch_id) REFERENCES public.branches(tenant_id, id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Idempotency entries must not reference a session from another tenant.
ALTER TABLE public.attendance_idempotency
  DROP CONSTRAINT IF EXISTS attendance_idempotency_session_id_fkey;
ALTER TABLE public.attendance_idempotency
  ADD CONSTRAINT attendance_idempotency_tenant_id_session_id_fkey
  FOREIGN KEY (tenant_id, session_id)
  REFERENCES public.attendance_sessions(tenant_id, id)
  ON DELETE CASCADE ON UPDATE CASCADE;
