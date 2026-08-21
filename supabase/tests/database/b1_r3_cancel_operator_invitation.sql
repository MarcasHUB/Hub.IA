CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT extensions.plan(39);

INSERT INTO public.organizations (id, name, slug, cnpj, status, is_platform_internal)
VALUES
  ('81000000-0000-4000-8000-000000000001', 'Tenant A Fixture', 'b1-r3-3-tenant-a', '81.000.000/0001-01', 'ativo', false),
  ('82000000-0000-4000-8000-000000000001', 'Tenant B Fixture', 'b1-r3-3-tenant-b', '82.000.000/0001-02', 'ativo', false);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin-a-r33@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'manager-a-r33@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '82000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin-b-r33@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000201', 'authenticated', 'authenticated', 'pending-happy-r33@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000207', 'authenticated', 'authenticated', 'pending-role-r33@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '81000000-0000-4000-8000-000000000208', 'authenticated', 'authenticated', 'pending-accept-r33@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.profiles (id, user_id, organization_id, full_name, email, status)
VALUES
  ('81000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000001', 'Admin A', 'admin-a-r33@local.invalid', 'active'),
  ('81000000-0000-4000-8000-000000000102', '81000000-0000-4000-8000-000000000102', '81000000-0000-4000-8000-000000000001', 'Manager A', 'manager-a-r33@local.invalid', 'active'),
  ('82000000-0000-4000-8000-000000000101', '82000000-0000-4000-8000-000000000101', '82000000-0000-4000-8000-000000000001', 'Admin B', 'admin-b-r33@local.invalid', 'active'),
  ('81000000-0000-4000-8000-000000000201', '81000000-0000-4000-8000-000000000201', '81000000-0000-4000-8000-000000000001', 'Pending Happy', 'pending-happy-r33@local.invalid', 'active'),
  ('81000000-0000-4000-8000-000000000207', '81000000-0000-4000-8000-000000000207', '81000000-0000-4000-8000-000000000001', 'Pending Role', 'pending-role-r33@local.invalid', 'active'),
  ('81000000-0000-4000-8000-000000000208', '81000000-0000-4000-8000-000000000208', '81000000-0000-4000-8000-000000000001', 'Pending Accept', 'pending-accept-r33@local.invalid', 'active');

INSERT INTO public.operators (id, organization_id, nome, sobrenome, email, perfil, status, deleted_at)
VALUES
  ('81000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000001', 'Admin', 'A', 'admin-a-r33@local.invalid', 'administrador', 'ativo', NULL),
  ('81000000-0000-4000-8000-000000000102', '81000000-0000-4000-8000-000000000001', 'Manager', 'A', 'manager-a-r33@local.invalid', 'gestor', 'ativo', NULL),
  ('82000000-0000-4000-8000-000000000101', '82000000-0000-4000-8000-000000000001', 'Admin', 'B', 'admin-b-r33@local.invalid', 'administrador', 'ativo', NULL),
  ('81000000-0000-4000-8000-000000000201', '81000000-0000-4000-8000-000000000001', 'Pending', 'Happy', 'pending-happy-r33@local.invalid', 'auditor', 'pendente', NULL),
  ('81000000-0000-4000-8000-000000000202', '81000000-0000-4000-8000-000000000001', 'Active', 'Target', 'active-target-r33@local.invalid', 'auditor', 'ativo', NULL),
  ('81000000-0000-4000-8000-000000000203', '81000000-0000-4000-8000-000000000001', 'Pending', 'Mismatch', 'pending-mismatch-r33@local.invalid', 'auditor', 'pendente', NULL),
  ('81000000-0000-4000-8000-000000000204', '81000000-0000-4000-8000-000000000001', 'Pending', 'Accepted Invite', 'accepted-invite-r33@local.invalid', 'auditor', 'pendente', NULL),
  ('81000000-0000-4000-8000-000000000205', '81000000-0000-4000-8000-000000000001', 'Cancelled', 'Target', 'cancelled-target-r33@local.invalid', 'auditor', 'cancelado', NULL),
  ('81000000-0000-4000-8000-000000000207', '81000000-0000-4000-8000-000000000001', 'Pending', 'With Role', 'pending-role-r33@local.invalid', 'auditor', 'pendente', NULL),
  ('81000000-0000-4000-8000-000000000208', '81000000-0000-4000-8000-000000000001', 'Pending', 'Acceptance', 'pending-accept-r33@local.invalid', 'auditor', 'pendente', NULL),
  ('82000000-0000-4000-8000-000000000201', '82000000-0000-4000-8000-000000000001', 'Pending', 'Tenant B', 'pending-b-r33@local.invalid', 'auditor', 'pendente', NULL);

