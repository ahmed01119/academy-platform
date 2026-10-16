-- Tenant-owned foundation tables are isolated by PostgreSQL RLS.
-- A missing or invalid transaction-local tenant context must fail closed.
-- Platform-wide audit events (tenant_id IS NULL) remain accessible only
-- through a separate privileged, audited operational path.
CREATE OR REPLACE FUNCTION public.current_app_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN current_setting('app.tenant_id', true) ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN current_setting('app.tenant_id', true)::uuid
    ELSE NULL
  END
$$;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches FORCE ROW LEVEL SECURITY;
CREATE POLICY branches_tenant_isolation ON public.branches
  FOR ALL TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id())
  WITH CHECK (tenant_id = public.current_app_tenant_id());

ALTER TABLE public.tenant_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_sports FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_sports_tenant_isolation ON public.tenant_sports
  FOR ALL TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id())
  WITH CHECK (tenant_id = public.current_app_tenant_id());

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_tenant_isolation ON public.audit_logs
  FOR ALL TO PUBLIC
  USING (tenant_id = public.current_app_tenant_id())
  WITH CHECK (tenant_id = public.current_app_tenant_id());
