CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT extensions.plan(24);

INSERT INTO public.organizations (id, name, slug, status, is_platform_internal)
VALUES
  ('87000000-0000-4000-8000-000000000001', 'Tenant A Grants', 'tenant-a-grants', 'ativo', false),
  ('88000000-0000-4000-8000-000000000001', 'Tenant B Grants', 'tenant-b-grants', 'ativo', false);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', '87000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin-a-grants@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '87000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'accept-a-grants@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '87000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'cancel-a-grants@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '87000000-0000-4000-8000-000000000104', 'authenticated', 'authenticated', 'mark-a-grants@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.profiles (id, user_id, organization_id, full_name, email, status)
VALUES (
  '87000000-0000-4000-8000-000000000101',
  '87000000-0000-4000-8000-000000000101',
  '87000000-0000-4000-8000-000000000001',
  'Admin A Grants',
  'admin-a-grants@local.invalid',
  'active'
);

INSERT INTO public.operators (
  id, organization_id, nome, sobrenome, email, perfil, status, deleted_at
) VALUES (
  '87000000-0000-4000-8000-000000000101',
  '87000000-0000-4000-8000-000000000001',
  'Admin',
  'A Grants',
  'admin-a-grants@local.invalid',
  'administrador',
  'ativo',
  NULL
);

INSERT INTO public.user_roles (user_id, organization_id, role)
VALUES (
  '87000000-0000-4000-8000-000000000101',
  '87000000-0000-4000-8000-000000000001',
  'admin'
);

INSERT INTO public.operator_invitations (
  id, organization_id, email, nome, perfil, token, token_hash, status, expires_at
) VALUES (
  '88000000-0000-4000-8000-000000000401',
  '88000000-0000-4000-8000-000000000001',
  'tenant-b-invite@local.invalid',
  'Tenant B Invite',
  'comprador',
  repeat('9', 64),
  repeat('9', 64),
  'pendente',
  now() + interval '72 hours'
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT extensions.throws_ok(
  $$ INSERT INTO public.operator_invitations (
       organization_id, email, nome, perfil, token, status, expires_at
     ) VALUES (
       '88000000-0000-4000-8000-000000000001', 'blocked-anon@local.invalid',
       'Blocked Anon', 'comprador', 'blocked-anon-token', 'pendente', now() + interval '72 hours'
     ) $$,
  '42501', NULL,
  'anon cannot directly insert operator invitations'
);
SELECT extensions.throws_ok(
  $$ UPDATE public.operator_invitations SET nome = 'Blocked Anon Update'
     WHERE id = '88000000-0000-4000-8000-000000000401' $$,
  '42501', NULL,
  'anon cannot directly update operator invitations'
);
SELECT extensions.throws_ok(
  $$ DELETE FROM public.operator_invitations
     WHERE id = '88000000-0000-4000-8000-000000000401' $$,
  '42501', NULL,
  'anon cannot directly delete operator invitations'
);
SELECT extensions.throws_ok(
  $$ TRUNCATE TABLE public.operator_invitations $$,
  '42501', NULL,
  'anon cannot truncate operator invitations'
);
SELECT extensions.throws_ok(
  $$ SELECT email FROM public.operator_invitations
     WHERE id = '88000000-0000-4000-8000-000000000401' $$,
  '42501', NULL,
  'anon cannot read operator invitations'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '87000000-0000-4000-8000-000000000101', true);

SELECT extensions.throws_ok(
  $$ INSERT INTO public.operator_invitations (
       organization_id, email, nome, perfil, token, status, expires_at
     ) VALUES (
       '87000000-0000-4000-8000-000000000001', 'blocked-auth@local.invalid',
       'Blocked Auth', 'comprador', 'blocked-auth-token', 'pendente', now() + interval '72 hours'
     ) $$,
  '42501', NULL,
  'authenticated cannot directly insert operator invitations'
);
SELECT extensions.throws_ok(
  $$ UPDATE public.operator_invitations SET nome = 'Blocked Auth Update'
     WHERE id = '88000000-0000-4000-8000-000000000401' $$,
  '42501', NULL,
  'authenticated cannot directly update operator invitations'
);
SELECT extensions.throws_ok(
  $$ DELETE FROM public.operator_invitations
     WHERE id = '88000000-0000-4000-8000-000000000401' $$,
  '42501', NULL,
  'authenticated cannot directly delete operator invitations'
);
SELECT extensions.throws_ok(
  $$ TRUNCATE TABLE public.operator_invitations $$,
  '42501', NULL,
  'authenticated cannot truncate operator invitations'
);
SELECT extensions.throws_ok(
  $$ SELECT email FROM public.operator_invitations
     WHERE organization_id = '88000000-0000-4000-8000-000000000001' $$,
  '42501', NULL,
  'tenant A cannot directly read tenant B invitations'
);

RESET ROLE;
SELECT extensions.ok(
  has_table_privilege('service_role', 'public.operator_invitations', 'SELECT'),
  'service_role keeps SELECT for validate-operator-invite and accept-invite'
);
SELECT extensions.ok(
  NOT has_table_privilege('service_role', 'public.operator_invitations', 'INSERT')
  AND NOT has_table_privilege('service_role', 'public.operator_invitations', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'public.operator_invitations', 'DELETE')
  AND NOT has_table_privilege('service_role', 'public.operator_invitations', 'TRUNCATE')
  AND NOT has_table_privilege('service_role', 'public.operator_invitations', 'REFERENCES')
  AND NOT has_table_privilege('service_role', 'public.operator_invitations', 'TRIGGER'),
  'service_role has no direct privileges beyond the SELECT required by Edge Functions'
);

SET LOCAL ROLE service_role;

SELECT extensions.lives_ok(
  $$ SELECT public.create_operator_invitation_transactional(
       '87000000-0000-4000-8000-000000000101',
       '87000000-0000-4000-8000-000000000102',
       'accept-a-grants@local.invalid',
       'Accept', 'A Grants', NULL, NULL, 'comprador', NULL,
       ARRAY[]::uuid[], false, repeat('a', 64), now() + interval '72 hours'
     ) $$,
  'invite-operator transactional contract remains available to service_role'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.operator_invitations
   WHERE organization_id = '87000000-0000-4000-8000-000000000001'
     AND email = 'accept-a-grants@local.invalid'
     AND status = 'pendente'),
  1,
  'invite-operator contract creates one pending invitation'
);

