-- B1-R.1: isolamento multi-tenant, RBAC canonico e projecoes seguras.
-- Nenhuma funcao deste arquivo aceita organization_id como autoridade do chamador.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

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

-- Mantem o contrato legado, mas elimina profiles.is_super_admin como autoridade.
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.user_id,
    p.organization_id,
    op.perfil,
    ur.role,
    private.is_current_platform_admin()
  FROM public.profiles AS p
  LEFT JOIN public.operators AS op
    ON op.id = p.user_id
   AND op.organization_id = p.organization_id
   AND op.status = 'ativo'
   AND op.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT r.role
    FROM public.user_roles AS r
    WHERE r.user_id = p.user_id
      AND r.organization_id = p.organization_id
    ORDER BY CASE r.role::text
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
      private.is_current_platform_admin()
      OR (op.id IS NOT NULL AND ur.role IS NOT NULL)
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.current_identity()
  FROM PUBLIC, anon, authenticated, service_role;

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
      WHEN 'company_read' THEN i.operator_profile IS NOT NULL
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

-- Perfil privado: o tenant vem exclusivamente de auth.uid().
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

-- Perfil publico: projecao explicita; nunca retorna contatos/endereco privados.
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
  WHERE o.status = 'ativo'
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
    AND o.status = 'ativo'
    AND (NOT coalesce(o.is_platform_internal, false) OR private.is_current_platform_admin());
$$;

REVOKE ALL ON FUNCTION public.list_public_organizations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_public_organizations() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_operators()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(op) || jsonb_build_object(
    'category_ids', coalesce((
      SELECT jsonb_agg(oc.category_id ORDER BY oc.category_id)
      FROM public.operator_categories oc WHERE oc.operator_id = op.id
    ), '[]'::jsonb)
  ) ORDER BY op.nome, op.sobrenome), '[]'::jsonb)
  FROM private.current_identity() AS i
  JOIN public.operators AS op ON op.organization_id = i.organization_id
  WHERE private.has_tenant_capability('operators_read')
    AND op.deleted_at IS NULL;
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