INSERT INTO public.user_roles (user_id, organization_id, role)
VALUES
  ('81000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000001', 'admin'),
  ('81000000-0000-4000-8000-000000000102', '81000000-0000-4000-8000-000000000001', 'supplier_manager'),
  ('82000000-0000-4000-8000-000000000101', '82000000-0000-4000-8000-000000000001', 'admin'),
  ('81000000-0000-4000-8000-000000000207', '81000000-0000-4000-8000-000000000001', 'auditor');

INSERT INTO public.categories (id, organization_id, name, normalized_name)
VALUES ('81000000-0000-4000-8000-000000000301', '81000000-0000-4000-8000-000000000001', 'Fixture Category R3.3', 'fixture category r3.3');

INSERT INTO public.operator_categories (operator_id, category_id)
VALUES ('81000000-0000-4000-8000-000000000201', '81000000-0000-4000-8000-000000000301');

INSERT INTO public.operator_invitations (
  id, organization_id, invited_by_id, email, nome, perfil, token, token_hash,
  status, sent_at, expires_at, accepted_at, cancelled_at, updated_at
)
VALUES
  ('81000000-0000-4000-8000-000000000401', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000101', 'pending-happy-r33@local.invalid', 'Pending Happy', 'auditor', 'token-happy-r33', 'hash-happy-r33', 'pendente', now(), now() + interval '1 day', NULL, NULL, now()),
  ('81000000-0000-4000-8000-000000000402', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000101', 'active-target-r33@local.invalid', 'Active Target', 'auditor', 'token-active-r33', 'hash-active-r33', 'pendente', now(), now() + interval '1 day', NULL, NULL, now()),
  ('81000000-0000-4000-8000-000000000403', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000101', 'pending-mismatch-r33@local.invalid', 'Pending Mismatch', 'auditor', 'token-mismatch-r33', 'hash-mismatch-r33', 'pendente', now(), now() + interval '1 day', NULL, NULL, now()),
  ('81000000-0000-4000-8000-000000000404', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000101', 'accepted-invite-r33@local.invalid', 'Accepted Invite', 'auditor', 'token-accepted-r33', 'hash-accepted-r33', 'aceito', now(), now() + interval '1 day', now(), NULL, now()),
  ('81000000-0000-4000-8000-000000000405', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000101', 'cancelled-target-r33@local.invalid', 'Cancelled Target', 'auditor', 'token-cancelled-r33', 'hash-cancelled-r33', 'cancelado', now(), now() + interval '1 day', NULL, now(), now()),
  ('81000000-0000-4000-8000-000000000407', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000101', 'pending-role-r33@local.invalid', 'Pending Role', 'auditor', 'token-role-r33', 'hash-role-r33', 'pendente', now(), now() + interval '1 day', NULL, NULL, now()),
  ('81000000-0000-4000-8000-000000000408', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000101', 'pending-accept-r33@local.invalid', 'Pending Accept', 'auditor', 'token-accept-r33', 'hash-accept-r33', 'pendente', now(), now() + interval '1 day', NULL, NULL, now()),
  ('82000000-0000-4000-8000-000000000401', '82000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000101', 'pending-b-r33@local.invalid', 'Pending B', 'auditor', 'token-b-r33', 'hash-b-r33', 'pendente', now(), now() + interval '1 day', NULL, NULL, now());

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000101', true);

SELECT extensions.lives_ok(
  $$ SELECT public.cancel_operator_invitation('  PENDING-HAPPY-R33@LOCAL.INVALID  ', '81000000-0000-4000-8000-000000000201') $$,
  'A: administrator cancels a pending invitation in the canonical tenant'
);
RESET ROLE;
SELECT extensions.is((SELECT status::text FROM public.operators WHERE id='81000000-0000-4000-8000-000000000201'), 'cancelado', 'A: operator becomes cancelled');
SELECT extensions.is((SELECT status::text FROM public.operator_invitations WHERE id='81000000-0000-4000-8000-000000000401'), 'cancelado', 'A: invitation becomes cancelled');
SELECT extensions.ok((SELECT cancelled_at IS NOT NULL FROM public.operator_invitations WHERE id='81000000-0000-4000-8000-000000000401'), 'A: invitation records cancelled_at');
SELECT extensions.ok((SELECT deleted_at IS NULL FROM public.operators WHERE id='81000000-0000-4000-8000-000000000201'), 'A: operator deleted_at remains null');
SELECT extensions.is((SELECT count(*)::integer FROM auth.users WHERE id='81000000-0000-4000-8000-000000000201'), 1, 'A: auth user is preserved');
SELECT extensions.is((SELECT count(*)::integer FROM public.profiles WHERE user_id='81000000-0000-4000-8000-000000000201'), 1, 'A: profile is preserved');
SELECT extensions.is((SELECT count(*)::integer FROM public.operator_categories WHERE operator_id='81000000-0000-4000-8000-000000000201'), 1, 'A: operator categories are preserved');
SELECT extensions.is((SELECT count(*)::integer FROM public.user_roles WHERE user_id='81000000-0000-4000-8000-000000000201'), 0, 'A: cancellation does not create a user role');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.cancel_operator_invitation('active-target-r33@local.invalid', '81000000-0000-4000-8000-000000000202') $$,
  'P0001', 'OPERATOR_INVITE_NOT_PENDING', 'B: active operator cannot be cancelled'
);
RESET ROLE;
SELECT extensions.is((SELECT status::text FROM public.operators WHERE id='81000000-0000-4000-8000-000000000202'), 'ativo', 'B: active operator remains active');
SELECT extensions.is((SELECT status::text FROM public.operator_invitations WHERE id='81000000-0000-4000-8000-000000000402'), 'pendente', 'B: active operator invitation remains pending');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.cancel_operator_invitation('pending-b-r33@local.invalid', '82000000-0000-4000-8000-000000000201') $$,
  'P0001', 'OPERATOR_INVITE_NOT_FOUND', 'C: cross-tenant operator id is not disclosed'
);
RESET ROLE;
SELECT extensions.is((SELECT status::text FROM public.operators WHERE id='82000000-0000-4000-8000-000000000201'), 'pendente', 'C: cross-tenant operator remains pending');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.cancel_operator_invitation('active-target-r33@local.invalid', '81000000-0000-4000-8000-000000000203') $$,
  'P0001', 'OPERATOR_INVITE_EMAIL_MISMATCH', 'D: mismatched email is rejected'
);
RESET ROLE;
SELECT extensions.is((SELECT status::text FROM public.operators WHERE id='81000000-0000-4000-8000-000000000203'), 'pendente', 'D: mismatched operator remains pending');
SELECT extensions.is((SELECT status::text FROM public.operator_invitations WHERE id='81000000-0000-4000-8000-000000000403'), 'pendente', 'D: mismatched invitation remains pending');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000102', true);
SELECT extensions.throws_ok(
  $$ SELECT public.cancel_operator_invitation('pending-mismatch-r33@local.invalid', '81000000-0000-4000-8000-000000000203') $$,
  'P0001', 'FORBIDDEN', 'E: caller without operators_manage is forbidden'
);
RESET ROLE;
SELECT extensions.is((SELECT status::text FROM public.operators WHERE id='81000000-0000-4000-8000-000000000203'), 'pendente', 'E: forbidden call changes no operator');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.cancel_operator_invitation('accepted-invite-r33@local.invalid', '81000000-0000-4000-8000-000000000204') $$,
  'P0001', 'OPERATOR_INVITE_NOT_PENDING', 'F: accepted invitation cannot be cancelled'
);
RESET ROLE;
SELECT extensions.is((SELECT status::text FROM public.operators WHERE id='81000000-0000-4000-8000-000000000204'), 'pendente', 'F: operator is unchanged when invite was accepted');
SELECT extensions.is((SELECT status::text FROM public.operator_invitations WHERE id='81000000-0000-4000-8000-000000000404'), 'aceito', 'F: accepted invitation remains accepted');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.cancel_operator_invitation('cancelled-target-r33@local.invalid', '81000000-0000-4000-8000-000000000205') $$,
  'P0001', 'OPERATOR_INVITE_NOT_PENDING', 'G: repeated cancellation returns a controlled error'
);
RESET ROLE;
SELECT extensions.is((SELECT status::text FROM public.operator_invitations WHERE id='81000000-0000-4000-8000-000000000405'), 'cancelado', 'G: cancelled invitation remains unchanged');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.cancel_operator_invitation('missing-r33@local.invalid', '81000000-0000-4000-8000-000000000999') $$,
  'P0001', 'OPERATOR_INVITE_NOT_FOUND', 'H: nonexistent operator returns not found'
);

SELECT extensions.throws_ok(
  $$ SELECT public.cancel_operator_invitation('pending-b-r33@local.invalid', '82000000-0000-4000-8000-000000000201') $$,
  'P0001', 'OPERATOR_INVITE_NOT_FOUND', 'I: manipulated foreign id fails even with its correct email'
);
RESET ROLE;
SELECT extensions.is((SELECT status::text FROM public.operator_invitations WHERE id='82000000-0000-4000-8000-000000000401'), 'pendente', 'I: manipulated id changes no foreign invitation');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.cancel_operator_invitation('pending-role-r33@local.invalid', '81000000-0000-4000-8000-000000000207') $$,
  'P0001', 'OPERATOR_IDENTITY_INCONSISTENT', 'pending operator with user role fails closed'
);
RESET ROLE;
SELECT extensions.is((SELECT count(*)::integer FROM public.user_roles WHERE user_id='81000000-0000-4000-8000-000000000207'), 1, 'unexpected user role is preserved for explicit reconciliation');
SELECT extensions.is((SELECT status::text FROM public.operators WHERE id='81000000-0000-4000-8000-000000000207'), 'pendente', 'identity inconsistency changes no operator');

