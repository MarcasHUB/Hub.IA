-- 28_hotfix_e1_onboarding.sql

-- Enable pgcrypto if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Update validate_company_invite
CREATE OR REPLACE FUNCTION public.validate_company_invite(p_token text)
 RETURNS TABLE(id uuid, name character varying, company character varying, email character varying, document character varying, status character varying, city text, state text, contact_name text, website text, segments uuid[])
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT 
    i.id, i.name, i.company, i.email, i.document, i.status,
    i.city, i.state, i.contact_name, i.website, i.segments
  FROM public.invitations i
  WHERE i.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND i.status = 'pendente'
    AND i.expires_at > now();
$function$;

-- 2. Update complete_onboarding
CREATE OR REPLACE FUNCTION public.complete_onboarding(
    p_token text,
    p_auth_id uuid,
    p_email text,
    p_full_name text,
    p_role text,
    p_org_name text,
    p_org_trade_name text,
    p_org_document text,
    p_org_city text,
    p_org_state text,
    p_org_website text,
    p_segments uuid[]
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_org_id uuid;
  v_seg_id uuid;
  v_slug   text;
  v_token_hash text;
  v_invitation_record record;
BEGIN
  -- Hash the token
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  -- Verify token exists and is valid
  SELECT * INTO v_invitation_record
  FROM public.invitations
  WHERE token_hash = v_token_hash AND status = 'pendente' AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido, aceito ou expirado.';
  END IF;

  -- Gera slug único: "RAIZEN ENERGIA S.A" → "raizen-energia-s-a-1753415345"
  v_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || floor(extract(epoch from now()))::text;

  -- 1. Cria a organização com os nomes reais das colunas
  INSERT INTO public.organizations (
    name, slug, razao_social, nome_fantasia, cnpj, city, state, website, status
  ) VALUES (
    p_org_name, v_slug, p_org_name, p_org_trade_name, p_org_document,
    p_org_city, p_org_state, p_org_website, 'ativo'
  ) RETURNING id INTO v_org_id;

  -- 2. Insere os segmentos vinculando ao UUID real da org
  IF p_segments IS NOT NULL AND array_length(p_segments, 1) > 0 THEN
    FOREACH v_seg_id IN ARRAY p_segments LOOP
      INSERT INTO public.company_segments (organization_id, segment_id)
      VALUES (v_org_id, v_seg_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- 3. Cria o perfil do usuário na tabela profiles vinculando à organização
  INSERT INTO public.profiles (user_id, organization_id, full_name, email)
  VALUES (p_auth_id, v_org_id, p_full_name, p_email)
  ON CONFLICT (user_id) DO UPDATE SET
    organization_id = v_org_id,
    full_name = p_full_name;

  -- 4. Cria o operador (PK é o próprio auth.users.id)
  INSERT INTO public.operators (
    id, organization_id, email, nome, perfil, status, todas_categorias, accepted_at, created_at, updated_at
  ) VALUES (
    p_auth_id, v_org_id, p_email, p_full_name, 'administrador', 'ativo', true, NOW(), NOW(), NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- 5. Cria o user_role garantindo acesso multi-tenant no sistema
  INSERT INTO public.user_roles (
    user_id, organization_id, role, created_at
  ) VALUES (
    p_auth_id, v_org_id, p_role::app_role, NOW()
  ) ON CONFLICT DO NOTHING;

  -- 6. Cria a conexão B2B com a empresa remetente, se aplicável
  IF v_invitation_record.organization_id IS NOT NULL THEN
    INSERT INTO public.organization_connections (
      requester_id, target_id, status, created_at
    ) VALUES (
      v_invitation_record.organization_id, v_org_id, 'connected', NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 7. Atualiza o convite para aceito (move de Convites Pendentes para Parceiros)
  UPDATE public.invitations
  SET status = 'aceito', updated_at = NOW()
  WHERE token_hash = v_token_hash;

  RETURN TRUE;
END;
$function$;
