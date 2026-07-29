-- Migration: 20260728214709_fase3_platform_identity.sql
-- Descrição: Define a tabela de administradores globais (platform_admins), is_platform_internal na organizations, proteções RLS e triggers de segurança.

BEGIN;

-- 1. Flag de plataforma (NOT NULL DEFAULT false) e Índice Único Parcial
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS is_platform_internal BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_platform_internal 
ON public.organizations(is_platform_internal) 
WHERE is_platform_internal = true;


-- 2. Criando a tabela platform_admins
CREATE TABLE IF NOT EXISTS public.platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    role VARCHAR(50) NOT NULL DEFAULT 'platform_admin' CHECK (role IN ('platform_owner', 'platform_admin', 'platform_auditor', 'platform_support')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(user_id)
);

-- Imutabilidade técnica (Não pode alterar ID, User, Data Criação ou Criador após inserido)
CREATE OR REPLACE FUNCTION public.prevent_immutable_platform_admins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $func
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.user_id IS DISTINCT FROM OLD.user_id OR
       NEW.created_at IS DISTINCT FROM OLD.created_at OR
       NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'Não é permitido alterar id, user_id, created_at ou created_by de um platform_admin.';
    END IF;
    RETURN NEW;
END;
$func;

REVOKE ALL ON FUNCTION public.prevent_immutable_platform_admins() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_immutable_platform_admins() FROM anon;

DROP TRIGGER IF EXISTS trg_prevent_immutable_platform_admins ON public.platform_admins;
CREATE TRIGGER trg_prevent_immutable_platform_admins
BEFORE UPDATE ON public.platform_admins
FOR EACH ROW
EXECUTE FUNCTION public.prevent_immutable_platform_admins();


-- 3. Função Específica para Update At
CREATE OR REPLACE FUNCTION public.set_platform_admins_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $func
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$func;

REVOKE ALL ON FUNCTION public.set_platform_admins_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_platform_admins_updated_at() FROM anon;

DROP TRIGGER IF EXISTS set_platform_admins_updated_at ON public.platform_admins;
CREATE TRIGGER set_platform_admins_updated_at
BEFORE UPDATE ON public.platform_admins
FOR EACH ROW
EXECUTE FUNCTION public.set_platform_admins_updated_at();


-- 4. Funções RLS Security Definer (Amarradas, Seguras e Fechadas)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $func
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins 
    WHERE user_id = auth.uid() 
      AND status = 'active'
  );
$func;

CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $func
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins 
    WHERE user_id = auth.uid() 
      AND status = 'active' 
      AND role = 'platform_owner'
  );
$func;

-- Revogar permissões e conceder a quem precisa
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.is_platform_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_platform_owner() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_platform_owner() TO authenticated;


-- 5. Função Transacional Protetora do Último Owner (com Advisory Lock)
CREATE OR REPLACE FUNCTION public.prevent_last_owner_loss()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $func
DECLARE
    active_owners_count INT;
BEGIN
    -- Se for um UPDATE alterando status/role ou um DELETE
    IF (TG_OP = 'DELETE' AND OLD.role = 'platform_owner' AND OLD.status = 'active') OR 
       (TG_OP = 'UPDATE' AND OLD.role = 'platform_owner' AND OLD.status = 'active' AND 
       (NEW.role IS DISTINCT FROM 'platform_owner' OR NEW.status IS DISTINCT FROM 'active')) THEN
        
        -- Lock Advisory exclusivo para platform_admins
        PERFORM pg_advisory_xact_lock(hashtext('platform_admins_owner_lock'));

        SELECT COUNT(*) INTO active_owners_count 
        FROM public.platform_admins 
        WHERE role = 'platform_owner' AND status = 'active';
        
        IF active_owners_count <= 1 THEN
            RAISE EXCEPTION 'Ação bloqueada: A plataforma deve possuir pelo menos um platform_owner ativo.';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$func;

REVOKE ALL ON FUNCTION public.prevent_last_owner_loss() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_last_owner_loss() FROM anon;

DROP TRIGGER IF EXISTS enforce_min_platform_owner ON public.platform_admins;
CREATE TRIGGER enforce_min_platform_owner
BEFORE UPDATE OR DELETE ON public.platform_admins
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_owner_loss();


-- 6. RLS em platform_admins
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Revogar permissões totais da tabela (Defesa em Profundidade)
REVOKE ALL ON TABLE public.platform_admins FROM PUBLIC;
REVOKE ALL ON TABLE public.platform_admins FROM anon;
GRANT SELECT ON TABLE public.platform_admins TO authenticated;
-- Insert e Update permitidos via RPC preferencialmente, mas liberados para authenticated (vão esbarrar no RLS WITH CHECK)
GRANT INSERT, UPDATE ON TABLE public.platform_admins TO authenticated;
-- ZERO acesso de DELETE, em nenhum cenário
REVOKE DELETE ON TABLE public.platform_admins FROM authenticated;

