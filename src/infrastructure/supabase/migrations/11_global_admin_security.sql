-- 11_global_admin_security.sql

-- 1. Cria a função auxiliar e super-segura para verificar se é superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND is_superadmin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Trigger para bloquear elevação de privilégio na tabela users
CREATE OR REPLACE FUNCTION public.block_is_superadmin_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_superadmin IS DISTINCT FROM OLD.is_superadmin THEN
        IF NOT public.is_superadmin() THEN
            RAISE EXCEPTION 'Operação não permitida: Apenas SuperAdmins podem alterar privilégios de SuperAdmin.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_block_is_superadmin_update ON public.users;
CREATE TRIGGER tr_block_is_superadmin_update
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.block_is_superadmin_update();

-- Ativar RLS em users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Policy na tabela Users
DROP POLICY IF EXISTS "users_read_policy" ON public.users;
CREATE POLICY "users_read_policy"
ON public.users FOR SELECT TO authenticated
USING (
    id = auth.uid() OR
    organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid() LIMIT 1) OR
    public.is_superadmin()
);

-- UPDATE users liberado apenas para o próprio usuário (desde que não altere is_superadmin via Trigger) ou SuperAdmin
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
CREATE POLICY "users_update_policy"
ON public.users FOR UPDATE TO authenticated
USING (
    id = auth.uid() OR public.is_superadmin()
)
WITH CHECK (
    id = auth.uid() OR public.is_superadmin()
);

-- 4. Bypass de SuperAdmin nas Policies Principais (Phase 1)
-- Suppliers
DROP POLICY IF EXISTS tenant_isolation_policy_suppliers ON public.suppliers;
CREATE POLICY tenant_isolation_policy_suppliers ON public.suppliers 
FOR ALL TO authenticated 
USING (tenant_id = get_auth_tenant_id() OR public.is_superadmin());

-- Categories
DROP POLICY IF EXISTS tenant_isolation_policy_categories ON public.categories;
CREATE POLICY tenant_isolation_policy_categories ON public.categories 
FOR ALL TO authenticated 
USING (tenant_id = get_auth_tenant_id() OR public.is_superadmin());

-- Products
DROP POLICY IF EXISTS tenant_isolation_policy_products ON public.products;
CREATE POLICY tenant_isolation_policy_products ON public.products 
FOR ALL TO authenticated 
USING (tenant_id = get_auth_tenant_id() OR public.is_superadmin());

-- Quotations
DROP POLICY IF EXISTS tenant_isolation_policy_quotations ON public.quotation_requests;
CREATE POLICY tenant_isolation_policy_quotations ON public.quotation_requests 
FOR ALL TO authenticated 
USING (tenant_id = get_auth_tenant_id() OR public.is_superadmin());

-- Bids
DROP POLICY IF EXISTS tenant_isolation_policy_bids ON public.supplier_quotations;
CREATE POLICY tenant_isolation_policy_bids ON public.supplier_quotations 
FOR ALL TO authenticated 
USING (
  supplier_id IN (SELECT id FROM suppliers WHERE tenant_id = get_auth_tenant_id()) OR 
  quotation_id IN (SELECT id FROM quotation_requests WHERE tenant_id = get_auth_tenant_id()) OR
  public.is_superadmin()
);

-- 5. Bypass de SuperAdmin nas tabelas de Operators (Sprint 12)
DROP POLICY IF EXISTS "operators_org_select" ON public.operators;
CREATE POLICY "operators_org_select" ON public.operators 
FOR SELECT TO authenticated 
USING ( public.has_org_access(organization_id) OR public.is_superadmin() );

DROP POLICY IF EXISTS "operators_org_update" ON public.operators;
CREATE POLICY "operators_org_update" ON public.operators 
FOR UPDATE TO authenticated 
USING ( public.has_org_access(organization_id) OR public.is_superadmin() );

DROP POLICY IF EXISTS "operators_org_insert" ON public.operators;
CREATE POLICY "operators_org_insert" ON public.operators 
FOR INSERT TO authenticated 
WITH CHECK ( public.has_org_access(organization_id) OR public.is_superadmin() );

-- Tabela Organizations (Empresas)
-- Todos os autenticados podem ver organizações, mas update só dono ou superadmin
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
CREATE POLICY "organizations_select" ON public.organizations 
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
CREATE POLICY "organizations_update" ON public.organizations 
FOR UPDATE TO authenticated 
USING (id = get_auth_tenant_id() OR public.is_superadmin());

-- 6. Tabela Logs (Bypass para ver todos os logs do sistema)
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "logs_org_select" ON public.logs;
CREATE POLICY "logs_org_select" ON public.logs 
FOR SELECT TO authenticated 
USING (organization_id = get_auth_tenant_id() OR public.is_superadmin());

DROP POLICY IF EXISTS "logs_org_insert" ON public.logs;
CREATE POLICY "logs_org_insert" ON public.logs 
FOR INSERT TO authenticated 
WITH CHECK (organization_id = get_auth_tenant_id() OR public.is_superadmin());

-- Recarregar schema cache
NOTIFY pgrst, 'reload schema';
