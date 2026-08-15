-- B1-PROD-R1: forward-only reconciliation from the proven production schema.
-- Structural changes only: no production users, organizations, partnerships, or
-- other business rows are normalized by this migration.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auditor';

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Canonical identity and tenant capabilities
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.is_current_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins AS pa
    WHERE pa.user_id = (SELECT auth.uid())
      AND pa.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION private.is_current_platform_admin()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_current_platform_admin();
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_identity()
RETURNS TABLE (
  user_id uuid,
  organization_id uuid,
  operator_profile public.operator_perfil,
  app_role public.app_role,
  is_super_admin boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_profile public.profiles%ROWTYPE;
  v_operator public.operators%ROWTYPE;
  v_operator_found boolean := false;
  v_is_platform_admin boolean := false;
  v_matching_role_count integer := 0;
  v_foreign_role_count integer := 0;
  v_app_role public.app_role;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_IDENTITY_INCONSISTENT';
  END IF;

  SELECT p.* INTO v_profile
  FROM public.profiles AS p
  WHERE p.user_id = v_user_id;

  IF NOT FOUND OR v_profile.organization_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_IDENTITY_INCONSISTENT';
  END IF;

  v_is_platform_admin := private.is_current_platform_admin();

  SELECT op.* INTO v_operator
  FROM public.operators AS op
  WHERE op.id = v_user_id;
  v_operator_found := FOUND;

  IF v_operator_found AND v_operator.organization_id <> v_profile.organization_id THEN
    RAISE EXCEPTION 'AUTH_IDENTITY_INCONSISTENT';
  END IF;

  SELECT
    count(*) FILTER (WHERE ur.organization_id = v_profile.organization_id),
    count(*) FILTER (WHERE ur.organization_id <> v_profile.organization_id)
  INTO v_matching_role_count, v_foreign_role_count
  FROM public.user_roles AS ur
  WHERE ur.user_id = v_user_id;

  IF NOT v_is_platform_admin AND (
    NOT v_operator_found
    OR v_operator.status <> 'ativo'
    OR v_operator.deleted_at IS NOT NULL
    OR v_matching_role_count = 0
    OR v_foreign_role_count > 0
  ) THEN
    RAISE EXCEPTION 'AUTH_IDENTITY_INCONSISTENT';
  END IF;

  SELECT ur.role INTO v_app_role
  FROM public.user_roles AS ur
  WHERE ur.user_id = v_user_id
    AND ur.organization_id = v_profile.organization_id
  ORDER BY CASE ur.role::text
    WHEN 'admin' THEN 1
    WHEN 'supplier_manager' THEN 2
    WHEN 'manager' THEN 3
    WHEN 'buyer' THEN 4
    WHEN 'requester' THEN 5
    WHEN 'auditor' THEN 6
    ELSE 99
  END
  LIMIT 1;

  RETURN QUERY SELECT
    v_user_id,
    v_profile.organization_id,
    CASE
      WHEN v_operator_found
       AND v_operator.status = 'ativo'
       AND v_operator.deleted_at IS NULL
      THEN v_operator.perfil
      ELSE NULL::public.operator_perfil
    END,
    v_app_role,
    v_is_platform_admin;
END;
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

REVOKE ALL ON FUNCTION public.get_current_identity_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_identity_context() TO authenticated;

CREATE OR REPLACE FUNCTION private.has_tenant_capability(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((
    SELECT CASE p_capability
      WHEN 'company_read' THEN i.operator_profile IS NOT NULL OR i.is_super_admin
      WHEN 'company_update' THEN i.operator_profile = 'administrador'
      WHEN 'operators_read' THEN i.operator_profile IN ('administrador', 'gestor', 'auditor')
      WHEN 'operators_manage' THEN i.operator_profile = 'administrador'
      WHEN 'catalog_read' THEN i.operator_profile IS NOT NULL
      WHEN 'catalog_write' THEN i.operator_profile IN ('administrador', 'comprador')
      WHEN 'quotations_read' THEN i.operator_profile IS NOT NULL
      WHEN 'quotations_write' THEN i.operator_profile IN ('administrador', 'comprador')
      WHEN 'logs_read' THEN i.operator_profile IN ('administrador', 'auditor')
      ELSE false
    END
    FROM private.current_identity() AS i
  ), false);
$$;

REVOKE ALL ON FUNCTION private.has_tenant_capability(text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_user_can(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.has_tenant_capability(p_capability);
$$;

REVOKE ALL ON FUNCTION public.current_user_can(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Private and public organization projections
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_organization_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT to_jsonb(o)
    || jsonb_build_object(
      'empresa_certificacoes', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'certification_id', ec.certification_id,
          'certifications', jsonb_build_object('id', c.id, 'name', c.name)
        ) ORDER BY c.name)
        FROM public.empresa_certificacoes AS ec
        JOIN public.certifications AS c ON c.id = ec.certification_id
        WHERE ec.organization_id = o.id
      ), '[]'::jsonb),
      'empresa_cnaes', coalesce((
        SELECT jsonb_agg(jsonb_build_object('cnae_code', e.cnae_code, 'is_primary', e.is_primary)
                         ORDER BY e.is_primary DESC, e.cnae_code)
        FROM public.empresa_cnaes AS e
        WHERE e.organization_id = o.id
      ), '[]'::jsonb),
      'empresa_estados_atendidos', coalesce((
        SELECT jsonb_agg(jsonb_build_object('state_code', e.state_code) ORDER BY e.state_code)
        FROM public.empresa_estados_atendidos AS e
        WHERE e.organization_id = o.id
      ), '[]'::jsonb),
      'organization_segments', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'segment_id', os.segment_id,
          'segments', jsonb_build_object('id', s.id, 'nome', s.nome)
        ) ORDER BY s.nome)
        FROM public.organization_segments AS os
        JOIN public.segments AS s ON s.id = os.segment_id
        WHERE os.organization_id = o.id
      ), '[]'::jsonb),
      'catalog', coalesce((
        SELECT jsonb_agg(to_jsonb(ec) ORDER BY ec.created_at)
        FROM public.empresa_catalogo AS ec
        WHERE ec.organization_id = o.id
      ), '[]'::jsonb)
    )
  FROM private.current_identity() AS i
  JOIN public.organizations AS o ON o.id = i.organization_id
  WHERE private.has_tenant_capability('company_read');