-- Resolucao interna de identidade para convite: resposta neutra ao Edge Function.
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
    AND op.perfil = 'administrador'
    AND op.status = 'ativo'
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
    RAISE EXCEPTION 'OPERATOR_INVITE_UNAVAILABLE';
  END IF;

  IF v_operator_count = 0 THEN
    SELECT u.id INTO v_user_id
    FROM auth.users AS u
    WHERE lower(u.email) = lower(trim(p_email));
    IF FOUND THEN RAISE EXCEPTION 'OPERATOR_INVITE_UNAVAILABLE'; END IF;
  END IF;

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_operator_invitation_identity(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_operator_invitation_identity(uuid, text)
  TO service_role;

-- Cancelamento: admin cancela qualquer solicitacao do tenant; comprador apenas a propria.
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

-- CNPJ: normalizacao, auditoria previa e unicidade concorrente para todo onboarding.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS cnpj_normalized text
  GENERATED ALWAYS AS (nullif(regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g'), '')) STORED;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.organizations
    WHERE cnpj_normalized IS NOT NULL
    GROUP BY cnpj_normalized HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'ORGANIZATION_CNPJ_DUPLICATES_REQUIRE_HUMAN_REVIEW';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_cnpj_normalized_unique
  ON public.organizations (cnpj_normalized)
  WHERE cnpj_normalized IS NOT NULL;

CREATE OR REPLACE FUNCTION private.lock_organization_cnpj()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_normalized text;
BEGIN
  v_normalized := nullif(regexp_replace(coalesce(NEW.cnpj, ''), '[^0-9]', '', 'g'), '');
  IF v_normalized IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_normalized, 0));
    IF EXISTS (
      SELECT 1
      FROM public.organizations AS existing
      WHERE existing.cnpj_normalized = v_normalized
        AND existing.id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'ORGANIZATION_ALREADY_EXISTS' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.lock_organization_cnpj()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS organizations_lock_cnpj_before_write ON public.organizations;
CREATE TRIGGER organizations_lock_cnpj_before_write
BEFORE INSERT OR UPDATE OF cnpj ON public.organizations
FOR EACH ROW EXECUTE FUNCTION private.lock_organization_cnpj();

DROP FUNCTION IF EXISTS public.find_organization_by_cnpj(text);

CREATE OR REPLACE FUNCTION public.find_organization_by_cnpj(p_cnpj text)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  trade_name text,
  logo_url text,
  city text,
  state text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.id, o.name, coalesce(o.nome_fantasia, o.name), o.logo_url, o.city, o.state
  FROM private.current_identity() AS caller
  JOIN public.organizations AS o
    ON o.cnpj_normalized = nullif(regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g'), '')
  WHERE o.status = 'ativo'
    AND NOT coalesce(o.is_platform_internal, false)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_organization_by_cnpj(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_organization_by_cnpj(text) TO authenticated;

-- RLS: remove politicas herdadas conflitantes e recria por operacao.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'organizations', 'operators', 'categories', 'quotation_requests',
        'quotation_decisions', 'access_logs', 'operation_logs',
        'empresa_catalogo', 'empresa_certificacoes', 'empresa_cnaes',
        'empresa_estados_atendidos', 'organization_segments', 'operator_categories'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_select_own ON public.organizations
FOR SELECT TO authenticated
USING (id = public.current_authenticated_organization_id());
CREATE POLICY organizations_update_own_admin ON public.organizations
FOR UPDATE TO authenticated
USING (
  id = public.current_authenticated_organization_id()
  AND public.current_user_can('company_update')
)
WITH CHECK (
  id = public.current_authenticated_organization_id()
  AND public.current_user_can('company_update')
);
REVOKE INSERT, DELETE ON public.organizations FROM anon, authenticated;
REVOKE SELECT, UPDATE ON public.organizations FROM anon;

ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY operators_select_own_authorized ON public.operators
FOR SELECT TO authenticated
USING (
  organization_id = public.current_authenticated_organization_id()
  AND public.current_user_can('operators_read')
);
CREATE POLICY operators_update_own_admin ON public.operators
FOR UPDATE TO authenticated
USING (
  organization_id = public.current_authenticated_organization_id()
  AND public.current_user_can('operators_manage')
)
WITH CHECK (
  organization_id = public.current_authenticated_organization_id()
  AND public.current_user_can('operators_manage')
);
REVOKE INSERT, DELETE ON public.operators FROM anon, authenticated;
REVOKE SELECT, UPDATE ON public.operators FROM anon;

ALTER TABLE public.operator_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY operator_categories_select_own ON public.operator_categories
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.operators op
  WHERE op.id = operator_categories.operator_id
    AND op.organization_id = public.current_authenticated_organization_id()
    AND public.current_user_can('operators_read')
));
CREATE POLICY operator_categories_insert_own_admin ON public.operator_categories
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_can('operators_manage')
  AND EXISTS (
    SELECT 1 FROM public.operators op
    WHERE op.id = operator_categories.operator_id
      AND op.organization_id = public.current_authenticated_organization_id()
  )
  AND EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = operator_categories.category_id
      AND (c.organization_id IS NULL OR c.organization_id = public.current_authenticated_organization_id())
  )
);
CREATE POLICY operator_categories_delete_own_admin ON public.operator_categories
FOR DELETE TO authenticated
USING (
  public.current_user_can('operators_manage')
  AND EXISTS (
    SELECT 1 FROM public.operators op
    WHERE op.id = operator_categories.operator_id
      AND op.organization_id = public.current_authenticated_organization_id()
  )
);
REVOKE UPDATE ON public.operator_categories FROM authenticated;
REVOKE ALL ON public.operator_categories FROM anon;

