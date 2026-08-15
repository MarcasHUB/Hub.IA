-- B1: identidade organizacional, convites de operador e parcerias B2B.
-- Esta migration não contém correções dependentes de empresas ou usuários específicos.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE IF EXISTS public.invitations_backup_before_cleanup_f2_2
  SET SCHEMA private;

-- -----------------------------------------------------------------------------
-- Identidade canônica do usuário autenticado
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.current_identity()
RETURNS TABLE (
  user_id uuid,
  organization_id uuid,
  operator_profile public.operator_perfil,
  app_role public.app_role,
  is_super_admin boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.user_id,
    p.organization_id,
    o.perfil,
    ur.role,
    coalesce(p.is_super_admin, false)
  FROM public.profiles AS p
  LEFT JOIN public.operators AS o
    ON o.id = p.user_id
   AND o.organization_id = p.organization_id
   AND o.status = 'ativo'
   AND o.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT role
    FROM public.user_roles
    WHERE user_id = p.user_id
      AND organization_id = p.organization_id
    ORDER BY
      CASE role::text
        WHEN 'admin' THEN 1
        WHEN 'supplier_manager' THEN 2
        WHEN 'manager' THEN 3
        WHEN 'buyer' THEN 4
        WHEN 'requester' THEN 5
        WHEN 'auditor' THEN 6
        ELSE 99
      END
    LIMIT 1
  ) AS ur ON true
  WHERE p.user_id = (SELECT auth.uid())
    AND p.organization_id IS NOT NULL
    AND (
      coalesce(p.is_super_admin, false)
      OR (o.id IS NOT NULL AND ur.role IS NOT NULL)
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.current_identity()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_authenticated_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organization_id FROM private.current_identity();
$$;

REVOKE ALL ON FUNCTION public.current_authenticated_organization_id()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_authenticated_organization_id()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_current_identity_context()
RETURNS TABLE (
  user_id uuid,
  organization_id uuid,
  full_name text,
  avatar_url text,
  is_super_admin boolean,
  operator_profile text,
  app_role text,
  organization_name text,
  organization_logo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    i.user_id,
    i.organization_id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.full_name), ''), p.email),
    p.avatar_url,
    i.is_super_admin,
    i.operator_profile::text,
    i.app_role::text,
    coalesce(nullif(trim(o.nome_fantasia), ''), nullif(trim(o.razao_social), ''), o.name),
    o.logo_url
  FROM private.current_identity() AS i
  JOIN public.profiles AS p ON p.user_id = i.user_id
  JOIN public.organizations AS o ON o.id = i.organization_id;
$$;

REVOKE ALL ON FUNCTION public.get_current_identity_context()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_identity_context()
  TO authenticated;

-- -----------------------------------------------------------------------------
-- Tokens de convites de operador: apenas hashes persistidos
-- -----------------------------------------------------------------------------

ALTER TABLE public.operator_invitations
  ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE public.operator_invitations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.operator_invitations
SET token_hash = CASE
  WHEN token ~ '^[0-9a-fA-F]{64}$' THEN lower(token)
  ELSE encode(extensions.digest(token, 'sha256'), 'hex')
END
WHERE token_hash IS NULL;