$$;

REVOKE ALL ON FUNCTION public.get_my_organization_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organization_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_organization_profile(p_target_organization_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', o.id,
    'name', coalesce(nullif(trim(o.nome_fantasia), ''), nullif(trim(o.razao_social), ''), o.name),
    'trade_name', coalesce(o.nome_fantasia, o.name),
    'description', o.description,
    'logo_url', o.logo_url,
    'website', o.website,
    'city', o.city,
    'state', o.state,
    'profile_type', o.profile_type,
    'tipo_empresa', o.tipo_empresa,
    'perfil_comercial', o.perfil_comercial,
    'company_size', o.company_size,
    'company_visibility', o.company_visibility,
    'geographic_coverage_type', o.geographic_coverage_type,
    'raio_atendimento_km', o.raio_atendimento_km,
    'service_regions', o.service_regions,
    'segment', o.segment,
    'segments', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.nome) ORDER BY s.nome)
      FROM public.organization_segments AS os
      JOIN public.segments AS s ON s.id = os.segment_id
      WHERE os.organization_id = o.id
    ), '[]'::jsonb),
    'certifications', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) ORDER BY c.name)
      FROM public.empresa_certificacoes AS ec
      JOIN public.certifications AS c ON c.id = ec.certification_id
      WHERE ec.organization_id = o.id
    ), '[]'::jsonb),
    'coverage_states', coalesce((
      SELECT jsonb_agg(e.state_code ORDER BY e.state_code)
      FROM public.empresa_estados_atendidos AS e
      WHERE e.organization_id = o.id
    ), '[]'::jsonb),
    'catalog', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ec.id,
        'material_id', ec.material_id,
        'brand', ec.brand,
        'manufacturer', ec.manufacturer,
        'description', ec.description,
        'image_url', ec.image_url,
        'material_type', ec.material_type,
        'status', ec.status
      ) ORDER BY ec.created_at)
      FROM public.empresa_catalogo AS ec
      WHERE ec.organization_id = o.id
        AND coalesce(ec.status, 'ativo') = 'ativo'
    ), '[]'::jsonb))
  FROM private.current_identity() AS caller
  JOIN public.organizations AS o ON o.id = p_target_organization_id
  WHERE o.status IN ('ativo', 'active')
    AND (NOT coalesce(o.is_platform_internal, false) OR private.is_current_platform_admin());
