-- B1-R.4F Onboarding Guards

-- Remove a função antiga para permitir a mudança se necessário
DROP FUNCTION IF EXISTS public.validate_company_invite(text);

CREATE OR REPLACE FUNCTION public.validate_company_invite(p_token text)
 RETURNS TABLE(
    validation_status text,
    id uuid,
    email text,
    company text,
    name text,
    document text,
    city text,
    state text,
    website text,
    segments text[],
    inviter_id uuid,
    inviter_company text,
    inviter_name text,
    inviter_document text,
    inviter_logo_url text,
    contact_name text,
    message text,
    expires_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  v_token_hash text;
  v_invite record;
  v_org record;
  v_status text;
  v_clean_cnpj text;
BEGIN
  -- 1. Validar token vazio antes do hash
  IF NULLIF(trim(p_token), '') IS NULL THEN
    validation_status := 'not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  -- 2. Calcula o hash
  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- 3. Busca o convite pelo hash
  SELECT
      i.id,
      i.email,
      i.company,
      i.name,
      i.document,
      i.city,
      i.state,
      i.website,
      i.segments,
      i.organization_id,
      i.contact_name,
      i.message,
      i.expires_at,
      i.status
  INTO v_invite
  FROM public.invitations AS i
  WHERE i.token_hash = v_token_hash
  LIMIT 1;

  -- 4. Hash não localizado
  IF NOT FOUND THEN
    validation_status := 'not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  v_status := lower(trim(coalesce(v_invite.status, '')));

  -- 5. Aceito/consumido
  IF v_status IN ('accepted', 'aceito') THEN
    validation_status := 'already_used';
    RETURN NEXT;
    RETURN;

  -- 6. Revogado/cancelado comprovado
  ELSIF v_status IN ('revoked', 'revogado', 'cancelled', 'canceled', 'cancelado') THEN
    validation_status := 'revoked';
    RETURN NEXT;
    RETURN;

  -- 7. Expirado por status explicito
  ELSIF v_status IN ('expired', 'expirado') THEN
    validation_status := 'expired';
    RETURN NEXT;
    RETURN;
  END IF;

  -- 8. Expirado por data
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
    validation_status := 'expired';
    RETURN NEXT;
    RETURN;
  END IF;

  -- 9. Status desconhecido/nulo ou não pendente
  IF v_status NOT IN ('pending', 'pendente') THEN
    validation_status := 'incomplete';
    RETURN NEXT;
    RETURN;
  END IF;

  -- 10. Dados convidados incompletos (strings vazias)
  IF NULLIF(trim(v_invite.document), '') IS NULL
     OR NULLIF(trim(v_invite.email), '') IS NULL
     OR NULLIF(trim(v_invite.company), '') IS NULL THEN
    validation_status := 'incomplete';
    RETURN NEXT;
    RETURN;
  END IF;

  -- 11. organization_id ausente
  IF v_invite.organization_id IS NULL THEN
    validation_status := 'incomplete';
    RETURN NEXT;
    RETURN;
  END IF;

  -- 11.1 Guard: Validar se já existe organização
  v_clean_cnpj := regexp_replace(coalesce(v_invite.document, ''), '[^0-9]', '', 'g');
  
  IF EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE coalesce(o.cnpj_normalized, regexp_replace(coalesce(o.cnpj, ''), '[^0-9]', '', 'g')) = v_clean_cnpj
  ) THEN
      validation_status := 'organization_exists';
      RETURN NEXT;
      RETURN;
  END IF;

  -- 12. Busca a organização remetente
  SELECT
      o.id,
      o.razao_social,
      o.nome_fantasia,
      o.name,
      o.cnpj,
      o.logo_url
  INTO v_org
  FROM public.organizations AS o
  WHERE o.id = v_invite.organization_id
  LIMIT 1;

  -- 13. Organização ausente/incompleta
  IF NOT FOUND THEN
    validation_status := 'incomplete';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_org.id IS NULL
     OR NULLIF(trim(COALESCE(v_org.razao_social, v_org.name)), '') IS NULL
     OR NULLIF(trim(v_org.cnpj), '') IS NULL THEN
    validation_status := 'incomplete';
    RETURN NEXT;
    RETURN;
  END IF;

  -- 14. Popula os dados SOMENTE NO ESTADO VALID
  validation_status := 'valid';
  id := v_invite.id;
  email := v_invite.email;
  company := v_invite.company;
  name := v_invite.name;
  document := v_invite.document;
  city := v_invite.city;
  state := v_invite.state;
  website := v_invite.website;
  segments := v_invite.segments;
  inviter_id := v_org.id;
  inviter_company := COALESCE(v_org.razao_social, v_org.name); 
  inviter_name := COALESCE(v_org.nome_fantasia, v_org.name);
  inviter_document := v_org.cnpj;
  inviter_logo_url := v_org.logo_url;
  contact_name := v_invite.contact_name;
  message := v_invite.message;
  expires_at := v_invite.expires_at;

  RETURN NEXT;
  RETURN;
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_company_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_company_invite(text) TO anon, authenticated, service_role;
