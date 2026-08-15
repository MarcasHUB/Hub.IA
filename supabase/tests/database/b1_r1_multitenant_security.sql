CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT extensions.plan(28);

-- Fixtures adicionais, exclusivamente transacionais.
INSERT INTO public.organizations (id, name, slug, cnpj, status)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'Target C Local', 'target-c-local', '40.000.000/0001-04', 'ativo'),
  ('50000000-0000-0000-0000-000000000001', 'Target D Local', 'target-d-local', '50.000.000/0001-05', 'ativo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'buyer@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'manager@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'requester@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, user_id, organization_id, full_name, email, status, is_super_admin)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', 'Buyer Local', 'buyer@local.invalid', 'active', false),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', 'Manager Local', 'manager@local.invalid', 'active', false),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', 'Requester Local', 'requester@local.invalid', 'active', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.operators (id, organization_id, nome, sobrenome, email, perfil, status)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', 'Buyer', 'Local', 'buyer@local.invalid', 'comprador', 'ativo'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', 'Manager', 'Local', 'manager@local.invalid', 'gestor', 'ativo'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', 'Requester', 'Local', 'requester@local.invalid', 'solicitante', 'ativo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, organization_id, role)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', 'buyer'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', 'manager'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', 'requester')
ON CONFLICT (user_id, organization_id, role) DO NOTHING;

INSERT INTO public.connection_requests (
  id, requester_company_id, target_company_id, status, requested_by_user_id,
  requester_approval_status
) VALUES
  ('60000000-0000-0000-0000-000000000001', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', '40000000-0000-0000-0000-000000000001', 'pending', 'aaaaaaaa-0000-0000-0000-000000000001', 'not_required'),
  ('60000000-0000-0000-0000-000000000002', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', '50000000-0000-0000-0000-000000000001', 'pending', 'f45e8c1b-2c50-4cca-86b3-f14cf45b951b', 'not_required')
ON CONFLICT (id) DO NOTHING;

CREATE FUNCTION pg_temp.try_update_organization(p_id uuid, p_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.organizations SET name = p_name WHERE id = p_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Tenant admin A.
SELECT set_config('request.jwt.claim.sub', 'f45e8c1b-2c50-4cca-86b3-f14cf45b951b', true);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  (public.get_my_organization_profile()->>'id')::uuid,
  '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1'::uuid,
  'perfil privado deriva o tenant A de auth.uid'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.organizations),
  1,
  'SELECT direto de organizations enxerga somente o proprio tenant'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.organizations WHERE id = '4e45c319-82d3-4cb7-b5f1-107290445325'),
  0,
  'tenant A nao le organization privada B'
);
SELECT extensions.ok(
  NOT (public.get_public_organization_profile('4e45c319-82d3-4cb7-b5f1-107290445325') ? 'business_email'),
  'perfil publico B nao expoe business_email'
);
SELECT extensions.ok(
  NOT (public.get_public_organization_profile('4e45c319-82d3-4cb7-b5f1-107290445325') ? 'cnpj'),
  'perfil publico B nao expoe CNPJ'
);
SELECT extensions.is(
  jsonb_array_length(public.get_my_operators()),
  (SELECT count(*)::integer FROM public.operators WHERE organization_id = '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1'),
  'lista de operadores e tenant-scoped'
);
SELECT extensions.is(
  pg_temp.try_update_organization('4e45c319-82d3-4cb7-b5f1-107290445325', 'cross-tenant-blocked'),
  0,
  'admin tenant nao atualiza outro tenant via API direta'
);
SELECT extensions.is(public.is_super_admin(), false, 'tenant admin nao e ADM Global');
SELECT extensions.is(
  public.list_public_organizations() @> '[{"id":"68a2f0b2-80f7-4868-bbb9-30b531c12db2"}]'::jsonb,
  false,
  'tenant comum nao ve Hub.IA na Rede'
);

-- Comprador: cancela somente solicitacao propria.
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
SELECT extensions.lives_ok(
  $$ SELECT public.cancel_connection_request('60000000-0000-0000-0000-000000000001') $$,
  'comprador cancela solicitacao criada por ele'
);
SELECT extensions.throws_ok(
  $$ SELECT public.cancel_connection_request('60000000-0000-0000-0000-000000000002') $$,
  'P0001', 'CONNECTION_CANCEL_INVALID',
  'comprador nao cancela solicitacao de outro usuario'
);