ALTER TABLE public.operator_invitations
  ALTER COLUMN token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_invitations_token_hash
  ON public.operator_invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_operator_invitations_org_status_email
  ON public.operator_invitations (organization_id, status, lower(email));

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
BEGIN
  SELECT * INTO v_caller
  FROM public.operators
  WHERE id = p_caller_id
    AND perfil = 'administrador'
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

  IF p_gestor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.operators
    WHERE id = p_gestor_id
      AND organization_id = v_caller.organization_id
      AND status = 'ativo'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'OPERATOR_MANAGER_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(coalesce(p_category_ids, ARRAY[]::uuid[])) AS requested(category_id)
    LEFT JOIN public.categories AS c
      ON c.id = requested.category_id
     AND c.organization_id = v_caller.organization_id
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'OPERATOR_CATEGORY_INVALID';
  END IF;

  INSERT INTO public.operators (
    id, organization_id, nome, sobrenome, email, telefone, cargo, perfil,
    status, gestor_id, invited_at, deleted_at, todas_categorias, updated_at
  ) VALUES (
    p_user_id, v_caller.organization_id, trim(p_nome), coalesce(trim(p_sobrenome), ''),
    v_normalized_email, p_telefone, p_cargo, p_perfil, 'pendente', p_gestor_id,
    now(), NULL, coalesce(p_todas_categorias, false), now()
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
    coalesce(p_category_ids, ARRAY[]::uuid[]), now(), p_expires_at,
    coalesce(p_todas_categorias, false), now()
  ) RETURNING id INTO v_invitation_id;

  DELETE FROM public.operator_categories WHERE operator_id = p_user_id;

  IF NOT coalesce(p_todas_categorias, false) THEN
    INSERT INTO public.operator_categories (operator_id, category_id)
    SELECT p_user_id, category_id
    FROM unnest(coalesce(p_category_ids, ARRAY[]::uuid[])) AS category_id
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

