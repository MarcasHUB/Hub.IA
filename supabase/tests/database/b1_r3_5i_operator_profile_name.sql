CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT extensions.plan(22);

INSERT INTO public.organizations (id, name, slug, status, is_platform_internal)
VALUES
  ('89000000-0000-4000-8000-000000000001', 'Tenant A Name', 'tenant-a-name', 'ativo', false),
  ('90000000-0000-4000-8000-000000000001', 'Tenant B Name', 'tenant-b-name', 'ativo', false);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', '89000000-0000-4000-8000-000000000201', 'authenticated', 'authenticated', 'new-name@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '89000000-0000-4000-8000-000000000202', 'authenticated', 'authenticated', 'isabela@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Legacy Auth Name"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '89000000-0000-4000-8000-000000000203', 'authenticated', 'authenticated', 'cancelled-name@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '89000000-0000-4000-8000-000000000204', 'authenticated', 'authenticated', 'expired-name@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '89000000-0000-4000-8000-000000000205', 'authenticated', 'authenticated', 'foreign-name@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '89000000-0000-4000-8000-000000000206', 'authenticated', 'authenticated', 'different-name@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.profiles (id, user_id, organization_id, full_name, email, status)
VALUES
  ('89000000-0000-4000-8000-000000000202', '89000000-0000-4000-8000-000000000202', '89000000-0000-4000-8000-000000000001', 'Auditor 1', 'isabela@local.invalid', 'active'),
  ('89000000-0000-4000-8000-000000000203', '89000000-0000-4000-8000-000000000203', '89000000-0000-4000-8000-000000000001', 'Legacy Cancelled', 'cancelled-name@local.invalid', 'active'),
  ('89000000-0000-4000-8000-000000000204', '89000000-0000-4000-8000-000000000204', '89000000-0000-4000-8000-000000000001', 'Legacy Expired', 'expired-name@local.invalid', 'active'),
  ('89000000-0000-4000-8000-000000000205', '89000000-0000-4000-8000-000000000205', '90000000-0000-4000-8000-000000000001', 'Foreign Tenant Name', 'foreign-name@local.invalid', 'active'),
  ('89000000-0000-4000-8000-000000000206', '89000000-0000-4000-8000-000000000206', '89000000-0000-4000-8000-000000000001', 'Legacy Mismatch', 'different-name@local.invalid', 'active');

INSERT INTO public.operators (
  id, organization_id, nome, sobrenome, email, perfil, status, deleted_at, todas_categorias
) VALUES
  ('89000000-0000-4000-8000-000000000201', '89000000-0000-4000-8000-000000000001', 'New', 'Person', 'new-name@local.invalid', 'comprador', 'pendente', NULL, false),
  ('89000000-0000-4000-8000-000000000202', '89000000-0000-4000-8000-000000000001', 'Isabela', 'Bocca', 'isabela@local.invalid', 'auditor', 'pendente', NULL, true),
  ('89000000-0000-4000-8000-000000000203', '89000000-0000-4000-8000-000000000001', 'Cancelled', 'Current', 'cancelled-name@local.invalid', 'comprador', 'cancelado', NULL, false),
  ('89000000-0000-4000-8000-000000000204', '89000000-0000-4000-8000-000000000001', 'Expired', 'Current', 'expired-name@local.invalid', 'comprador', 'pendente', NULL, false),
  ('89000000-0000-4000-8000-000000000205', '89000000-0000-4000-8000-000000000001', 'Foreign', 'Current', 'foreign-name@local.invalid', 'comprador', 'pendente', NULL, false),
  ('89000000-0000-4000-8000-000000000206', '89000000-0000-4000-8000-000000000001', 'Mismatch', 'Current', 'expected-name@local.invalid', 'comprador', 'pendente', NULL, false);

INSERT INTO public.categories (id, organization_id, name, normalized_name)
VALUES ('89000000-0000-4000-8000-000000000301', '89000000-0000-4000-8000-000000000001', 'Name Fixture Category', 'name fixture category');

INSERT INTO public.operator_categories (operator_id, category_id)
VALUES ('89000000-0000-4000-8000-000000000201', '89000000-0000-4000-8000-000000000301');

INSERT INTO public.user_roles (user_id, organization_id, role)
VALUES ('89000000-0000-4000-8000-000000000202', '89000000-0000-4000-8000-000000000001', 'buyer');

