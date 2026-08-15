CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT extensions.plan(13);

INSERT INTO public.organizations (id, name, slug, cnpj, status, is_platform_internal)
VALUES
  ('71000000-0000-4000-8000-000000000001', 'Tenant A Fixture', 'tenant-a-fixture', '71.000.000/0001-01', 'ativo', false),
  ('72000000-0000-4000-8000-000000000001', 'Tenant B Fixture', 'tenant-b-fixture', '72.000.000/0001-02', 'ativo', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', '71000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin-a@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '71000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'buyer-a@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '72000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin-b@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '73000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'inconsistent@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '74000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'platform@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, user_id, organization_id, full_name, email, status)
VALUES
  ('71000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', 'Admin A', 'admin-a@local.invalid', 'active'),
  ('71000000-0000-4000-8000-000000000102', '71000000-0000-4000-8000-000000000102', '71000000-0000-4000-8000-000000000001', 'Buyer A', 'buyer-a@local.invalid', 'active'),
  ('72000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000001', 'Admin B', 'admin-b@local.invalid', 'active'),
  ('73000000-0000-4000-8000-000000000101', '73000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', 'Inconsistent', 'inconsistent@local.invalid', 'active'),
  ('74000000-0000-4000-8000-000000000101', '74000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', 'Platform Admin', 'platform@local.invalid', 'active')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.operators (id, organization_id, nome, sobrenome, email, perfil, status)
VALUES
  ('71000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', 'Admin', 'A', 'admin-a@local.invalid', 'administrador', 'ativo'),
  ('71000000-0000-4000-8000-000000000102', '71000000-0000-4000-8000-000000000001', 'Buyer', 'A', 'buyer-a@local.invalid', 'comprador', 'ativo'),
  ('72000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000001', 'Admin', 'B', 'admin-b@local.invalid', 'administrador', 'ativo'),
  ('73000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000001', 'Inconsistent', 'Fixture', 'inconsistent@local.invalid', 'comprador', 'ativo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, organization_id, role)
VALUES
  ('71000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', 'admin'),
  ('71000000-0000-4000-8000-000000000102', '71000000-0000-4000-8000-000000000001', 'buyer'),
  ('72000000-0000-4000-8000-000000000101', '72000000-0000-4000-8000-000000000001', 'admin'),
  ('73000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', 'buyer')
ON CONFLICT (user_id, organization_id, role) DO NOTHING;

INSERT INTO public.platform_admins (user_id, role, status)
VALUES ('74000000-0000-4000-8000-000000000101', 'platform_admin', 'active')
ON CONFLICT (user_id) DO NOTHING;

CREATE FUNCTION pg_temp.request_connection_source(p_target_organization_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_request_id uuid;
  v_source_organization_id uuid;
BEGIN
  v_request_id := public.request_connection(p_target_organization_id, 'fixture request');
  SELECT cr.requester_company_id INTO v_source_organization_id
  FROM public.connection_requests AS cr
  WHERE cr.id = v_request_id;
  RETURN v_source_organization_id;
END;
$$;

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000101', true);
SELECT extensions.is(
  (SELECT organization_id FROM public.get_current_identity_context()),
  '71000000-0000-4000-8000-000000000001'::uuid,
  'admin A identity derives tenant A from auth.uid'
);
SELECT extensions.is(
  (public.get_my_organization_profile()->>'id')::uuid,
  '71000000-0000-4000-8000-000000000001'::uuid,
  'private organization profile is tenant A'
);
SELECT extensions.is(jsonb_array_length(public.get_my_operators()), 2, 'admin A reads only tenant A operators');
SELECT extensions.is((SELECT count(*)::integer FROM public.organizations), 1, 'direct organization read is tenant scoped');
SELECT extensions.ok(
  public.list_public_organizations() @> '[{"id":"72000000-0000-4000-8000-000000000001"}]'::jsonb,
  'public organization list exposes tenant B through the safe projection'
);
SELECT extensions.ok(
  NOT (public.get_public_organization_profile('72000000-0000-4000-8000-000000000001') ? 'business_email'),
  'public organization profile does not expose business email'
);

SELECT set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000102', true);
SELECT extensions.throws_ok(
  $$ SELECT public.get_my_operators() $$,
  'P0001', 'FORBIDDEN',
  'buyer without operators_read fails explicitly'
);

SELECT set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000101', true);
SELECT extensions.is(
  (public.get_my_organization_profile()->>'id')::uuid,
  '72000000-0000-4000-8000-000000000001'::uuid,
  'tenant B profile remains isolated from tenant A'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.organizations WHERE id = '71000000-0000-4000-8000-000000000001'),
  0,
  'tenant B cannot directly read tenant A organization'
);

SELECT set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.get_current_identity_context() $$,
  'P0001', 'AUTH_IDENTITY_INCONSISTENT',
  'contradictory profile and operator tenant fails closed'
);

SELECT set_config('request.jwt.claim.sub', '74000000-0000-4000-8000-000000000101', true);
SELECT extensions.is(
  (SELECT is_super_admin FROM public.get_current_identity_context()),
  true,
  'platform admin derives authority from platform_admins'
);

SELECT set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000101', true);
SELECT extensions.is(
  pg_temp.request_connection_source('72000000-0000-4000-8000-000000000001'),
  '71000000-0000-4000-8000-000000000001'::uuid,
  'request_connection derives the source tenant from auth.uid'
);

SELECT extensions.is(
  (SELECT count(*)::integer FROM pg_catalog.pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('organizations', 'profiles', 'operators', 'user_roles', 'operator_categories', 'connection_requests')
     AND (qual = 'true' OR with_check = 'true')),
  0,
  'reconciled critical tables have no unconditional policies'
);

SELECT * FROM extensions.finish();
ROLLBACK;
