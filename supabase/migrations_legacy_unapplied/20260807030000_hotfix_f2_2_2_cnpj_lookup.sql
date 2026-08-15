-- Migration: supabase/migrations/20260807030000_hotfix_f2_2_2_cnpj_lookup.sql

BEGIN;

-- 1. RPC de busca canônica (Segura)
CREATE OR REPLACE FUNCTION public.find_organization_by_cnpj(p_cnpj text)
RETURNS TABLE (
  id uuid,
  name text,
  razao_social text,
  nome_fantasia text,
  cnpj text,
  logo_url text,
  city text,
  state text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_cnpj text;
  v_count integer;
BEGIN
  -- Normaliza removendo não-dígitos
  v_clean_cnpj := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
  
  IF length(v_clean_cnpj) <> 14 THEN
      RETURN;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.organizations o
  WHERE regexp_replace(coalesce(o.cnpj,''), '\D','','g') = v_clean_cnpj;

  IF v_count = 0 THEN
      RETURN;
  ELSIF v_count > 1 THEN
      RAISE EXCEPTION 'ORGANIZATION_CNPJ_AMBIGUOUS';
  END IF;
  
  RETURN QUERY
  SELECT 
    o.id, 
    o.name, 
    o.razao_social, 
    o.nome_fantasia, 
    o.cnpj, 
    o.logo_url, 
    o.city, 
    o.state, 
    o.status
  FROM public.organizations o
  WHERE regexp_replace(coalesce(o.cnpj, ''), '\D', '', 'g') = v_clean_cnpj
  LIMIT 1;
END;
$$;

-- Somente usuários autenticados e admin (Ex: fluxo de convite na Rede B2B)
REVOKE ALL
ON FUNCTION public.find_organization_by_cnpj(text)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.find_organization_by_cnpj(text)
TO authenticated, service_role;


-- 2. Trigger Backend Guard contra Onboarding de Empresa Existente e Convite Duplicado
CREATE OR REPLACE FUNCTION public.trg_valida_invitation_nova()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_cnpj text;
  v_count integer;
  v_status text;
  v_exists uuid;
BEGIN
  v_status := lower(trim(coalesce(NEW.status, '')));

  -- Só aplica validação de CNPJ se vier preenchido e for inserção de status 'pendente' ou 'pending'
  IF NEW.document IS NOT NULL AND v_status IN ('pending', 'pendente') THEN
    v_clean_cnpj := regexp_replace(coalesce(NEW.document, ''), '\D', '', 'g');

    IF length(v_clean_cnpj) <> 14 THEN
      RAISE EXCEPTION 'INVITATION_CNPJ_INVALID';
    END IF;

    -- Regra 1: Não pode existir em organizations (caso de onboarding)
    -- Impede a criação de convite de onboarding para uma empresa que já existe
    SELECT count(*)
    INTO v_count
    FROM public.organizations o
    WHERE regexp_replace(coalesce(o.cnpj, ''), '\D', '', 'g') = v_clean_cnpj;

    IF v_count = 1 THEN
      RAISE EXCEPTION 'ORGANIZATION_ALREADY_EXISTS';
    ELSIF v_count > 1 THEN
      RAISE EXCEPTION 'ORGANIZATION_CNPJ_AMBIGUOUS';
    END IF;

    -- Regra 2: Não pode haver outro convite pendente válido igual vindo da mesma origem
    SELECT i.id INTO v_exists
    FROM public.invitations i
    WHERE i.organization_id = NEW.organization_id
      AND regexp_replace(coalesce(i.document, ''), '\D', '', 'g') = v_clean_cnpj
      AND lower(trim(coalesce(i.status,''))) IN ('pending','pendente')
      AND (i.expires_at IS NULL OR i.expires_at > now())
      AND (TG_OP = 'INSERT' OR i.id != NEW.id)
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'INVITATION_ALREADY_PENDING';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Restringe execução apenas para owner (postgres)
REVOKE ALL ON FUNCTION public.trg_valida_invitation_nova() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_valida_invitation_nova ON public.invitations;
CREATE TRIGGER trg_valida_invitation_nova
BEFORE INSERT OR UPDATE OF document, status, expires_at ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.trg_valida_invitation_nova();

-- 3. Proteção REAL contra autoconexão
ALTER TABLE public.connection_requests
DROP CONSTRAINT IF EXISTS connection_requests_no_self_connection;

ALTER TABLE public.connection_requests
ADD CONSTRAINT connection_requests_no_self_connection
CHECK (requester_company_id <> target_company_id);

COMMIT;