INSERT INTO public.operator_invitations (
  id, organization_id, email, nome, perfil, token, token_hash, status, expires_at
) VALUES
  ('89000000-0000-4000-8000-000000000401', '89000000-0000-4000-8000-000000000001', 'new-name@local.invalid', 'New Person', 'comprador', repeat('a', 64), repeat('a', 64), 'pendente', now() + interval '1 day'),
  ('89000000-0000-4000-8000-000000000402', '89000000-0000-4000-8000-000000000001', 'isabela@local.invalid', 'Isabela Bocca', 'auditor', repeat('b', 64), repeat('b', 64), 'pendente', now() + interval '1 day'),
  ('89000000-0000-4000-8000-000000000403', '89000000-0000-4000-8000-000000000001', 'cancelled-name@local.invalid', 'Cancelled Current', 'comprador', repeat('c', 64), repeat('c', 64), 'cancelado', now() + interval '1 day'),
  ('89000000-0000-4000-8000-000000000404', '89000000-0000-4000-8000-000000000001', 'expired-name@local.invalid', 'Expired Current', 'comprador', repeat('d', 64), repeat('d', 64), 'pendente', now() - interval '1 minute'),
  ('89000000-0000-4000-8000-000000000405', '89000000-0000-4000-8000-000000000001', 'foreign-name@local.invalid', 'Foreign Current', 'comprador', repeat('e', 64), repeat('e', 64), 'pendente', now() + interval '1 day'),
  ('89000000-0000-4000-8000-000000000406', '89000000-0000-4000-8000-000000000001', 'expected-name@local.invalid', 'Mismatch Current', 'comprador', repeat('f', 64), repeat('f', 64), 'pendente', now() + interval '1 day');

SET LOCAL ROLE service_role;

SELECT extensions.lives_ok(
  $$ SELECT public.accept_operator_invitation_transactional(repeat('a', 64), '89000000-0000-4000-8000-000000000201', '127.0.0.1', 'B1-R.3.5I fixture') $$,
  'A: valid acceptance without an existing profile succeeds'
);
RESET ROLE;
SELECT extensions.is((SELECT full_name FROM public.profiles WHERE user_id = '89000000-0000-4000-8000-000000000201'), 'New Person', 'A: acceptance creates the profile with the current operator name');
SELECT extensions.is(
  (SELECT p.full_name FROM public.profiles AS p JOIN public.operators AS op ON op.id = p.user_id WHERE op.id = '89000000-0000-4000-8000-000000000201'),
  (SELECT concat_ws(' ', nullif(trim(nome), ''), nullif(trim(sobrenome), '')) FROM public.operators WHERE id = '89000000-0000-4000-8000-000000000201'),
  'C: profile name is coherent with operators nome and sobrenome'
);
SELECT extensions.is((SELECT role::text FROM public.user_roles WHERE user_id = '89000000-0000-4000-8000-000000000201'), 'buyer', 'I: acceptance keeps the expected role mapping');
SELECT extensions.is((SELECT count(*)::integer FROM public.operator_categories WHERE operator_id = '89000000-0000-4000-8000-000000000201'), 1, 'J: acceptance preserves operator categories');

SET LOCAL ROLE service_role;
SELECT extensions.lives_ok(
  $$ SELECT public.accept_operator_invitation_transactional(repeat('b', 64), '89000000-0000-4000-8000-000000000202', '127.0.0.1', 'B1-R.3.5I fixture') $$,
  'B: valid reinvitation acceptance succeeds'
);
RESET ROLE;
SELECT extensions.is((SELECT full_name FROM public.profiles WHERE user_id = '89000000-0000-4000-8000-000000000202'), 'Isabela Bocca', 'B: accepted current name replaces a stale profile name');
SELECT extensions.is((SELECT concat_ws(' ', nome, sobrenome) FROM public.operators WHERE id = '89000000-0000-4000-8000-000000000202'), 'Isabela Bocca', 'C: administrative operator name remains canonical');
SELECT extensions.is((SELECT role::text FROM public.user_roles WHERE user_id = '89000000-0000-4000-8000-000000000202'), 'auditor', 'I: an existing role is reconciled to the accepted invitation role');
SELECT extensions.is((SELECT raw_user_meta_data ->> 'full_name' FROM auth.users WHERE id = '89000000-0000-4000-8000-000000000202'), 'Legacy Auth Name', 'Auth user metadata is not changed by operator acceptance');