CREATE OR REPLACE FUNCTION public.rotate_operator_invitation_token(
  p_caller_id uuid,
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_invitation_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM public.operators
  WHERE id = p_caller_id
    AND perfil = 'administrador'
    AND status = 'ativo'
    AND deleted_at IS NULL;

  IF v_org_id IS NULL THEN RAISE EXCEPTION 'OPERATOR_INVITE_FORBIDDEN'; END IF;
  IF p_token_hash !~ '^[0-9a-f]{64}$' OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_INVALID';
  END IF;

  UPDATE public.operator_invitations
  SET token = p_token_hash,
      token_hash = p_token_hash,
      sent_at = now(),
      expires_at = p_expires_at,
      email_status = NULL,
      email_error = NULL,
      updated_at = now()
  WHERE id = (
    SELECT id
    FROM public.operator_invitations
    WHERE organization_id = v_org_id
      AND lower(email) = lower(trim(p_email))
      AND status = 'pendente'
    ORDER BY sent_at DESC
    LIMIT 1
    FOR UPDATE
  )
  RETURNING id INTO v_invitation_id;

  IF v_invitation_id IS NULL THEN RAISE EXCEPTION 'OPERATOR_INVITE_NOT_FOUND'; END IF;
  RETURN v_invitation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_operator_invitation_token(uuid, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_operator_invitation_token(uuid, text, text, timestamptz)
  TO service_role;

DROP FUNCTION IF EXISTS public.accept_operator_invitation_transactional(text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.accept_operator_invitation_transactional(
  p_token_hash text,
  p_user_id uuid,
  p_ip text,
  p_user_agent text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.operator_invitations%ROWTYPE;
  v_app_role public.app_role;
  v_user_email text;
BEGIN
  SELECT * INTO v_invite
  FROM public.operator_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'OPERATOR_INVITE_NOT_FOUND'; END IF;
  IF v_invite.status = 'aceito' THEN RETURN true; END IF;
  IF v_invite.status <> 'pendente' THEN RAISE EXCEPTION 'OPERATOR_INVITE_NOT_PENDING'; END IF;
  IF v_invite.expires_at <= now() THEN RAISE EXCEPTION 'OPERATOR_INVITE_EXPIRED'; END IF;

  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = p_user_id;
  IF v_user_email IS DISTINCT FROM lower(v_invite.email) THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_EMAIL_MISMATCH';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
      AND organization_id IS NOT NULL
      AND organization_id <> v_invite.organization_id
  ) OR EXISTS (
    SELECT 1 FROM public.operators
    WHERE id = p_user_id
      AND organization_id <> v_invite.organization_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND organization_id <> v_invite.organization_id
  ) THEN
    RAISE EXCEPTION 'OPERATOR_CROSS_TENANT_CONFLICT';
  END IF;

  v_app_role := CASE v_invite.perfil
    WHEN 'administrador' THEN 'admin'::public.app_role
    WHEN 'comprador' THEN 'buyer'::public.app_role
    WHEN 'gestor' THEN 'supplier_manager'::public.app_role
    WHEN 'solicitante' THEN 'requester'::public.app_role
    WHEN 'auditor' THEN 'auditor'::public.app_role
    ELSE NULL
  END;

  IF v_app_role IS NULL THEN RAISE EXCEPTION 'OPERATOR_ROLE_INVALID'; END IF;

  INSERT INTO public.profiles (user_id, organization_id, full_name, email, updated_at)
  VALUES (p_user_id, v_invite.organization_id, v_invite.nome, v_invite.email, now())
  ON CONFLICT (user_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = coalesce(nullif(public.profiles.full_name, ''), EXCLUDED.full_name),
    email = EXCLUDED.email,
    updated_at = now();

  UPDATE public.operators
  SET status = 'ativo',
      organization_id = v_invite.organization_id,
      accepted_at = now(),
      updated_at = now(),
      deleted_at = NULL
  WHERE id = p_user_id
    AND organization_id = v_invite.organization_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'OPERATOR_IDENTITY_INCOMPLETE'; END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id
    AND organization_id = v_invite.organization_id;

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (p_user_id, v_invite.organization_id, v_app_role);

  UPDATE public.operator_invitations
  SET status = 'aceito',
      accepted_at = now(),
      updated_at = now(),
      ip_aceite = left(p_ip, 128),
      user_agent_aceite = left(p_user_agent, 512)
  WHERE id = v_invite.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_operator_invitation_transactional(text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_operator_invitation_transactional(text, uuid, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_operator_invitation(
  p_email text,
  p_operator_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_identity record;
BEGIN
  SELECT * INTO v_identity FROM private.current_identity();
  IF NOT FOUND OR v_identity.operator_profile <> 'administrador' THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_FORBIDDEN';
  END IF;

  UPDATE public.operator_invitations
  SET status = 'cancelado', cancelled_at = now(), updated_at = now()
  WHERE organization_id = v_identity.organization_id
    AND lower(email) = lower(trim(p_email))
    AND status = 'pendente';

  UPDATE public.operators
  SET status = 'cancelado', updated_at = now()
  WHERE id = p_operator_id
    AND organization_id = v_identity.organization_id
    AND status = 'pendente';

  IF NOT FOUND THEN RAISE EXCEPTION 'OPERATOR_INVITE_NOT_FOUND'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_operator_invitation(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_operator_invitation(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_pending_operator_invitation(
  p_operator_id uuid,
  p_nome text,
  p_cargo text,
  p_perfil public.operator_perfil,
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
  v_email text;
BEGIN
  SELECT * INTO v_identity FROM private.current_identity();
  IF NOT FOUND OR v_identity.operator_profile <> 'administrador' THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_FORBIDDEN';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(coalesce(p_category_ids, ARRAY[]::uuid[])) requested(category_id)
    LEFT JOIN public.categories c
      ON c.id = requested.category_id
     AND c.organization_id = v_identity.organization_id
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'OPERATOR_CATEGORY_INVALID';
  END IF;

  UPDATE public.operators
  SET nome = coalesce(nullif(trim(p_nome), ''), nome),
      cargo = p_cargo,
      perfil = p_perfil,
      todas_categorias = coalesce(p_todas_categorias, false),
      updated_at = now()
  WHERE id = p_operator_id
    AND organization_id = v_identity.organization_id
    AND status = 'pendente'
  RETURNING email INTO v_email;

  IF v_email IS NULL THEN RAISE EXCEPTION 'OPERATOR_INVITE_NOT_FOUND'; END IF;

  UPDATE public.operator_invitations
  SET nome = coalesce(nullif(trim(p_nome), ''), nome),
      cargo = p_cargo,
      perfil = p_perfil,
      todas_categorias = coalesce(p_todas_categorias, false),
      category_ids = coalesce(p_category_ids, ARRAY[]::uuid[]),
      updated_at = now()
  WHERE organization_id = v_identity.organization_id
    AND lower(email) = lower(v_email)
    AND status = 'pendente';

  DELETE FROM public.operator_categories WHERE operator_id = p_operator_id;
  IF NOT coalesce(p_todas_categorias, false) THEN
    INSERT INTO public.operator_categories (operator_id, category_id)
    SELECT p_operator_id, category_id
    FROM unnest(coalesce(p_category_ids, ARRAY[]::uuid[])) category_id
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_pending_operator_invitation(
  uuid, text, text, public.operator_perfil, boolean, uuid[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_pending_operator_invitation(
  uuid, text, text, public.operator_perfil, boolean, uuid[]
) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_operator_invitation_email_delivery(
  p_token_hash text,
  p_status text,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_identity record;
BEGIN
  SELECT * INTO v_identity FROM private.current_identity();
  IF NOT FOUND OR v_identity.operator_profile <> 'administrador' THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_FORBIDDEN';
  END IF;
  IF p_token_hash !~ '^[0-9a-f]{64}$' OR p_status NOT IN ('sent', 'failed') THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_DELIVERY_INVALID';
  END IF;

  UPDATE public.operator_invitations
  SET email_status = p_status,
      email_error = CASE WHEN p_status = 'failed' THEN left(p_error, 1000) ELSE NULL END,
      email_sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE email_sent_at END,
      updated_at = now()
  WHERE organization_id = v_identity.organization_id
    AND token_hash = p_token_hash
    AND status = 'pendente';

  IF NOT FOUND THEN RAISE EXCEPTION 'OPERATOR_INVITE_NOT_FOUND'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_operator_invitation_email_delivery(text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_operator_invitation_email_delivery(text, text, text)
  TO authenticated;

REVOKE ALL ON public.operator_invitations FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- Parcerias: leitura e mutações sempre derivam o tenant de auth.uid()
-- -----------------------------------------------------------------------------

ALTER TABLE public.connection_requests
  ADD COLUMN IF NOT EXISTS requester_approval_status text;
ALTER TABLE public.connection_requests
  ADD COLUMN IF NOT EXISTS requester_approved_by uuid REFERENCES auth.users(id);
ALTER TABLE public.connection_requests
  ADD COLUMN IF NOT EXISTS requester_approved_at timestamptz;
ALTER TABLE public.connection_requests
  ADD COLUMN IF NOT EXISTS requester_rejected_by uuid REFERENCES auth.users(id);
ALTER TABLE public.connection_requests
  ADD COLUMN IF NOT EXISTS requester_rejected_at timestamptz;
ALTER TABLE public.connection_requests
  ADD COLUMN IF NOT EXISTS requester_rejection_reason text;

UPDATE public.connection_requests AS cr
SET requester_approval_status = CASE
  WHEN cr.status = 'pending' AND EXISTS (
    SELECT 1 FROM public.operators o
    WHERE o.id = cr.requested_by_user_id AND o.perfil = 'comprador'
  ) THEN 'pending'
  ELSE 'not_required'
END
WHERE requester_approval_status IS NULL;

ALTER TABLE public.connection_requests
  ALTER COLUMN requester_approval_status SET DEFAULT 'not_required';
ALTER TABLE public.connection_requests
  ALTER COLUMN requester_approval_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_requester_approval_status'
      AND conrelid = 'public.connection_requests'::regclass
  ) THEN
    ALTER TABLE public.connection_requests
      ADD CONSTRAINT chk_requester_approval_status
      CHECK (requester_approval_status IN ('pending', 'approved', 'rejected', 'not_required'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_connection_requests_requester_status
  ON public.connection_requests (requester_company_id, status, requester_approval_status);
CREATE INDEX IF NOT EXISTS idx_connection_requests_target_status
  ON public.connection_requests (target_company_id, status, requester_approval_status);

DROP POLICY IF EXISTS "Target company managers can update connection requests" ON public.connection_requests;
DROP POLICY IF EXISTS "Users can view connection requests related to their company" ON public.connection_requests;
DROP POLICY IF EXISTS "Users can create connection requests for their company" ON public.connection_requests;
DROP POLICY IF EXISTS "connection_requests_select_own_organizations" ON public.connection_requests;
DROP POLICY IF EXISTS "connection_requests_select_super_admin" ON public.connection_requests;
DROP POLICY IF EXISTS "Super admins can see all connection requests" ON public.connection_requests;
DROP POLICY IF EXISTS "tenant_connection_requests_select" ON public.connection_requests;
DROP POLICY IF EXISTS "connection_requests_select_tenant" ON public.connection_requests;

CREATE POLICY connection_requests_select_tenant
ON public.connection_requests
FOR SELECT
TO authenticated
USING (
  requester_company_id = (SELECT public.current_authenticated_organization_id())
  OR (
    target_company_id = (SELECT public.current_authenticated_organization_id())
    AND requester_approval_status IN ('approved', 'not_required')
  )
  OR (SELECT public.is_super_admin())
);

REVOKE INSERT, UPDATE, DELETE ON public.connection_requests FROM anon, authenticated;
REVOKE SELECT ON public.connection_requests FROM anon;
GRANT SELECT ON public.connection_requests TO authenticated;

DROP TRIGGER IF EXISTS on_connection_request_created ON public.connection_requests;
DROP TRIGGER IF EXISTS on_connection_request_updated ON public.connection_requests;
DROP FUNCTION IF EXISTS public.notify_on_connection_request_insert();
DROP FUNCTION IF EXISTS public.notify_on_connection_request_update();

CREATE OR REPLACE FUNCTION public.request_connection(
  p_target_company_id uuid,
  p_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_identity record;
  v_approval text;
  v_request_id uuid;
BEGIN
  SELECT * INTO v_identity FROM private.current_identity();
  IF NOT FOUND THEN RAISE EXCEPTION 'IDENTITY_NOT_AUTHORIZED'; END IF;
  IF v_identity.organization_id = p_target_company_id THEN RAISE EXCEPTION 'CONNECTION_SELF_FORBIDDEN'; END IF;
  IF v_identity.operator_profile NOT IN ('administrador', 'comprador') THEN
    RAISE EXCEPTION 'CONNECTION_REQUEST_FORBIDDEN';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_target_company_id
      AND status IN ('ativo', 'active')
      AND coalesce(is_platform_internal, false) = false
  ) THEN
    RAISE EXCEPTION 'CONNECTION_TARGET_INVALID';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      least(v_identity.organization_id, p_target_company_id)::text || ':' ||
      greatest(v_identity.organization_id, p_target_company_id)::text,
      0
    )
  );

  IF EXISTS (
    SELECT 1 FROM public.connection_requests
    WHERE status IN ('pending', 'accepted')
      AND (
        (requester_company_id = v_identity.organization_id AND target_company_id = p_target_company_id)
        OR (requester_company_id = p_target_company_id AND target_company_id = v_identity.organization_id)
      )
  ) THEN
    RAISE EXCEPTION 'CONNECTION_ALREADY_EXISTS';
  END IF;

  v_approval := CASE
    WHEN v_identity.operator_profile = 'administrador' THEN 'not_required'
    ELSE 'pending'
  END;

  INSERT INTO public.connection_requests (
    requester_company_id, target_company_id, requested_by_user_id, status,
    requester_approval_status, message
  ) VALUES (
    v_identity.organization_id, p_target_company_id, v_identity.user_id,
    'pending', v_approval, nullif(trim(p_message), '')
  ) RETURNING id INTO v_request_id;

  IF v_approval = 'pending' THEN
    INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id)
    SELECT id, 'Aprovação interna necessária', 'Nova solicitação de parceria aguardando aprovação.',
           'connection_request', 'connection_requests', v_request_id
    FROM public.operators
    WHERE organization_id = v_identity.organization_id
      AND perfil = 'administrador'
      AND status = 'ativo'
      AND deleted_at IS NULL;
  ELSE
    INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id)
    SELECT id, 'Nova solicitação de parceria', 'Uma empresa deseja se conectar.',
           'connection_request', 'connection_requests', v_request_id
    FROM public.operators
    WHERE organization_id = p_target_company_id
      AND perfil IN ('administrador', 'gestor')
      AND status = 'ativo'
      AND deleted_at IS NULL;
  END IF;

  RETURN v_request_id;
END;
$$;

DROP FUNCTION IF EXISTS public.request_connection(uuid);
REVOKE ALL ON FUNCTION public.request_connection(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_connection(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_internal_connection(
  p_request_id uuid,
  p_approve boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_identity record;
  v_request public.connection_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_identity FROM private.current_identity();
  IF NOT FOUND OR v_identity.operator_profile <> 'administrador' THEN
    RAISE EXCEPTION 'CONNECTION_REVIEW_FORBIDDEN';
  END IF;

  SELECT * INTO v_request FROM public.connection_requests
  WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND
     OR v_request.requester_company_id <> v_identity.organization_id
     OR v_request.status <> 'pending'
     OR v_request.requester_approval_status <> 'pending' THEN
    RAISE EXCEPTION 'CONNECTION_REVIEW_INVALID';
  END IF;

  IF p_approve THEN
    UPDATE public.connection_requests
    SET requester_approval_status = 'approved',
        requester_approved_by = v_identity.user_id,
        requester_approved_at = now(),
        requester_rejected_by = NULL,
        requester_rejected_at = NULL,
        requester_rejection_reason = NULL,
        updated_at = now()
    WHERE id = p_request_id;

    INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id)
    SELECT id, 'Nova solicitação de parceria', 'Uma empresa deseja se conectar.',
           'connection_request', 'connection_requests', p_request_id
    FROM public.operators
    WHERE organization_id = v_request.target_company_id
      AND perfil IN ('administrador', 'gestor')
      AND status = 'ativo'
      AND deleted_at IS NULL;
  ELSE
    UPDATE public.connection_requests
    SET status = 'rejected',
        requester_approval_status = 'rejected',
        requester_rejected_by = v_identity.user_id,
        requester_rejected_at = now(),
        requester_rejection_reason = nullif(trim(p_reason), ''),
        responded_by_user_id = v_identity.user_id,
        responded_at = now(),
        updated_at = now()
    WHERE id = p_request_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_internal_connection(uuid, boolean, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_internal_connection(uuid, boolean, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_connection_request(
  p_request_id uuid,
  p_accept boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_identity record;
  v_request public.connection_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_identity FROM private.current_identity();
  IF NOT FOUND OR v_identity.operator_profile NOT IN ('administrador', 'gestor') THEN
    RAISE EXCEPTION 'CONNECTION_RESPONSE_FORBIDDEN';
  END IF;

  SELECT * INTO v_request FROM public.connection_requests
  WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND
     OR v_request.target_company_id <> v_identity.organization_id
     OR v_request.status <> 'pending'
     OR v_request.requester_approval_status NOT IN ('approved', 'not_required') THEN
    RAISE EXCEPTION 'CONNECTION_RESPONSE_INVALID';
  END IF;

  UPDATE public.connection_requests
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
      responded_by_user_id = v_identity.user_id,
      responded_at = now(),
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) ||
        CASE WHEN p_accept THEN '{}'::jsonb
             ELSE jsonb_build_object('rejection_reason', nullif(trim(p_reason), '')) END
  WHERE id = p_request_id;

  INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id)
  SELECT id,
         CASE WHEN p_accept THEN 'Parceria aceita' ELSE 'Solicitação de parceria recusada' END,
         CASE WHEN p_accept THEN 'Sua solicitação de parceria foi aceita.' ELSE 'Sua solicitação de parceria foi recusada.' END,
         CASE WHEN p_accept THEN 'connection_accepted' ELSE 'connection_request' END,
         'connection_requests', p_request_id
  FROM public.operators
  WHERE organization_id = v_request.requester_company_id
    AND status = 'ativo'
    AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_connection_request(uuid, boolean, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_connection_request(uuid, boolean, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_connection_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_identity record;
BEGIN
  SELECT * INTO v_identity FROM private.current_identity();
  IF NOT FOUND THEN RAISE EXCEPTION 'IDENTITY_NOT_AUTHORIZED'; END IF;

  UPDATE public.connection_requests
  SET status = 'canceled', responded_by_user_id = v_identity.user_id,
      responded_at = now(), updated_at = now()
  WHERE id = p_request_id
    AND requester_company_id = v_identity.organization_id
    AND status = 'pending';

  IF NOT FOUND THEN RAISE EXCEPTION 'CONNECTION_CANCEL_INVALID'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_connection_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_connection_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.disconnect_partner(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_identity record;
  v_request public.connection_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_identity FROM private.current_identity();
  IF NOT FOUND OR v_identity.operator_profile <> 'administrador' THEN
    RAISE EXCEPTION 'CONNECTION_DISCONNECT_FORBIDDEN';
  END IF;

  SELECT * INTO v_request FROM public.connection_requests
  WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND
     OR v_request.status <> 'accepted'
     OR v_identity.organization_id NOT IN (v_request.requester_company_id, v_request.target_company_id) THEN
    RAISE EXCEPTION 'CONNECTION_DISCONNECT_INVALID';
  END IF;

  UPDATE public.connection_requests
  SET status = 'canceled', responded_by_user_id = v_identity.user_id,
      responded_at = now(), updated_at = now()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.disconnect_partner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disconnect_partner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_partner_connections()
RETURNS TABLE (
  connection_id uuid,
  partner_organization_id uuid,
  partner_name text,
  partner_document text,
  partner_segment text,
  partner_city text,
  partner_state text,
  partner_email text,
  partner_phone text,
  partner_website text,
  partner_commercial_profile text,
  partner_company_type text,
  partner_service_radius integer,
  connection_status text,
  requester_approval_status text,
  direction text,
  can_review_internal boolean,
  can_respond boolean,
  connected_at timestamptz,
  message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH identity AS (
    SELECT * FROM private.current_identity()
  ), visible_connections AS (
    SELECT
      cr.*,
      i.organization_id AS caller_org_id,
      i.operator_profile AS caller_profile,
      CASE WHEN cr.requester_company_id = i.organization_id
           THEN cr.target_company_id ELSE cr.requester_company_id END AS partner_id
    FROM public.connection_requests cr
    CROSS JOIN identity i
    WHERE cr.requester_company_id = i.organization_id
       OR (
         cr.target_company_id = i.organization_id
         AND cr.requester_approval_status IN ('approved', 'not_required')
       )
  )
  SELECT
    vc.id,
    o.id,
    coalesce(nullif(trim(o.nome_fantasia), ''), nullif(trim(o.razao_social), ''), o.name),
    o.cnpj,
    CASE
      WHEN jsonb_typeof(o.segment) = 'string' THEN trim(both '"' from o.segment::text)
      ELSE NULL
    END,
    o.city,
    o.state,
    coalesce(o.email_corporativo, o.business_email),
    coalesce(o.telefone, o.phone),
    o.website,
    o.perfil_comercial,
    o.tipo_empresa,
    o.raio_atendimento_km,
    vc.status,
    vc.requester_approval_status,
    CASE WHEN vc.requester_company_id = vc.caller_org_id THEN 'sent' ELSE 'received' END,
    vc.requester_company_id = vc.caller_org_id
      AND vc.caller_profile = 'administrador'
      AND vc.status = 'pending'
      AND vc.requester_approval_status = 'pending',
    vc.target_company_id = vc.caller_org_id
      AND vc.caller_profile IN ('administrador', 'gestor')
      AND vc.status = 'pending'
      AND vc.requester_approval_status IN ('approved', 'not_required'),
    coalesce(vc.responded_at, vc.created_at),
    vc.message
  FROM visible_connections vc
  JOIN public.organizations o ON o.id = vc.partner_id
  WHERE vc.status IN ('pending', 'accepted')
  ORDER BY vc.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_partner_connections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_partner_connections() TO authenticated;

CREATE OR REPLACE VIEW public.active_partnerships
WITH (security_invoker = true)
AS
SELECT
  partner_organization_id,
  connection_id,
  connection_status AS status
FROM public.list_partner_connections()
WHERE connection_status = 'accepted';

REVOKE ALL ON public.active_partnerships FROM PUBLIC, anon;
GRANT SELECT ON public.active_partnerships TO authenticated;

COMMIT;
