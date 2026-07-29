-- 11_global_admin_security.sql

-- 0. GARANTIA DE ACESSO ADMINISTRATIVO
-- Promover o usuário fundador ANTES de ativar as restrições
UPDATE public.profiles 
SET is_super_admin = true 
WHERE email = 'viniciuscordebello@gmail.com';

-- 1. Cria a função auxiliar e super-segura para verificar se é superadmin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND is_super_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Trigger para bloquear elevação de privilégio na tabela users
CREATE OR REPLACE FUNCTION public.block_is_superadmin_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
        IF NOT public.is_super_admin() THEN
            RAISE EXCEPTION 'Operação não permitida: Apenas SuperAdmins podem alterar privilégios de SuperAdmin.';
        END IF;
        IF NEW.id = auth.uid() AND NEW.is_super_admin = false THEN
            RAISE EXCEPTION 'Prevenção de bloqueio: Você não pode remover seu próprio privilégio de SuperAdmin.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_block_is_superadmin_update ON public.profiles;
CREATE TRIGGER tr_block_is_superadmin_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.block_is_superadmin_update();

-- Ativar RLS em profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Policy na tabela profiles
DROP POLICY IF EXISTS "users_read_policy" ON public.profiles;
CREATE POLICY "users_read_policy"
ON public.profiles FOR SELECT TO authenticated
USING (
    id = auth.uid() OR
    organization_id = public.get_auth_user_organization_id() OR
    public.is_super_admin()
);

-- UPDATE profiles liberado apenas para o próprio usuário (desde que não altere is_super_admin via Trigger) ou SuperAdmin
DROP POLICY IF EXISTS "users_update_policy" ON public.profiles;
CREATE POLICY "users_update_policy"
ON public.profiles FOR UPDATE TO authenticated
USING (
    id = auth.uid() OR public.is_super_admin()
)
WITH CHECK (
    id = auth.uid() OR public.is_super_admin()
);

-- 4. Bypass de SuperAdmin nas Policies Principais (Phase 1)
-- Suppliers
DROP POLICY IF EXISTS tenant_isolation_policy_suppliers ON public.suppliers;
CREATE POLICY tenant_isolation_policy_suppliers ON public.suppliers 
FOR ALL TO authenticated 
USING (organization_id = public.get_auth_user_organization_id() OR public.is_super_admin());

-- Categories
DROP POLICY IF EXISTS tenant_isolation_policy_categories ON public.categories;
CREATE POLICY tenant_isolation_policy_categories ON public.categories 
FOR ALL TO authenticated 
USING (organization_id = public.get_auth_user_organization_id() OR public.is_super_admin());

-- Products
DROP POLICY IF EXISTS tenant_isolation_policy_products ON public.products;
CREATE POLICY tenant_isolation_policy_products ON public.products 
FOR ALL TO authenticated 
USING (organization_id = public.get_auth_user_organization_id() OR public.is_super_admin());

-- Quotations
DROP POLICY IF EXISTS tenant_isolation_policy_quotations ON public.quotation_requests;
CREATE POLICY tenant_isolation_policy_quotations ON public.quotation_requests 
FOR ALL TO authenticated 
USING (organization_id = public.get_auth_user_organization_id() OR public.is_super_admin());

-- Bids
DROP POLICY IF EXISTS tenant_isolation_policy_bids ON public.supplier_quotations;
CREATE POLICY tenant_isolation_policy_bids ON public.supplier_quotations 
FOR ALL TO authenticated 
USING (
  supplier_id IN (SELECT id FROM suppliers WHERE organization_id = public.get_auth_user_organization_id()) OR 
  request_id IN (SELECT id FROM quotation_requests WHERE organization_id = public.get_auth_user_organization_id()) OR
  public.is_super_admin()
);

-- 5. Bypass de SuperAdmin nas tabelas de Operators (Sprint 12)
DROP POLICY IF EXISTS "operators_org_select" ON public.operators;
CREATE POLICY "operators_org_select" ON public.operators 
FOR SELECT TO authenticated 
USING ( public.has_org_access(organization_id) OR public.is_super_admin() );

DROP POLICY IF EXISTS "operators_org_update" ON public.operators;
CREATE POLICY "operators_org_update" ON public.operators 
FOR UPDATE TO authenticated 
USING ( public.has_org_access(organization_id) OR public.is_super_admin() );

DROP POLICY IF EXISTS "operators_org_insert" ON public.operators;
CREATE POLICY "operators_org_insert" ON public.operators 
FOR INSERT TO authenticated 
WITH CHECK ( public.has_org_access(organization_id) OR public.is_super_admin() );

-- Tabela Organizations (Empresas)
-- Todos os autenticados podem ver organizações, mas update só dono ou superadmin
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
CREATE POLICY "organizations_select" ON public.organizations 
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
CREATE POLICY "organizations_update" ON public.organizations 
FOR UPDATE TO authenticated 
USING (id = public.get_auth_user_organization_id() OR public.is_super_admin());

-- 6. Tabela Logs (Bypass para ver todos os logs do sistema)
-- No original era `public.logs`. Let's check if the table exists, but if it doesn't we can just create it or skip it.
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    operator_id UUID REFERENCES auth.users(id),
    action TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "logs_org_select" ON public.logs;
CREATE POLICY "logs_org_select" ON public.logs 
FOR SELECT TO authenticated 
USING (organization_id = public.get_auth_user_organization_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "logs_org_insert" ON public.logs;
CREATE POLICY "logs_org_insert" ON public.logs 
FOR INSERT TO authenticated 
WITH CHECK (organization_id = public.get_auth_user_organization_id() OR public.is_super_admin());

-- Recarregar schema cache
NOTIFY pgrst, 'reload schema';;
