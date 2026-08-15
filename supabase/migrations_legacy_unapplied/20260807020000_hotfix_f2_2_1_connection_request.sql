-- supabase/migrations/20260807020000_hotfix_f2_2_1_connection_request.sql

BEGIN;

-- 1. Limpeza de assinatura legada (UUID array)
DROP FUNCTION IF EXISTS public.complete_onboarding(text, uuid, text, text, text, text, text, text, text, text, text, uuid[]);

-- 2. Recria com a nova assinatura e proteção transacional corrigindo a tabela de conexões
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
  v_connection_updated integer := 0;
BEGIN
  IF NULLIF(trim(p_token), '') IS NULL THEN
    RAISE EXCEPTION 'ONBOARDING_INVITE_INVALID';
  END IF;

  -- Hash do token
  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- Verifica se convite existe e faz o lock FOR UPDATE
  SELECT
      i.id,
      i.organization_id,
      i.status,
      i.expires_at
  INTO v_invitation_record
  FROM public.invitations AS i
  WHERE i.token_hash = v_token_hash
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

  IF NULLIF(trim(p_org_name), '') IS NULL
     OR NULLIF(trim(p_org_document), '') IS NULL
     OR NULLIF(trim(p_email), '') IS NULL
     OR p_auth_id IS NULL THEN
      RAISE EXCEPTION 'ONBOARDING_REQUIRED_DATA_MISSING';
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

  -- 3. Cria o perfil do usuário (UPSERT Completo)
  INSERT INTO public.profiles (user_id, organization_id, full_name, email)
  VALUES (p_auth_id, v_org_id, p_full_name, p_email)
  ON CONFLICT (user_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;

  -- 4. Cria o operador (UPSERT Completo)
  INSERT INTO public.operators (
    id, organization_id, email, nome, perfil, status, todas_categorias, accepted_at, created_at, updated_at
  ) VALUES (
    p_auth_id, v_org_id, p_email, p_full_name, 'administrador', 'ativo', true, NOW(), NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    email = EXCLUDED.email,
    nome = EXCLUDED.nome,
    perfil = EXCLUDED.perfil,
    status = EXCLUDED.status,
    todas_categorias = EXCLUDED.todas_categorias,
    accepted_at = EXCLUDED.accepted_at,
    updated_at = now();

  -- 5. Cria o user_role
  INSERT INTO public.user_roles (
    user_id, organization_id, role, created_at
  ) VALUES (
    p_auth_id, v_org_id, p_role::public.app_role, NOW()
  ) ON CONFLICT DO NOTHING;

  -- 6. Cria a conexão B2B em connection_requests
  IF v_invitation_record.organization_id IS NOT NULL THEN
    IF NOT EXISTS (
        SELECT 1
        FROM public.connection_requests cr
        WHERE cr.status = 'accepted'
          AND (
              (
                cr.requester_company_id = v_invitation_record.organization_id
                AND cr.target_company_id = v_org_id
              )
              OR
              (
                cr.requester_company_id = v_org_id
                AND cr.target_company_id = v_invitation_record.organization_id
              )
          )
    ) THEN
        UPDATE public.connection_requests cr
        SET
            status = 'accepted',
            responded_at = now(),
            updated_at = now()
        WHERE cr.status = 'pending'
          AND (
              (
                cr.requester_company_id = v_invitation_record.organization_id
                AND cr.target_company_id = v_org_id
              )
              OR
              (
                cr.requester_company_id = v_org_id
                AND cr.target_company_id = v_invitation_record.organization_id
              )
          );

        GET DIAGNOSTICS v_connection_updated = ROW_COUNT;

        IF v_connection_updated = 0 THEN
            INSERT INTO public.connection_requests (
                requester_company_id,
                target_company_id,
                status,
                responded_at,
                created_at,
                updated_at
            )
            VALUES (
                v_invitation_record.organization_id,
                v_org_id,
                'accepted',
                now(),
                now(),
                now()
            );
        END IF;
    END IF;
  END IF;

  -- 7. Atualiza o convite para aceito
  UPDATE public.invitations
  SET status = 'aceito', updated_at = NOW()
  WHERE token_hash = v_token_hash;

  RETURN TRUE;
END;
$function$;

-- Revoga EXECUTE do public
REVOKE ALL
ON FUNCTION public.complete_onboarding(
    text, uuid, text, text, text, text, text, text, text, text, text, text[]
) FROM PUBLIC;

-- Garante EXECUTE apenas para anon, authenticated e service_role
GRANT EXECUTE
ON FUNCTION public.complete_onboarding(
    text, uuid, text, text, text, text, text, text, text, text, text, text[]
) TO anon, authenticated, service_role;

-- 8. Adiciona trigger para garantir que invites sempre usem segmentos do catálogo global
CREATE OR REPLACE FUNCTION public.validate_invitation_segments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_seg text;
  v_count int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.segments IS NOT DISTINCT FROM OLD.segments THEN
    RETURN NEW;
  END IF;

  IF NEW.segments IS NOT NULL AND array_length(NEW.segments, 1) > 0 THEN
    FOREACH v_seg IN ARRAY NEW.segments LOOP
      SELECT count(*) INTO v_count
      FROM public.segments AS s
      WHERE lower(trim(s.nome)) = lower(trim(v_seg))
        AND s.status = 'ativo'
        AND s.deleted_at IS NULL
        AND s.organization_id IS NULL;
        
      IF v_count = 0 THEN
        RAISE EXCEPTION 'INVITATION_SEGMENT_INVALID';
      ELSIF v_count > 1 THEN
        RAISE EXCEPTION 'INVITATION_SEGMENT_AMBIGUOUS';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_invitation_segments() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_validate_invitation_segments ON public.invitations;
CREATE TRIGGER trg_validate_invitation_segments
BEFORE INSERT OR UPDATE OF segments ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.validate_invitation_segments();

COMMIT;