SET LOCAL ROLE service_role;
SELECT extensions.throws_ok(
  $$ SELECT public.accept_operator_invitation_transactional(repeat('c', 64), '89000000-0000-4000-8000-000000000203', '127.0.0.1', 'B1-R.3.5I fixture') $$,
  'P0001', 'OPERATOR_INVITE_NOT_PENDING', 'D: a cancelled invitation cannot promote a name'
);
RESET ROLE;
SELECT extensions.is((SELECT full_name FROM public.profiles WHERE user_id = '89000000-0000-4000-8000-000000000203'), 'Legacy Cancelled', 'D: cancelled acceptance changes no profile name');

SET LOCAL ROLE service_role;
SELECT extensions.throws_ok(
  $$ SELECT public.accept_operator_invitation_transactional(repeat('d', 64), '89000000-0000-4000-8000-000000000204', '127.0.0.1', 'B1-R.3.5I fixture') $$,
  'P0001', 'OPERATOR_INVITE_EXPIRED', 'E: an expired invitation cannot promote a name'
);
RESET ROLE;
SELECT extensions.is((SELECT full_name FROM public.profiles WHERE user_id = '89000000-0000-4000-8000-000000000204'), 'Legacy Expired', 'E: expired acceptance changes no profile name');

SET LOCAL ROLE service_role;
SELECT extensions.throws_ok(
  $$ SELECT public.accept_operator_invitation_transactional(repeat('e', 64), '89000000-0000-4000-8000-000000000205', '127.0.0.1', 'B1-R.3.5I fixture') $$,
  'P0001', 'OPERATOR_CROSS_TENANT_CONFLICT', 'F: a cross-tenant identity cannot promote a name'
);
RESET ROLE;
SELECT extensions.is((SELECT full_name FROM public.profiles WHERE user_id = '89000000-0000-4000-8000-000000000205'), 'Foreign Tenant Name', 'F: cross-tenant rejection changes no foreign profile name');

SET LOCAL ROLE service_role;
SELECT extensions.throws_ok(
  $$ SELECT public.accept_operator_invitation_transactional(repeat('f', 64), '89000000-0000-4000-8000-000000000206', '127.0.0.1', 'B1-R.3.5I fixture') $$,
  'P0001', 'OPERATOR_INVITE_EMAIL_MISMATCH', 'G: a mismatched Auth email cannot promote a name'
);
RESET ROLE;
SELECT extensions.is((SELECT full_name FROM public.profiles WHERE user_id = '89000000-0000-4000-8000-000000000206'), 'Legacy Mismatch', 'G: email mismatch changes no profile name');

SET LOCAL ROLE service_role;
SELECT extensions.is(
  public.accept_operator_invitation_transactional(repeat('a', 64), '89000000-0000-4000-8000-000000000201', '127.0.0.1', 'B1-R.3.5I idempotency'),
  true,
  'H: repeated acceptance remains idempotent'
);
RESET ROLE;
SELECT extensions.is((SELECT full_name FROM public.profiles WHERE user_id = '89000000-0000-4000-8000-000000000201'), 'New Person', 'H: idempotent acceptance does not corrupt the promoted name');

SELECT extensions.ok(
  has_function_privilege('service_role', 'public.accept_operator_invitation_transactional(text,uuid,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.accept_operator_invitation_transactional(text,uuid,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.accept_operator_invitation_transactional(text,uuid,text,text)', 'EXECUTE')
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS p,
         LATERAL pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) AS acl
    WHERE p.oid = 'public.accept_operator_invitation_transactional(text,uuid,text,text)'::regprocedure
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ),
  'acceptance RPC remains executable only by service_role among API roles'
);
SELECT extensions.is(
  (SELECT count(*)::integer
   FROM pg_catalog.pg_proc AS p
   WHERE p.oid = 'public.accept_operator_invitation_transactional(text,uuid,text,text)'::regprocedure
     AND p.prosecdef
     AND p.proconfig @> ARRAY['search_path=""']),
  1,
  'acceptance RPC remains SECURITY DEFINER with an empty search_path'
);

SELECT * FROM extensions.finish();
ROLLBACK;