$$;

REVOKE ALL ON FUNCTION public.get_public_organization_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_organization_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_public_organizations()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'razao_social', o.razao_social,
    'nome_fantasia', o.nome_fantasia,
    'trade_name', coalesce(o.nome_fantasia, o.name),
    'document', o.cnpj,
    'cnpj', o.cnpj,
    'description', o.description,
    'logo_url', o.logo_url,
    'website', o.website,
    'city', o.city,
    'state', o.state,
    'profile_type', o.profile_type,
    'segment', o.segment,
    'commercial_profile', o.perfil_comercial,
    'perfil_comercial', o.perfil_comercial,
    'company_type', o.tipo_empresa,
    'tipo_empresa', o.tipo_empresa,
    'service_radius', o.raio_atendimento_km,
    'raio_atendimento_km', o.raio_atendimento_km,
    'material_count', (SELECT count(*) FROM public.organization_materials om WHERE om.organization_id = o.id),
    'segment_count', (SELECT count(*) FROM public.company_segments cs WHERE cs.organization_id = o.id)
  ) ORDER BY coalesce(o.nome_fantasia, o.name)), '[]'::jsonb)
  FROM private.current_identity() AS i
  CROSS JOIN public.organizations AS o
  WHERE (o.id <> i.organization_id OR private.is_current_platform_admin())
    AND o.status IN ('ativo', 'active')
    AND (NOT coalesce(o.is_platform_internal, false) OR private.is_current_platform_admin());
$$;

REVOKE ALL ON FUNCTION public.list_public_organizations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_public_organizations() TO authenticated;

DROP FUNCTION IF EXISTS public.find_organization_by_cnpj(text);

CREATE FUNCTION public.find_organization_by_cnpj(p_cnpj text)
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
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_match_count integer;
BEGIN
  PERFORM 1 FROM private.current_identity();

  SELECT count(*) INTO v_match_count
  FROM public.organizations AS o
  WHERE nullif(regexp_replace(coalesce(o.cnpj, ''), '[^0-9]', '', 'g'), '') =
        nullif(regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g'), '')
    AND o.status IN ('ativo', 'active')
    AND NOT coalesce(o.is_platform_internal, false);

  IF v_match_count > 1 THEN
    RAISE EXCEPTION 'ORGANIZATION_CNPJ_AMBIGUOUS';
  END IF;

  RETURN QUERY
  SELECT o.id, o.name, o.razao_social, o.nome_fantasia, o.cnpj,
         o.logo_url, o.city, o.state, o.status
  FROM public.organizations AS o
  WHERE nullif(regexp_replace(coalesce(o.cnpj, ''), '[^0-9]', '', 'g'), '') =
        nullif(regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g'), '')
    AND o.status IN ('ativo', 'active')
    AND NOT coalesce(o.is_platform_internal, false);
END;
$$;

REVOKE ALL ON FUNCTION public.find_organization_by_cnpj(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_organization_by_cnpj(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Tenant-scoped operators and platform administration
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_operators()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_identity record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_identity FROM private.current_identity();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH_IDENTITY_INCONSISTENT';
  END IF;

  IF NOT private.has_tenant_capability('operators_read') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(op) || jsonb_build_object(
    'category_ids', coalesce((
      SELECT jsonb_agg(oc.category_id ORDER BY oc.category_id)
      FROM public.operator_categories AS oc
      WHERE oc.operator_id = op.id
    ), '[]'::jsonb)
  ) ORDER BY op.nome, op.sobrenome), '[]'::jsonb)
  INTO v_result
  FROM public.operators AS op
  WHERE op.organization_id = v_identity.organization_id
    AND op.deleted_at IS NULL;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_operators() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_operators() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_organizations_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'trade_name', coalesce(o.nome_fantasia, o.name),
    'cnpj', o.cnpj,
    'logo_url', o.logo_url,
    'status', o.status,
    'profile_completion', coalesce(o.profile_completion, 0),
    'segment', o.segment,
    'operatorCount', (SELECT count(*) FROM public.operators op
                      WHERE op.organization_id = o.id AND op.deleted_at IS NULL)
  ) ORDER BY coalesce(o.nome_fantasia, o.name)), '[]'::jsonb)
  FROM public.organizations AS o
  WHERE private.is_current_platform_admin();