-- Gestor nao cancela.
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000002', true);
SELECT extensions.throws_ok(
  $$ SELECT public.cancel_connection_request('60000000-0000-0000-0000-000000000002') $$,
  'P0001', 'CONNECTION_CANCEL_FORBIDDEN',
  'gestor nao cancela connection request'
);

-- Solicitante: sem mutacoes criticas.
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000003', true);
SELECT extensions.is(public.current_user_can('operators_manage'), false, 'solicitante nao gerencia operadores');
SELECT extensions.is(public.current_user_can('company_update'), false, 'solicitante nao edita organization');
SELECT extensions.throws_ok(
  $$ INSERT INTO public.access_logs (operator_id, organization_id, tipo, resultado)
     VALUES ('aaaaaaaa-0000-0000-0000-000000000003', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', 'login', 'forged') $$,
  '42501', NULL,
  'solicitante nao forja access_log'
);
SELECT extensions.throws_ok(
  $$ INSERT INTO public.operation_logs (operator_id, organization_id, entidade, acao)
     VALUES ('aaaaaaaa-0000-0000-0000-000000000003', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', 'fake', 'fake') $$,
  '42501', NULL,
  'solicitante nao forja operation_log'
);

-- Auditor: leitura permitida, escrita negada.
SELECT set_config('request.jwt.claim.sub', '2b8ac705-c356-430d-9788-0e60e7821724', true);
SELECT extensions.is(public.current_user_can('logs_read'), true, 'auditor le logs do proprio tenant');
SELECT extensions.is(public.current_user_can('operators_manage'), false, 'auditor nao gerencia operadores');
SELECT extensions.is(
  pg_temp.try_update_organization('9e2e4d9c-9a9b-42cb-81cb-b2c861335af1', 'auditor-blocked'),
  0,
  'auditor nao atualiza propria organization'
);

-- Admin tenant pode governar o proprio tenant.
SELECT set_config('request.jwt.claim.sub', 'f45e8c1b-2c50-4cca-86b3-f14cf45b951b', true);
SELECT extensions.is(public.current_user_can('operators_manage'), true, 'admin tenant gerencia operadores do proprio tenant');
SELECT extensions.lives_ok(
  $$ SELECT public.cancel_connection_request('60000000-0000-0000-0000-000000000002') $$,
  'admin tenant cancela solicitacao do proprio tenant'
);

-- ADM Global depende de platform_admins e usa RPC dedicada.
SELECT set_config('request.jwt.claim.sub', '32a5db3a-e0d1-4ed4-aef4-27edf75d817d', true);
SELECT extensions.is(public.is_super_admin(), true, 'ADM Global deriva de platform_admins ativo');
SELECT extensions.ok(jsonb_array_length(public.admin_list_organizations_summary()) >= 3, 'ADM Global usa resumo administrativo dedicado');
SELECT extensions.is(
  public.list_public_organizations() @> '[{"id":"68a2f0b2-80f7-4868-bbb9-30b531c12db2"}]'::jsonb,
  true,
  'ADM Global ve Hub.IA conforme regra administrativa'
);

-- Anonimo nao executa perfis protegidos.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT extensions.throws_ok(
  $$ SELECT public.get_my_organization_profile() $$,
  '42501', NULL,
  'anon nao executa perfil privado'
);

RESET ROLE;
SELECT extensions.throws_ok(
  $$ INSERT INTO public.organizations (name, slug, cnpj, status)
     VALUES ('Duplicate CNPJ', 'duplicate-cnpj', '20.000.000/0001-02', 'ativo') $$,
  '23505', NULL,
  'CNPJ normalizado duplicado e bloqueado'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM pg_catalog.pg_policies
   WHERE schemaname = 'public'
     AND tablename IN (
       'organizations','operators','operator_categories','categories','quotation_requests',
       'quotation_decisions','access_logs','operation_logs','empresa_catalogo',
       'empresa_certificacoes','empresa_cnaes','empresa_estados_atendidos','organization_segments'
     )
     AND (qual = 'true' OR with_check = 'true')),
  0,
  'tabelas criticas nao possuem policy USING/WITH CHECK true'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM information_schema.routine_privileges
   WHERE routine_schema = 'public'
     AND routine_name IN ('get_my_organization_profile','get_public_organization_profile','admin_list_organizations_summary')
     AND grantee IN ('PUBLIC','anon')),
  0,
  'RPCs novas nao concedem EXECUTE a PUBLIC/anon'
);

SELECT * FROM extensions.finish();
ROLLBACK;