SELECT extensions.lives_ok(
  $$ SELECT public.rotate_operator_invitation_token(
       '87000000-0000-4000-8000-000000000101',
       'accept-a-grants@local.invalid',
       repeat('b', 64),
       now() + interval '96 hours'
     ) $$,
  'resend contract remains available to service_role'
);
SELECT extensions.is(
  (SELECT token_hash FROM public.operator_invitations
   WHERE organization_id = '87000000-0000-4000-8000-000000000001'
     AND email = 'accept-a-grants@local.invalid'
     AND status = 'pendente'),
  repeat('b', 64),
  'resend contract rotates the invitation token hash'
);

SELECT extensions.lives_ok(
  $$ SELECT public.accept_operator_invitation_transactional(
       repeat('b', 64),
       '87000000-0000-4000-8000-000000000102',
       '127.0.0.1',
       'B1-R.3.5G fixture'
     ) $$,
  'accept-invite transactional contract remains available to service_role'
);
SELECT extensions.is(
  (SELECT status::text FROM public.operator_invitations
   WHERE organization_id = '87000000-0000-4000-8000-000000000001'
     AND email = 'accept-a-grants@local.invalid'),
  'aceito',
  'accept-invite contract marks the invitation accepted'
);

SELECT extensions.lives_ok(
  $$ SELECT public.create_operator_invitation_transactional(
       '87000000-0000-4000-8000-000000000101',
       '87000000-0000-4000-8000-000000000103',
       'cancel-a-grants@local.invalid',
       'Cancel', 'A Grants', NULL, NULL, 'comprador', NULL,
       ARRAY[]::uuid[], false, repeat('c', 64), now() + interval '72 hours'
     ) $$,
  'cancellation fixture is created through the authorized invite contract'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '87000000-0000-4000-8000-000000000101', true);
SELECT extensions.lives_ok(
  $$ SELECT public.cancel_operator_invitation(
       'cancel-a-grants@local.invalid',
       '87000000-0000-4000-8000-000000000103'
     ) $$,
  'cancel_operator_invitation remains available to authenticated administrators'
);

SET LOCAL ROLE service_role;
SELECT extensions.is(
  (SELECT status::text FROM public.operator_invitations
   WHERE organization_id = '87000000-0000-4000-8000-000000000001'
     AND email = 'cancel-a-grants@local.invalid'),
  'cancelado',
  'cancel contract marks the invitation cancelled'
);

SELECT extensions.lives_ok(
  $$ SELECT public.create_operator_invitation_transactional(
       '87000000-0000-4000-8000-000000000101',
       '87000000-0000-4000-8000-000000000104',
       'mark-a-grants@local.invalid',
       'Mark', 'A Grants', NULL, NULL, 'comprador', NULL,
       ARRAY[]::uuid[], false, repeat('d', 64), now() + interval '72 hours'
     ) $$,
  'email-delivery fixture is created through the authorized invite contract'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '87000000-0000-4000-8000-000000000101', true);
SELECT extensions.lives_ok(
  $$ SELECT public.mark_operator_invitation_email_delivery(
       repeat('d', 64),
       'delivered',
       NULL
     ) $$,
  'mark_operator_invitation_email_delivery remains available to authenticated callers'
);

SET LOCAL ROLE service_role;
SELECT extensions.is(
  (SELECT email_delivery_status FROM public.operator_invitations
   WHERE organization_id = '87000000-0000-4000-8000-000000000001'
     AND email = 'mark-a-grants@local.invalid'),
  'delivered',
  'email-delivery contract updates the invitation through its RPC'
);

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
