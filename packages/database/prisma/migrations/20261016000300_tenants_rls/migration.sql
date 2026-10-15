-- Tenant provisioning and deletion are privileged platform operations.
-- Runtime access to tenant records is restricted to the verified tenant context.
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;

CREATE POLICY tenants_runtime_isolation ON public.tenants
  FOR SELECT TO PUBLIC
  USING (id = public.current_app_tenant_id());

CREATE POLICY tenants_runtime_update ON public.tenants
  FOR UPDATE TO PUBLIC
  USING (id = public.current_app_tenant_id())
  WITH CHECK (id = public.current_app_tenant_id());
