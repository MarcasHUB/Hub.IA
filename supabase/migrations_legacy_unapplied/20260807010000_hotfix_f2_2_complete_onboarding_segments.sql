-- supabase/migrations/20260807010000_hotfix_f2_2_complete_onboarding_segments.sql

-- 1. Remove a assinatura antiga
DROP FUNCTION IF EXISTS public.complete_onboarding(text, uuid, text, text, text, text, text, text, text, text, text, uuid[]);

-- 2. Recria com a nova assinatura e proteção transacional
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
    p_segments text[]
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  v_org_id uuid;
  v_seg_id uuid;
  v_slug text;
  v_token_hash text;
  v_invitation_record record;
  v_status_norm text;
  v_seg_text text;
  v_count integer;
  v_record record;
  v_resolved_segments uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Hash do token
  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- Verifica se convite existe e faz o lock FOR UPDATE
  SELECT * INTO v_invitation_record
  FROM public.invitations
  WHERE token_hash = v_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_INVITE_INVALID';
  END IF;

  -- Normaliza status e valida
  v_status_norm := lower(trim(coalesce(v_invitation_record.status, '')));
  IF v_status_norm NOT IN ('pending', 'pendente') THEN
    RAISE EXCEPTION 'ONBOARDING_INVITE_INVALID';
  END IF;

  IF coalesce(v_invitation_record.expires_at, '9999-12-31'::timestamptz) <= now() THEN
    RAISE EXCEPTION 'ONBOARDING_INVITE_EXPIRED';
  END IF;

  -- Valida e resolve todos os segmentos ANTES de inserir outras entidades
  IF p_segments IS NOT NULL AND array_length(p_segments, 1) > 0 THEN
    FOREACH v_seg_text IN ARRAY p_segments LOOP
      v_count := 0;
      FOR v_record IN 
          SELECT id 
          FROM public.segments 
          WHERE lower(trim(nome)) = lower(trim(v_seg_text))
            AND status = 'ativo'
            AND deleted_at IS NULL
            AND organization_id IS NULL
      LOOP
          v_count := v_count + 1;
          v_seg_id := v_record.id;
      END LOOP;

      IF v_count = 0 THEN
          RAISE EXCEPTION 'ONBOARDING_SEGMENT_NOT_FOUND';
      ELSIF v_count > 1 THEN
          RAISE EXCEPTION 'ONBOARDING_SEGMENT_AMBIGUOUS';
      END IF;

      v_resolved_segments := array_append(v_resolved_segments, v_seg_id);
    END LOOP;
  END IF;

  -- Gera slug único
  v_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || floor(extract(epoch from now()))::text;

  -- 1. Cria a organização
  INSERT INTO public.organizations (
    name, slug, razao_social, nome_fantasia, cnpj, city, state, website, status
  ) VALUES (
    p_org_name, v_slug, p_org_name, p_org_trade_name, p_org_document,
    p_org_city, p_org_state, p_org_website, 'ativo'
  ) RETURNING id INTO v_org_id;

  -- 2. Insere os segmentos vinculando ao UUID real
  IF array_length(v_resolved_segments, 1) > 0 THEN
    FOREACH v_seg_id IN ARRAY v_resolved_segments LOOP
      INSERT INTO public.company_segments (organization_id, segment_id)
      VALUES (v_org_id, v_seg_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- 3. Cria o perfil do usuário
  INSERT INTO public.profiles (user_id, organization_id, full_name, email)
  VALUES (p_auth_id, v_org_id, p_full_name, p_email)
  ON CONFLICT (user_id) DO UPDATE SET
    organization_id = v_org_id,
    full_name = p_full_name;

  -- 4. Cria o operador (PK é auth_id)
  INSERT INTO public.operators (
    id, organization_id, email, nome, perfil, status, todas_categorias, accepted_at, created_at, updated_at
  ) VALUES (
    p_auth_id, v_org_id, p_email, p_full_name, 'administrador', 'ativo', true, NOW(), NOW(), NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- 5. Cria o user_role
  INSERT INTO public.user_roles (
    user_id, organization_id, role, created_at
  ) VALUES (
    p_auth_id, v_org_id, p_role::public.app_role, NOW()
  ) ON CONFLICT DO NOTHING;

  -- 6. Cria a conexão B2B
  IF v_invitation_record.organization_id IS NOT NULL THEN
    INSERT INTO public.organization_connections (
      requester_id, target_id, status, created_at
    ) VALUES (
      v_invitation_record.organization_id, v_org_id, 'connected', NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 7. Atualiza o convite para aceito
  UPDATE public.invitations
  SET status = 'aceito', updated_at = NOW()
  WHERE token_hash = v_token_hash;

  RETURN TRUE;
END;
$function$;

-- Revoga EXECUTE do public
REVOKE EXECUTE ON FUNCTION public.complete_onboarding(text, uuid, text, text, text, text, text, text, text, text, text, text[]) FROM PUBLIC;

-- Garante EXECUTE apenas para anon e authenticated
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, uuid, text, text, text, text, text, text, text, text, text, text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, uuid, text, text, text, text, text, text, text, text, text, text[]) TO authenticated;
