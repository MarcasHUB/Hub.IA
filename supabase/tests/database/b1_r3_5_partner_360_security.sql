CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT extensions.plan(11);

INSERT INTO public.organizations (
  id, name, slug, cnpj, status, email_corporativo, telefone, website, raio_atendimento_km
) VALUES
  ('81000000-0000-4000-8000-000000000001', 'Tenant A 360', 'tenant-a-360', '81.000.000/0001-01', 'ativo', 'a@local.invalid', '(11) 1111-1111', 'a.local.invalid', 100),
  ('82000000-0000-4000-8000-000000000001', 'Tenant B 360', 'tenant-b-360', '82.000.000/0001-02', 'ativo', 'b@local.invalid', '(22) 2222-2222', 'b.local.invalid', 200),
  ('83000000-0000-4000-8000-000000000001', 'Tenant C 360', 'tenant-c-360', '83.000.000/0001-03', 'ativo', 'c@local.invalid', '(33) 3333-3333', 'c.local.invalid', 300),
  ('84000000-0000-4000-8000-000000000001', 'Tenant D 360', 'tenant-d-360', '84.000.000/0001-04', 'ativo', 'd@local.invalid', '(44) 4444-4444', 'd.local.invalid', 400)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin-a-360@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '82000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin-b-360@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '83000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin-c-360@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '84000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin-d-360@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, user_id, organization_id, full_name, email, status)
VALUES
  ('81000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000001', 'Admin A 360', 'admin-a-360@local.invalid', 'active'),
  ('82000000-0000-4000-8000-000000000101', '82000000-0000-4000-8000-000000000101', '82000000-0000-4000-8000-000000000001', 'Admin B 360', 'admin-b-360@local.invalid', 'active'),
  ('83000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000001', 'Admin C 360', 'admin-c-360@local.invalid', 'active'),
  ('84000000-0000-4000-8000-000000000101', '84000000-0000-4000-8000-000000000101', '84000000-0000-4000-8000-000000000001', 'Admin D 360', 'admin-d-360@local.invalid', 'active')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.operators (id, organization_id, nome, sobrenome, email, perfil, status)
VALUES
  ('81000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000001', 'Admin', 'A 360', 'admin-a-360@local.invalid', 'administrador', 'ativo'),
  ('82000000-0000-4000-8000-000000000101', '82000000-0000-4000-8000-000000000001', 'Admin', 'B 360', 'admin-b-360@local.invalid', 'administrador', 'ativo'),
  ('83000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000001', 'Admin', 'C 360', 'admin-c-360@local.invalid', 'administrador', 'ativo'),
  ('84000000-0000-4000-8000-000000000101', '84000000-0000-4000-8000-000000000001', 'Admin', 'D 360', 'admin-d-360@local.invalid', 'administrador', 'ativo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, organization_id, role)
VALUES
  ('81000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000001', 'admin'),
  ('82000000-0000-4000-8000-000000000101', '82000000-0000-4000-8000-000000000001', 'admin'),
  ('83000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000001', 'admin'),
  ('84000000-0000-4000-8000-000000000101', '84000000-0000-4000-8000-000000000001', 'admin')
ON CONFLICT (user_id, organization_id, role) DO NOTHING;

INSERT INTO public.connection_requests (
  id, requester_company_id, target_company_id, status, requested_by_user_id,
  requester_approval_status, responded_at
) VALUES
  ('85000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 'pending', '81000000-0000-4000-8000-000000000101', 'not_required', NULL),
  ('85000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', 'accepted', '81000000-0000-4000-8000-000000000101', 'not_required', now())
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000101', true);

SELECT extensions.is((SELECT count(*)::integer FROM public.list_partner_connections()), 2, 'tenant A sees only its two relationships');
SELECT extensions.is(
  (SELECT partner_email FROM public.list_partner_connections() WHERE partner_organization_id = '82000000-0000-4000-8000-000000000001'),
  NULL::text,
  'pending relationship does not expose partner email'
);
SELECT extensions.is(
  (SELECT partner_phone FROM public.list_partner_connections() WHERE partner_organization_id = '82000000-0000-4000-8000-000000000001'),
  NULL::text,
  'pending relationship does not expose partner phone'
);
SELECT extensions.is(
  (SELECT partner_email FROM public.list_partner_connections() WHERE partner_organization_id = '83000000-0000-4000-8000-000000000001'),
  'c@local.invalid'::text,
  'accepted relationship exposes partner commercial email'
);
SELECT extensions.is(
  (SELECT partner_phone FROM public.list_partner_connections() WHERE partner_organization_id = '83000000-0000-4000-8000-000000000001'),
  '(33) 3333-3333'::text,
  'accepted relationship exposes partner commercial phone'
);

SELECT set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000101', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.list_partner_connections()), 1, 'tenant B sees only its pending relationship');
SELECT extensions.is(
  (SELECT partner_email FROM public.list_partner_connections()),
  NULL::text,
  'pending target also cannot read requester email'
);

SELECT set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000101', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.list_partner_connections()), 0, 'unrelated tenant cannot enumerate relationships');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT extensions.throws_ok(
  $$ SELECT * FROM public.list_partner_connections() $$,
  '42501', NULL,
  'anon cannot execute partner list'
);

RESET ROLE;
SELECT extensions.is(
  (SELECT count(*)::integer FROM information_schema.routine_privileges
   WHERE routine_schema = 'public'
     AND routine_name = 'list_partner_connections'
     AND grantee IN ('PUBLIC', 'anon')),
  0,
  'PUBLIC and anon have no execute grant'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM information_schema.routine_privileges
   WHERE routine_schema = 'public'
     AND routine_name = 'list_partner_connections'
     AND grantee = 'authenticated'),
  1,
  'authenticated keeps execute grant'
);

SELECT * FROM extensions.finish();
ROLLBACK;