$$;

REVOKE ALL ON FUNCTION public.admin_list_organizations_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_organizations_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_organization_operators(p_target_organization_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', op.id,
    'nome', op.nome,
    'sobrenome', op.sobrenome,
    'email', op.email,
    'cargo', op.cargo,
    'perfil', op.perfil,
    'status', op.status,
    'created_at', op.created_at,
    'last_activity_at', op.last_activity_at
  ) ORDER BY op.nome, op.sobrenome), '[]'::jsonb)
  FROM public.operators AS op
  WHERE private.is_current_platform_admin()
    AND op.organization_id = p_target_organization_id
    AND op.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.admin_get_organization_operators(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_organization_operators(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_organization_status(
  p_target_organization_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_current_platform_admin() THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED';
  END IF;
  IF p_status NOT IN ('ativo', 'inativo') THEN
    RAISE EXCEPTION 'INVALID_ORGANIZATION_STATUS';
  END IF;
  UPDATE public.organizations SET status = p_status, updated_at = now()
  WHERE id = p_target_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_organization_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_organization_status(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Existing-organization connections. Source tenant always comes from auth.uid().
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

ALTER TABLE public.connection_requests
  ALTER COLUMN requester_approval_status SET DEFAULT 'not_required';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_requester_approval_status'
      AND conrelid = 'public.connection_requests'::regclass
  ) THEN
    ALTER TABLE public.connection_requests
      ADD CONSTRAINT chk_requester_approval_status
      CHECK (requester_approval_status IS NULL OR requester_approval_status IN (
        'pending', 'approved', 'rejected', 'not_required'
      ));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_connection_requests_requester_status
  ON public.connection_requests (requester_company_id, status, requester_approval_status);
CREATE INDEX IF NOT EXISTS idx_connection_requests_target_status
  ON public.connection_requests (target_company_id, status, requester_approval_status);

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
      AND NOT coalesce(is_platform_internal, false)
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

  RETURN v_request_id;
END;
$$;

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
DECLARE
  v_identity record;
BEGIN
  SELECT * INTO v_identity FROM private.current_identity();
  IF NOT FOUND OR v_identity.operator_profile NOT IN ('administrador', 'comprador') THEN
    RAISE EXCEPTION 'CONNECTION_CANCEL_FORBIDDEN';
  END IF;

  UPDATE public.connection_requests AS cr
  SET status = 'canceled',
      responded_by_user_id = v_identity.user_id,
      responded_at = now(),
      updated_at = now()
  WHERE cr.id = p_request_id
    AND cr.requester_company_id = v_identity.organization_id
    AND cr.status = 'pending'
    AND (
      v_identity.operator_profile = 'administrador'
      OR cr.requested_by_user_id = v_identity.user_id
    );

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
  SET status = 'canceled',
      responded_by_user_id = v_identity.user_id,
      responded_at = now(),
      updated_at = now()
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
    FROM public.connection_requests AS cr
    CROSS JOIN identity AS i
    WHERE cr.requester_company_id = i.organization_id
       OR (
         cr.target_company_id = i.organization_id
         AND (
           cr.status = 'accepted'
           OR cr.requester_approval_status IN ('approved', 'not_required')
         )
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
  FROM visible_connections AS vc
  JOIN public.organizations AS o ON o.id = vc.partner_id
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

-- -----------------------------------------------------------------------------
-- RLS reconciliation for identity, private profile, operators, and connections
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'organizations', 'profiles', 'operators', 'user_roles',
        'operator_categories', 'connection_requests'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_select_current_tenant
ON public.organizations FOR SELECT TO authenticated
USING (
  id = public.current_authenticated_organization_id()
  OR public.is_super_admin()
);

CREATE POLICY organizations_update_current_tenant
ON public.organizations FOR UPDATE TO authenticated
USING (
  id = public.current_authenticated_organization_id()
  AND public.current_user_can('company_update')
)
WITH CHECK (
  id = public.current_authenticated_organization_id()
  AND public.current_user_can('company_update')
);

CREATE POLICY profiles_select_current_tenant
ON public.profiles FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (
    organization_id = public.current_authenticated_organization_id()
    AND public.current_user_can('operators_read')
  )
);

CREATE POLICY profiles_update_self
ON public.profiles FOR UPDATE TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND organization_id = public.current_authenticated_organization_id()
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND organization_id = public.current_authenticated_organization_id()
);

CREATE POLICY operators_select_current_tenant
ON public.operators FOR SELECT TO authenticated
USING (
  organization_id = public.current_authenticated_organization_id()
  AND (
    id = (SELECT auth.uid())
    OR public.current_user_can('operators_read')
  )
);

CREATE POLICY operators_update_current_tenant
ON public.operators FOR UPDATE TO authenticated
USING (
  organization_id = public.current_authenticated_organization_id()
  AND (
    id = (SELECT auth.uid())
    OR public.current_user_can('operators_manage')
  )
)
WITH CHECK (
  organization_id = public.current_authenticated_organization_id()
  AND (
    id = (SELECT auth.uid())
    OR public.current_user_can('operators_manage')
  )
);

CREATE POLICY user_roles_select_current_tenant
ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (
    organization_id = public.current_authenticated_organization_id()
    AND public.current_user_can('operators_manage')
  )
);

CREATE POLICY operator_categories_select_current_tenant
ON public.operator_categories FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.operators AS op
  WHERE op.id = operator_categories.operator_id
    AND op.organization_id = public.current_authenticated_organization_id()
    AND (
      op.id = (SELECT auth.uid())
      OR public.current_user_can('operators_read')
    )
));

CREATE POLICY operator_categories_insert_current_tenant
ON public.operator_categories FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.operators AS op
  WHERE op.id = operator_categories.operator_id
    AND op.organization_id = public.current_authenticated_organization_id()
    AND public.current_user_can('operators_manage')
));

CREATE POLICY operator_categories_update_current_tenant
ON public.operator_categories FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.operators AS op
  WHERE op.id = operator_categories.operator_id
    AND op.organization_id = public.current_authenticated_organization_id()
    AND public.current_user_can('operators_manage')
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.operators AS op
  WHERE op.id = operator_categories.operator_id
    AND op.organization_id = public.current_authenticated_organization_id()
    AND public.current_user_can('operators_manage')
));

CREATE POLICY connection_requests_select_current_tenant
ON public.connection_requests FOR SELECT TO authenticated
USING (
  requester_company_id = public.current_authenticated_organization_id()
  OR (
    target_company_id = public.current_authenticated_organization_id()
    AND (
      status = 'accepted'
      OR requester_approval_status IN ('approved', 'not_required')
    )
  )
  OR public.is_super_admin()
);

GRANT SELECT ON public.connection_requests TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

COMMIT;
