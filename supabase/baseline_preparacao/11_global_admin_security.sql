-- 11_global_admin_security.sql

-- 0. COLUNAS DE IDENTIFICAÇÃO E RECUPERAÇÃO PERMANENTE (ROOT KEY)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf ON public.profiles(cpf);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_founder boolean DEFAULT false;
-- Garantia estrutural de que existirá no máximo UM único Founder em toda a plataforma
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_founder ON public.profiles(is_founder) WHERE is_founder = true;

-- 1. PROMOÇÃO INICIAL DO FUNDADOR
-- Atualiza o registro raiz para marcá-lo como fundador e conceder acesso operacional
UPDATE public.profiles 
SET is_founder = true, is_super_admin = true 
WHERE email = 'viniciuscordebello@gmail.com';

-- 2. FUNÇÃO DE FUNDADOR (Camada Máxima Permanente)
CREATE OR REPLACE FUNCTION public.is_founder()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND is_founder = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. FUNÇÃO DE SUPER ADMIN (Gestão Operacional com Fallback)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  -- Se for o founder, possui privilégio máximo independente da flag operacional
  IF public.is_founder() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND is_super_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. TRIGGER DE PROTEÇÃO ABSOLUTA (Impedir alteração do Root Key)
CREATE OR REPLACE FUNCTION public.block_is_superadmin_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Bloqueio absoluto da flag is_founder
    IF NEW.is_founder IS DISTINCT FROM OLD.is_founder THEN
        RAISE EXCEPTION 'Operação não permitida: A flag is_founder (Root Key) é imutável via aplicação.';
    END IF;

    -- Proteção da flag is_super_admin
    IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
        IF NOT public.is_super_admin() THEN
            RAISE EXCEPTION 'Operação não permitida: Apenas Administradores Globais podem alterar privilégios de SuperAdmin.';
        END IF;
        IF NEW.user_id = auth.uid() AND NEW.is_super_admin = false THEN
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
    user_id = auth.uid() OR
    public.has_org_access(organization_id) OR
    public.is_super_admin()
);

-- UPDATE profiles liberado apenas para o próprio usuário (desde que não altere is_super_admin via Trigger) ou SuperAdmin
DROP POLICY IF EXISTS "users_update_policy" ON public.profiles;
CREATE POLICY "users_update_policy"
ON public.profiles FOR UPDATE TO authenticated
USING (
    user_id = auth.uid() OR public.is_super_admin()
)
WITH CHECK (
    user_id = auth.uid() OR public.is_super_admin()
);

-- 4. Bypass de SuperAdmin nas Policies Principais (Phase 1)
-- Suppliers
DROP POLICY IF EXISTS tenant_isolation_policy_suppliers ON public.suppliers;
CREATE POLICY tenant_isolation_policy_suppliers ON public.suppliers 
FOR ALL TO authenticated 
USING (public.has_org_access(organization_id) OR public.is_super_admin());

-- Categories
DROP POLICY IF EXISTS tenant_isolation_policy_categories ON public.categories;
CREATE POLICY tenant_isolation_policy_categories ON public.categories 
FOR ALL TO authenticated 
USING (public.has_org_access(organization_id) OR public.is_super_admin());

-- Products
DROP POLICY IF EXISTS tenant_isolation_policy_products ON public.products;
CREATE POLICY tenant_isolation_policy_products ON public.products 
FOR ALL TO authenticated 
USING (public.has_org_access(organization_id) OR public.is_super_admin());

-- Quotations
DROP POLICY IF EXISTS tenant_isolation_policy_quotations ON public.quotation_requests;
CREATE POLICY tenant_isolation_policy_quotations ON public.quotation_requests 
FOR ALL TO authenticated 
USING (public.has_org_access(organization_id) OR public.is_super_admin());

-- Bids
DROP POLICY IF EXISTS tenant_isolation_policy_bids ON public.supplier_quotations;
CREATE POLICY tenant_isolation_policy_bids ON public.supplier_quotations 
FOR ALL TO authenticated 
USING (
  supplier_id IN (SELECT id FROM suppliers WHERE public.has_org_access(organization_id)) OR 
  request_id IN (SELECT id FROM quotation_requests WHERE public.has_org_access(organization_id)) OR
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
USING (public.has_org_access(id) OR public.is_super_admin());

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
USING (public.has_org_access(organization_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "logs_org_insert" ON public.logs;
CREATE POLICY "logs_org_insert" ON public.logs 
FOR INSERT TO authenticated 
WITH CHECK (public.has_org_access(organization_id) OR public.is_super_admin());

-- Recarregar schema cache
NOTIFY pgrst, 'reload schema';