-- Policies de platform_admins
CREATE POLICY "Platform admins can read platform_admins" 
ON public.platform_admins FOR SELECT TO authenticated
USING (public.is_platform_admin());

CREATE POLICY "Platform owners can insert platform_admins"
ON public.platform_admins FOR INSERT TO authenticated
WITH CHECK (public.is_platform_owner());

CREATE POLICY "Platform owners can update platform_admins"
ON public.platform_admins FOR UPDATE TO authenticated
USING (public.is_platform_owner())
WITH CHECK (public.is_platform_owner());


-- 7. Substituição Restritiva nas Políticas de Organizations
DROP POLICY IF EXISTS "Hub.IA is hidden from common tenants" ON public.organizations;
CREATE POLICY "Hub.IA is hidden from common tenants"
ON public.organizations
AS RESTRICTIVE 
FOR SELECT
TO authenticated
USING (
    is_platform_internal = false 
    OR public.is_platform_admin()
);


-- 8. Auditar as alterações administrativas
CREATE OR REPLACE FUNCTION public.audit_platform_admins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $func
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.insert_audit_log('CREATE_PLATFORM_ADMIN', 'platform_admins', NEW.id, jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role));
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM public.insert_audit_log('UPDATE_PLATFORM_ADMIN', 'platform_admins', NEW.id, jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role, 'old_status', OLD.status, 'new_status', NEW.status));
    END IF;
    RETURN NULL;
END;
$func;

REVOKE ALL ON FUNCTION public.audit_platform_admins() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_platform_admins() FROM anon;

DROP TRIGGER IF EXISTS trg_audit_platform_admins ON public.platform_admins;
CREATE TRIGGER trg_audit_platform_admins
AFTER INSERT OR UPDATE ON public.platform_admins
FOR EACH ROW
EXECUTE FUNCTION public.audit_platform_admins();

COMMIT;

-- 9. BOOTSTRAP (Seguro, Idempotente e Auditável)
DO $do
DECLARE
  hub_org_id UUID;
  vini_user_id UUID;
  users_count INT;
  v_row_count INT;
BEGIN
  -- A. Encontrar UUID da Hub.IA (Assumindo que o nome contenha Hub.IA)
  SELECT id INTO hub_org_id FROM public.organizations WHERE name ILIKE '%Hub.IA%' LIMIT 1;
  
  IF hub_org_id IS NOT NULL THEN
      -- Atualizar a flag
      UPDATE public.organizations 
      SET is_platform_internal = true 
      WHERE id = hub_org_id;

      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      IF v_row_count != 1 THEN
          RAISE EXCEPTION 'A atualização da organização interna afetou % linhas em vez de exatamente 1.', v_row_count;
      END IF;

      -- Auditar a alteração
      PERFORM public.insert_audit_log('SET_PLATFORM_INTERNAL_ORGANIZATION', 'organizations', hub_org_id, jsonb_build_object('is_platform_internal', true));
  ELSE
      RAISE EXCEPTION 'Nenhuma organização encontrada com o nome Hub.IA. Abortando bootstrap da plataforma.';
  END IF;

  -- Validar unicidade rigorosa de is_platform_internal = true
  IF (SELECT COUNT(*) FROM public.organizations WHERE is_platform_internal = true) > 1 THEN
      RAISE EXCEPTION 'Erro de integridade: Múltiplas organizações estão marcadas como plataforma interna.';
  END IF;

  -- B. Setup do Platform Owner (Vinicius)
  SELECT COUNT(*) INTO users_count FROM auth.users WHERE lower(email) = lower('viniciuscordebello@gmail.com');
  
  IF users_count = 1 THEN
     SELECT id INTO vini_user_id FROM auth.users WHERE lower(email) = lower('viniciuscordebello@gmail.com');
     
     INSERT INTO public.platform_admins (user_id, role, status)
     VALUES (vini_user_id, 'platform_owner', 'active')
     ON CONFLICT (user_id) DO UPDATE 
     SET role = 'platform_owner', status = 'active';

     PERFORM public.insert_audit_log('BOOTSTRAP_PLATFORM_OWNER', 'auth.users', vini_user_id, jsonb_build_object('email', 'viniciuscordebello@gmail.com'));
  ELSIF users_count > 1 THEN
     RAISE EXCEPTION 'Múltiplos usuários encontrados com o email viniciuscordebello@gmail.com. Abortando bootstrap.';
  ELSE
     RAISE EXCEPTION 'Usuário viniciuscordebello@gmail.com não encontrado. Abortando bootstrap.';
  END IF;

END $do;
