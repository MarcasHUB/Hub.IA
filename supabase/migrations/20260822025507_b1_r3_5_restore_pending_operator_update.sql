-- B1-R.3.5U: restore tenant-safe editing of a pending operator invitation.
-- E-mail, token, expiration and profile identity are intentionally immutable
-- in this contract.

DROP FUNCTION IF EXISTS public.update_pending_operator_invitation(
  uuid, text, text, public.operator_perfil, boolean, uuid[]
);

CREATE OR REPLACE FUNCTION public.update_pending_operator_invitation(
  p_operator_id uuid,
  p_nome text,
  p_sobrenome text,
  p_telefone text,
  p_cargo text,
  p_perfil public.operator_perfil,
  p_gestor_id uuid,
  p_todas_categorias boolean,
  p_category_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_identity record;
  v_operator public.operators%ROWTYPE;
  v_invitation public.operator_invitations%ROWTYPE;
  v_manager public.operators%ROWTYPE;
  v_normalized_email text;
  v_auth_email text;
  v_pending_invitation_ids uuid[];
  v_category_ids uuid[] := coalesce(p_category_ids, ARRAY[]::uuid[]);
  v_todas_categorias boolean := coalesce(p_todas_categorias, false);
  v_updated_at timestamptz := now();
BEGIN
  SELECT *
  INTO v_identity
  FROM private.current_identity();

  IF NOT FOUND
     OR NOT private.has_tenant_capability('operators_manage') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_operator_id IS NULL
     OR nullif(trim(p_nome), '') IS NULL
     OR p_perfil IS NULL THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_INVALID';
  END IF;

  SELECT op.*
  INTO v_operator
  FROM public.operators AS op
  WHERE op.id = p_operator_id
    AND op.organization_id = v_identity.organization_id
  FOR UPDATE;

  IF NOT FOUND OR v_operator.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_NOT_FOUND';
  END IF;

  IF v_operator.status <> 'pendente' THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_NOT_PENDING';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    WHERE ur.user_id = v_operator.id
  ) THEN
    RAISE EXCEPTION 'OPERATOR_IDENTITY_INCONSISTENT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.user_id = v_operator.id
      AND p.organization_id IS NOT NULL
      AND p.organization_id <> v_identity.organization_id
  ) THEN
    RAISE EXCEPTION 'OPERATOR_CROSS_TENANT_CONFLICT';
  END IF;

  v_normalized_email := lower(trim(v_operator.email));
  IF nullif(v_normalized_email, '') IS NULL THEN
    RAISE EXCEPTION 'OPERATOR_AUTH_IDENTITY_MISMATCH';
  END IF;

  SELECT lower(trim(u.email))
  INTO v_auth_email
  FROM auth.users AS u
  WHERE u.id = v_operator.id;

  IF NOT FOUND OR v_auth_email IS DISTINCT FROM v_normalized_email THEN
    RAISE EXCEPTION 'OPERATOR_AUTH_IDENTITY_MISMATCH';
  END IF;

  SELECT array_agg(oi.id ORDER BY oi.id)
  INTO v_pending_invitation_ids
  FROM public.operator_invitations AS oi
  WHERE oi.organization_id = v_identity.organization_id
    AND lower(trim(oi.email)) = v_normalized_email
    AND oi.status = 'pendente';

  IF coalesce(cardinality(v_pending_invitation_ids), 0) = 0 THEN
    IF EXISTS (
      SELECT 1
      FROM public.operator_invitations AS oi
      WHERE oi.organization_id = v_identity.organization_id
        AND lower(trim(oi.email)) = v_normalized_email
    ) THEN
      RAISE EXCEPTION 'OPERATOR_INVITE_NOT_PENDING';
    END IF;
    RAISE EXCEPTION 'OPERATOR_INVITE_NOT_FOUND';
  ELSIF cardinality(v_pending_invitation_ids) > 1 THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_IDENTITY_INCONSISTENT';
  END IF;

  SELECT oi.*
  INTO v_invitation
  FROM public.operator_invitations AS oi
  WHERE oi.id = v_pending_invitation_ids[1]
    AND oi.organization_id = v_identity.organization_id
    AND lower(trim(oi.email)) = v_normalized_email
    AND oi.status = 'pendente'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_NOT_PENDING';
  END IF;

  IF v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_EXPIRED';
  END IF;

  IF p_perfil IN ('administrador', 'auditor') THEN
    v_todas_categorias := true;
  END IF;

  IF v_todas_categorias THEN
    v_category_ids := ARRAY[]::uuid[];
  END IF;

  IF p_perfil = 'administrador' AND p_gestor_id IS NOT NULL THEN
    RAISE EXCEPTION 'OPERATOR_MANAGER_FORBIDDEN_FOR_ADMIN';
  END IF;

  IF p_gestor_id IS NOT NULL THEN
    SELECT op.*
    INTO v_manager
    FROM public.operators AS op
    WHERE op.id = p_gestor_id
      AND op.organization_id = v_identity.organization_id
      AND op.status = 'ativo'
      AND op.deleted_at IS NULL
    FOR KEY SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'OPERATOR_MANAGER_INVALID';
    END IF;

    IF p_perfil IN ('auditor', 'gestor')
       AND v_manager.perfil <> 'administrador' THEN
      RAISE EXCEPTION 'OPERATOR_MANAGER_HIERARCHY_INVALID';
    END IF;

    IF p_perfil = 'comprador'
       AND v_manager.perfil NOT IN ('administrador', 'gestor') THEN
      RAISE EXCEPTION 'OPERATOR_MANAGER_HIERARCHY_INVALID';
    END IF;

    IF p_perfil = 'solicitante'
       AND v_manager.perfil <> 'gestor' THEN
      RAISE EXCEPTION 'OPERATOR_MANAGER_HIERARCHY_INVALID';
    END IF;
  ELSIF p_perfil NOT IN ('administrador', 'comprador') THEN
    RAISE EXCEPTION 'OPERATOR_MANAGER_REQUIRED';
  END IF;

  IF NOT v_todas_categorias
     AND EXISTS (
       SELECT 1
       FROM unnest(v_category_ids) AS requested(category_id)
       LEFT JOIN public.categories AS c
         ON c.id = requested.category_id
        AND c.organization_id = v_identity.organization_id
       WHERE c.id IS NULL
     ) THEN
    RAISE EXCEPTION 'OPERATOR_CATEGORY_INVALID';
  END IF;

  UPDATE public.operators
  SET nome = trim(p_nome),
      sobrenome = coalesce(trim(p_sobrenome), ''),
      telefone = nullif(trim(p_telefone), ''),
      cargo = p_cargo,
      perfil = p_perfil,
      gestor_id = p_gestor_id,
      todas_categorias = v_todas_categorias,
      updated_at = v_updated_at
  WHERE id = v_operator.id
    AND organization_id = v_identity.organization_id
    AND status = 'pendente'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_NOT_PENDING';
  END IF;

  UPDATE public.operator_invitations
  SET nome = concat_ws(
        ' ',
        nullif(trim(p_nome), ''),
        nullif(trim(p_sobrenome), '')
      ),
      cargo = p_cargo,
      perfil = p_perfil,
      todas_categorias = v_todas_categorias,
      category_ids = v_category_ids,
      updated_at = v_updated_at
  WHERE id = v_invitation.id
    AND organization_id = v_identity.organization_id
    AND status = 'pendente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_NOT_PENDING';
  END IF;

  DELETE FROM public.operator_categories
  WHERE operator_id = v_operator.id;

  IF NOT v_todas_categorias
     AND cardinality(v_category_ids) > 0 THEN
    INSERT INTO public.operator_categories (operator_id, category_id)
    SELECT v_operator.id, requested.category_id
    FROM unnest(v_category_ids) AS requested(category_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_pending_operator_invitation(
  uuid, text, text, text, text, public.operator_perfil, uuid, boolean, uuid[]
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_pending_operator_invitation(
  uuid, text, text, text, text, public.operator_perfil, uuid, boolean, uuid[]
) TO authenticated;
