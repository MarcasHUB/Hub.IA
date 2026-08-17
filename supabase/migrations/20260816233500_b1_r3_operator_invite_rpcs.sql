-- Migration for Operator Invite RPCs B1-R.3
-- Implements secure identity, hierarchy enforcement, and token hashing.

-- 1. resolve_operator_invitation_identity
CREATE OR REPLACE FUNCTION public.resolve_operator_invitation_identity(
  p_caller_id uuid,
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_organization_id uuid;
  v_user_id uuid;
  v_operator_count integer;
BEGIN
  SELECT op.organization_id INTO v_caller_organization_id
  FROM public.operators AS op
  WHERE op.id = p_caller_id
    AND op.deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_UNAVAILABLE';
  END IF;

  SELECT count(*), min(op.id)
  INTO v_operator_count, v_user_id
  FROM public.operators AS op
  WHERE lower(op.email) = lower(trim(p_email))
    AND op.deleted_at IS NULL;

  IF v_operator_count > 1 OR (
    v_operator_count = 1 AND NOT EXISTS (
      SELECT 1 FROM public.operators op
      WHERE op.id = v_user_id
        AND op.organization_id = v_caller_organization_id
        AND op.deleted_at IS NULL
    )
  ) THEN
    -- Prevent cross tenant usage of operators
    RAISE EXCEPTION 'OPERATOR_CROSS_TENANT_CONFLICT';
  END IF;

  IF v_operator_count = 0 THEN
    SELECT u.id INTO v_user_id
    FROM auth.users AS u
    WHERE lower(u.email) = lower(trim(p_email));
    
    IF FOUND THEN 
       -- Reject if auth user exists but is not an operator in this org
       RAISE EXCEPTION 'OPERATOR_CROSS_TENANT_CONFLICT'; 
    END IF;
  END IF;

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_operator_invitation_identity(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_operator_invitation_identity(uuid, text) TO service_role;


-- 2. create_operator_invitation_transactional
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

    IF p_perfil IN ('auditor', 'gestor') AND v_gestor.perfil <> 'administrador' THEN
      RAISE EXCEPTION 'OPERATOR_MANAGER_HIERARCHY_INVALID';
    END IF;

    IF p_perfil = 'comprador' AND v_gestor.perfil NOT IN ('administrador', 'gestor') THEN
      RAISE EXCEPTION 'OPERATOR_MANAGER_HIERARCHY_INVALID';
    END IF;

    IF p_perfil = 'solicitante' AND v_gestor.perfil <> 'gestor' THEN
      RAISE EXCEPTION 'OPERATOR_MANAGER_HIERARCHY_INVALID';
    END IF;
  ELSE
    IF p_perfil NOT IN ('administrador', 'comprador') THEN
      RAISE EXCEPTION 'OPERATOR_MANAGER_REQUIRED';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
      AND lower(email) = v_normalized_email
  ) THEN
    RAISE EXCEPTION 'OPERATOR_AUTH_IDENTITY_MISMATCH';
  END IF;

  SELECT * INTO v_existing
  FROM public.operators
  WHERE id = p_user_id OR lower(email) = v_normalized_email
  ORDER BY CASE WHEN id = p_user_id THEN 0 ELSE 1 END
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND v_existing.organization_id <> v_caller.organization_id THEN
    RAISE EXCEPTION 'OPERATOR_CROSS_TENANT_CONFLICT';
  END IF;

  IF FOUND AND v_existing.status = 'ativo' AND v_existing.deleted_at IS NULL THEN
    RAISE EXCEPTION 'OPERATOR_ALREADY_ACTIVE';
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

  INSERT INTO public.operators (
    id, organization_id, nome, sobrenome, email, telefone, cargo, perfil,
    status, gestor_id, invited_at, deleted_at, todas_categorias, updated_at
  ) VALUES (
    p_user_id, v_caller.organization_id, trim(p_nome), coalesce(trim(p_sobrenome), ''),
    v_normalized_email, p_telefone, p_cargo, p_perfil, 'pendente', p_gestor_id,
    now(), NULL, v_todas_categorias, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    sobrenome = EXCLUDED.sobrenome,
    email = EXCLUDED.email,
    telefone = EXCLUDED.telefone,
    cargo = EXCLUDED.cargo,
    perfil = EXCLUDED.perfil,
    status = 'pendente',
    gestor_id = EXCLUDED.gestor_id,
    invited_at = now(),
    deleted_at = NULL,
    todas_categorias = EXCLUDED.todas_categorias,
    updated_at = now();

  UPDATE public.operator_invitations
  SET status = 'cancelado', cancelled_at = now(), updated_at = now()
  WHERE organization_id = v_caller.organization_id
    AND lower(email) = v_normalized_email
    AND status = 'pendente';

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


-- 3. rotate_operator_invitation_token
CREATE OR REPLACE FUNCTION public.rotate_operator_invitation_token(
  p_caller_id uuid,
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_organization_id uuid;
  v_invitation_id uuid;
BEGIN
  SELECT organization_id INTO v_caller_organization_id
  FROM public.operators
  WHERE id = p_caller_id
    AND status = 'ativo'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_FORBIDDEN';
  END IF;

  SELECT id INTO v_invitation_id
  FROM public.operator_invitations
  WHERE organization_id = v_caller_organization_id
    AND lower(email) = lower(trim(p_email))
    AND status = 'pendente'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_UNAVAILABLE';
  END IF;

  UPDATE public.operator_invitations
  SET token_hash = p_token_hash,
      token = p_token_hash, -- for legacy compatibility if token col exists
      expires_at = p_expires_at,
      updated_at = now()
  WHERE id = v_invitation_id;

  INSERT INTO public.operation_logs (
    operator_id, organization_id, entidade, acao, payload_depois
  ) VALUES (
    p_caller_id, v_caller_organization_id, 'operator_invitation', 'reenviou',
    jsonb_build_object('email', lower(trim(p_email)))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_operator_invitation_token(uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_operator_invitation_token(uuid, text, text, timestamptz) TO service_role;