-- Dados privados que compoem "Minha Empresa" ficam acessiveis diretamente
-- apenas para o proprio tenant. A projecao publica e feita pelas RPCs acima.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'empresa_catalogo', 'empresa_certificacoes', 'empresa_cnaes',
    'empresa_estados_atendidos', 'organization_segments'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (organization_id = public.current_authenticated_organization_id())',
      table_name || '_select_own', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_authenticated_organization_id() AND public.current_user_can(''company_update''))',
      table_name || '_insert_own_admin', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (organization_id = public.current_authenticated_organization_id() AND public.current_user_can(''company_update'')) WITH CHECK (organization_id = public.current_authenticated_organization_id() AND public.current_user_can(''company_update''))',
      table_name || '_update_own_admin', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (organization_id = public.current_authenticated_organization_id() AND public.current_user_can(''company_update''))',
      table_name || '_delete_own_admin', table_name
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', table_name);
  END LOOP;
END;
$$;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_select_scoped ON public.categories
FOR SELECT TO authenticated
USING (
  organization_id IS NULL
  OR organization_id = public.current_authenticated_organization_id()
);
CREATE POLICY categories_insert_scoped ON public.categories
FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_authenticated_organization_id()
  AND public.current_user_can('catalog_write')
);
CREATE POLICY categories_update_scoped ON public.categories
FOR UPDATE TO authenticated
USING (
  organization_id = public.current_authenticated_organization_id()
  AND public.current_user_can('catalog_write')
)
WITH CHECK (
  organization_id = public.current_authenticated_organization_id()
  AND public.current_user_can('catalog_write')
);
CREATE POLICY categories_delete_scoped ON public.categories
FOR DELETE TO authenticated
USING (
  organization_id = public.current_authenticated_organization_id()
  AND public.current_user_can('catalog_write')
);
REVOKE ALL ON public.categories FROM anon;

ALTER TABLE public.quotation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotation_requests_select_scoped ON public.quotation_requests
FOR SELECT TO authenticated
USING (
  organization_id = public.current_authenticated_organization_id()
  AND public.current_user_can('quotations_read')
);
CREATE POLICY quotation_requests_insert_scoped ON public.quotation_requests
FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_authenticated_organization_id()
  AND created_by = (SELECT auth.uid())
  AND public.current_user_can('quotations_write')
);
CREATE POLICY quotation_requests_update_scoped ON public.quotation_requests
FOR UPDATE TO authenticated
USING (
  organization_id = public.current_authenticated_organization_id()
  AND public.current_user_can('quotations_write')
)
WITH CHECK (organization_id = public.current_authenticated_organization_id());
CREATE POLICY quotation_requests_delete_scoped ON public.quotation_requests
FOR DELETE TO authenticated
USING (
  organization_id = public.current_authenticated_organization_id()
  AND public.current_user_can('quotations_write')
);
REVOKE ALL ON public.quotation_requests FROM anon;

ALTER TABLE public.quotation_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotation_decisions_select_scoped ON public.quotation_decisions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.quotation_requests qr
  WHERE qr.id = quotation_decisions.request_id
    AND qr.organization_id = public.current_authenticated_organization_id()
    AND public.current_user_can('quotations_read')
));
CREATE POLICY quotation_decisions_insert_scoped ON public.quotation_decisions
FOR INSERT TO authenticated
WITH CHECK (
  decision_by = (SELECT auth.uid())
  AND public.current_user_can('quotations_write')
  AND EXISTS (
    SELECT 1 FROM public.quotation_requests qr
    WHERE qr.id = quotation_decisions.request_id
      AND qr.organization_id = public.current_authenticated_organization_id()
  )
);
REVOKE UPDATE, DELETE ON public.quotation_decisions FROM authenticated;
REVOKE ALL ON public.quotation_decisions FROM anon;

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY access_logs_select_scoped ON public.access_logs
FOR SELECT TO authenticated
USING (
  organization_id = public.current_authenticated_organization_id()
  AND public.current_user_can('logs_read')
);
REVOKE INSERT, UPDATE, DELETE ON public.access_logs FROM anon, authenticated;
REVOKE SELECT ON public.access_logs FROM anon;

ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY operation_logs_select_scoped ON public.operation_logs
FOR SELECT TO authenticated
USING (
  organization_id = public.current_authenticated_organization_id()
  AND public.current_user_can('logs_read')
);
REVOKE INSERT, UPDATE, DELETE ON public.operation_logs FROM anon, authenticated;
REVOKE SELECT ON public.operation_logs FROM anon;

COMMIT;
