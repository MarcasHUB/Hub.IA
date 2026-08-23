-- B1-R.4D: Canonicalize operator categories for all profiles

CREATE OR REPLACE FUNCTION public.create_operator_invitation_transactional(
  p_caller_id uuid,
  p_user_id uuid,
  p_email text,
  p_nome text,
  p_sobrenome text,
  p_telefone text,
  p_cargo text,
  p_perfil public.operator_perfil,
  p_gestor_id uuid,
  p_category_ids uuid[],
  p_todas_categorias boolean,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller public.operators%ROWTYPE;
  v_existing public.operators%ROWTYPE;
  v_invitation_id uuid;
  v_normalized_email text := lower(trim(p_email));
  v_todas_categorias boolean := coalesce(p_todas_categorias, false);
  v_category_ids uuid[] := coalesce(p_category_ids, ARRAY[]::uuid[]);
  v_gestor public.operators%ROWTYPE;
BEGIN
  SELECT * INTO v_caller
  FROM public.operators
  WHERE id = p_caller_id
    AND status = 'ativo'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_FORBIDDEN';
  END IF;

  IF p_user_id IS NULL
     OR NULLIF(v_normalized_email, '') IS NULL
     OR NULLIF(trim(p_nome), '') IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_INVALID';
  END IF;

  -- B1-R.3 Categories Rules
  IF p_perfil IN ('administrador', 'auditor') THEN
    v_todas_categorias := true;
  END IF;

  -- B1-R.4D: Canonicalize category_ids for ANY profile that has todas_categorias = true
  IF v_todas_categorias THEN
    v_category_ids := ARRAY[]::uuid[];
  END IF;

  -- B1-R.3 Hierarchy Rules
  IF p_perfil = 'administrador' AND p_gestor_id IS NOT NULL THEN
    RAISE EXCEPTION 'OPERATOR_MANAGER_FORBIDDEN_FOR_ADMIN';
  END IF;

  IF p_gestor_id IS NOT NULL THEN
    SELECT * INTO v_gestor
    FROM public.operators
    WHERE id = p_gestor_id
      AND organization_id = v_caller.organization_id
      AND status = 'ativo'
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'OPERATOR_MANAGER_INVALID';
    END IF;
  ELSIF p_perfil IN ('gestor', 'comprador', 'solicitante') THEN
    RAISE EXCEPTION 'OPERATOR_MANAGER_REQUIRED';
  END IF;

  IF NOT v_todas_categorias AND array_length(v_category_ids, 1) > 0 THEN
    IF EXISTS (
      SELECT 1
      FROM unnest(v_category_ids) AS requested(category_id)
      LEFT JOIN public.categories AS c
        ON c.id = requested.category_id
       AND c.organization_id = v_caller.organization_id
      WHERE c.id IS NULL
    ) THEN
      RAISE EXCEPTION 'OPERATOR_CATEGORY_INVALID';
    END IF;
  END IF;

  INSERT INTO public.operator_invitations (
    organization_id, invited_by_id, email, nome, cargo, perfil, token,
    token_hash, status, category_ids, sent_at, expires_at, todas_categorias,
    updated_at
  ) VALUES (
    v_caller.organization_id, p_caller_id, v_normalized_email,
    concat_ws(' ', trim(p_nome), nullif(trim(p_sobrenome), '')), p_cargo,
    p_perfil, p_token_hash, p_token_hash, 'pendente',
    v_category_ids, now(), p_expires_at,
    v_todas_categorias, now()
  ) RETURNING id INTO v_invitation_id;

  DELETE FROM public.operator_categories WHERE operator_id = p_user_id;

  IF NOT v_todas_categorias AND array_length(v_category_ids, 1) > 0 THEN
    INSERT INTO public.operator_categories (operator_id, category_id)
    SELECT p_user_id, category_id
    FROM unnest(v_category_ids) AS category_id
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.operation_logs (
    operator_id, organization_id, entidade, acao, payload_depois
  ) VALUES (
    p_caller_id, v_caller.organization_id, 'operator_invitation', 'convidou',
    jsonb_build_object('email', v_normalized_email, 'perfil', p_perfil)
  );

  RETURN v_invitation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_operator_invitation_transactional(
  uuid, uuid, text, text, text, text, text, public.operator_perfil, uuid,
  uuid[], boolean, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_operator_invitation_transactional(
  uuid, uuid, text, text, text, text, text, public.operator_perfil, uuid,
  uuid[], boolean, text, timestamptz
) TO service_role;