SET LOCAL ROLE service_role;
SELECT extensions.lives_ok(
  $$ SELECT public.accept_operator_invitation_transactional('hash-accept-r33', '81000000-0000-4000-8000-000000000208', '127.0.0.1', 'B1-R.3.3 fixture') $$,
  'acceptance regression: untouched pending invitation can still be accepted'
);
RESET ROLE;
SELECT extensions.is((SELECT status::text FROM public.operators WHERE id='81000000-0000-4000-8000-000000000208'), 'ativo', 'acceptance regression: operator becomes active');
SELECT extensions.is((SELECT status::text FROM public.operator_invitations WHERE id='81000000-0000-4000-8000-000000000408'), 'aceito', 'acceptance regression: invitation becomes accepted');
SELECT extensions.is((SELECT count(*)::integer FROM public.user_roles WHERE user_id='81000000-0000-4000-8000-000000000208'), 1, 'acceptance regression: role is created');

SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.cancel_operator_invitation(text,uuid)', 'EXECUTE'),
  'authenticated can execute cancellation RPC'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.cancel_operator_invitation(text,uuid)', 'EXECUTE'),
  'anon cannot execute cancellation RPC'
);
SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'private.current_identity()', 'EXECUTE'),
  'private canonical identity remains inaccessible directly'
);
SELECT extensions.ok(
  has_function_privilege('service_role', 'public.accept_operator_invitation_transactional(text,uuid,text,text)', 'EXECUTE'),
  'acceptance RPC remains service-role only'
);
SELECT extensions.is(
  (SELECT count(*)::integer
   FROM pg_catalog.pg_proc AS p
   JOIN pg_catalog.pg_namespace AS n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND p.proname='cancel_operator_invitation'
     AND p.prosecdef
     AND p.proconfig @> ARRAY['search_path=""']),
  1,
  'cancellation RPC is security definer with an empty search_path'
);

SELECT * FROM extensions.finish();
ROLLBACK;
