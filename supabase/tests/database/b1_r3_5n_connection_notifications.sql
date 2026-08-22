CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT extensions.plan(16);

INSERT INTO public.organizations (id, name, slug, status, is_platform_internal)
VALUES
  ('86000000-0000-4000-8000-000000000001', 'Tenant A Notifications', 'tenant-a-notifications', 'ativo', false),
  ('86000000-0000-4000-8000-000000000002', 'Tenant B Notifications', 'tenant-b-notifications', 'ativo', false),
  ('86000000-0000-4000-8000-000000000003', 'Tenant C Notifications', 'tenant-c-notifications', 'ativo', false),
  ('86000000-0000-4000-8000-000000000004', 'Tenant D Notifications', 'tenant-d-notifications', 'ativo', false);

INSERT INTO public.companies (id, trade_name, legal_name, cnpj)
VALUES
  ('86000000-0000-4000-8000-000000000001', 'Tenant A Notifications', 'Tenant A Notifications Ltda', '86000000000101'),
  ('86000000-0000-4000-8000-000000000002', 'Tenant B Notifications', 'Tenant B Notifications Ltda', '86000000000102');

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', '86000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin-a-notifications@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '86000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'buyer-a-notifications@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '86000000-0000-4000-8000-000000000201', 'authenticated', 'authenticated', 'admin-b-notifications@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '86000000-0000-4000-8000-000000000202', 'authenticated', 'authenticated', 'manager-b-notifications@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '86000000-0000-4000-8000-000000000203', 'authenticated', 'authenticated', 'inactive-b-notifications@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '86000000-0000-4000-8000-000000000204', 'authenticated', 'authenticated', 'deleted-b-notifications@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '86000000-0000-4000-8000-000000000205', 'authenticated', 'authenticated', 'requester-b-notifications@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '86000000-0000-4000-8000-000000000301', 'authenticated', 'authenticated', 'admin-c-notifications@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '86000000-0000-4000-8000-000000000401', 'authenticated', 'authenticated', 'admin-d-notifications@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.profiles (id, user_id, organization_id, full_name, email, cnpj, status)
VALUES
  ('86000000-0000-4000-8000-000000000101', '86000000-0000-4000-8000-000000000101', '86000000-0000-4000-8000-000000000001', 'Admin A Notifications', 'admin-a-notifications@local.invalid', '86000000000101', 'active'),
  ('86000000-0000-4000-8000-000000000102', '86000000-0000-4000-8000-000000000102', '86000000-0000-4000-8000-000000000001', 'Buyer A Notifications', 'buyer-a-notifications@local.invalid', NULL, 'active'),
  ('86000000-0000-4000-8000-000000000201', '86000000-0000-4000-8000-000000000201', '86000000-0000-4000-8000-000000000002', 'Admin B Notifications', 'admin-b-notifications@local.invalid', NULL, 'active'),
  ('86000000-0000-4000-8000-000000000202', '86000000-0000-4000-8000-000000000202', '86000000-0000-4000-8000-000000000002', 'Manager B Notifications', 'manager-b-notifications@local.invalid', NULL, 'active'),
  ('86000000-0000-4000-8000-000000000203', '86000000-0000-4000-8000-000000000203', '86000000-0000-4000-8000-000000000002', 'Inactive B Notifications', 'inactive-b-notifications@local.invalid', NULL, 'active'),
  ('86000000-0000-4000-8000-000000000204', '86000000-0000-4000-8000-000000000204', '86000000-0000-4000-8000-000000000002', 'Deleted B Notifications', 'deleted-b-notifications@local.invalid', NULL, 'active'),
  ('86000000-0000-4000-8000-000000000205', '86000000-0000-4000-8000-000000000205', '86000000-0000-4000-8000-000000000002', 'Requester B Notifications', 'requester-b-notifications@local.invalid', NULL, 'active'),
  ('86000000-0000-4000-8000-000000000301', '86000000-0000-4000-8000-000000000301', '86000000-0000-4000-8000-000000000003', 'Admin C Notifications', 'admin-c-notifications@local.invalid', NULL, 'active'),
  ('86000000-0000-4000-8000-000000000401', '86000000-0000-4000-8000-000000000401', '86000000-0000-4000-8000-000000000004', 'Admin D Notifications', 'admin-d-notifications@local.invalid', NULL, 'active');

INSERT INTO public.operators (
  id, organization_id, nome, sobrenome, email, perfil, status, deleted_at
) VALUES
  ('86000000-0000-4000-8000-000000000101', '86000000-0000-4000-8000-000000000001', 'Admin', 'A Notifications', 'admin-a-notifications@local.invalid', 'administrador', 'ativo', NULL),
  ('86000000-0000-4000-8000-000000000102', '86000000-0000-4000-8000-000000000001', 'Buyer', 'A Notifications', 'buyer-a-notifications@local.invalid', 'comprador', 'ativo', NULL),
  ('86000000-0000-4000-8000-000000000201', '86000000-0000-4000-8000-000000000002', 'Admin', 'B Notifications', 'admin-b-notifications@local.invalid', 'administrador', 'ativo', NULL),
  ('86000000-0000-4000-8000-000000000202', '86000000-0000-4000-8000-000000000002', 'Manager', 'B Notifications', 'manager-b-notifications@local.invalid', 'gestor', 'ativo', NULL),
  ('86000000-0000-4000-8000-000000000203', '86000000-0000-4000-8000-000000000002', 'Inactive', 'B Notifications', 'inactive-b-notifications@local.invalid', 'gestor', 'inativo', NULL),
  ('86000000-0000-4000-8000-000000000204', '86000000-0000-4000-8000-000000000002', 'Deleted', 'B Notifications', 'deleted-b-notifications@local.invalid', 'administrador', 'ativo', now()),
  ('86000000-0000-4000-8000-000000000205', '86000000-0000-4000-8000-000000000002', 'Requester', 'B Notifications', 'requester-b-notifications@local.invalid', 'solicitante', 'ativo', NULL),
  ('86000000-0000-4000-8000-000000000301', '86000000-0000-4000-8000-000000000003', 'Admin', 'C Notifications', 'admin-c-notifications@local.invalid', 'administrador', 'ativo', NULL),
  ('86000000-0000-4000-8000-000000000401', '86000000-0000-4000-8000-000000000004', 'Admin', 'D Notifications', 'admin-d-notifications@local.invalid', 'administrador', 'ativo', NULL);

INSERT INTO public.user_roles (user_id, organization_id, role)
VALUES
  ('86000000-0000-4000-8000-000000000101', '86000000-0000-4000-8000-000000000001', 'admin'),
  ('86000000-0000-4000-8000-000000000102', '86000000-0000-4000-8000-000000000001', 'buyer'),
  ('86000000-0000-4000-8000-000000000201', '86000000-0000-4000-8000-000000000002', 'admin'),
  ('86000000-0000-4000-8000-000000000202', '86000000-0000-4000-8000-000000000002', 'manager'),
  ('86000000-0000-4000-8000-000000000203', '86000000-0000-4000-8000-000000000002', 'manager'),
  ('86000000-0000-4000-8000-000000000204', '86000000-0000-4000-8000-000000000002', 'admin'),
  ('86000000-0000-4000-8000-000000000205', '86000000-0000-4000-8000-000000000002', 'requester'),
  ('86000000-0000-4000-8000-000000000301', '86000000-0000-4000-8000-000000000003', 'admin'),
  ('86000000-0000-4000-8000-000000000401', '86000000-0000-4000-8000-000000000004', 'admin');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000101', true);

CREATE TEMP TABLE b1_r3_5n_state (
  direct_request_id uuid,
  internal_request_id uuid
) ON COMMIT DROP;
INSERT INTO b1_r3_5n_state DEFAULT VALUES;

UPDATE b1_r3_5n_state
SET direct_request_id = public.request_connection(
  '86000000-0000-4000-8000-000000000002',
  'Direct notification test'
);

SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000201', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notifications
   WHERE user_id = '86000000-0000-4000-8000-000000000201'
     AND reference_id = (SELECT direct_request_id FROM b1_r3_5n_state)
     AND type = 'connection_request'),
  1,
  'destination administrator receives the direct request notification exactly once'
);

SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000202', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notifications
   WHERE user_id = '86000000-0000-4000-8000-000000000202'
     AND reference_id = (SELECT direct_request_id FROM b1_r3_5n_state)
     AND type = 'connection_request'),
  1,
  'destination manager receives the direct request notification exactly once'
);
SELECT extensions.is(
  (SELECT reference_id FROM public.notifications
   WHERE user_id = '86000000-0000-4000-8000-000000000202'
     AND reference_id = (SELECT direct_request_id FROM b1_r3_5n_state)
     AND type = 'connection_request'),
  (SELECT direct_request_id FROM b1_r3_5n_state),
  'request notification reference_id is the connection request id'
);

SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000401', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notifications
   WHERE user_id = '86000000-0000-4000-8000-000000000401'
     AND reference_id = (SELECT direct_request_id FROM b1_r3_5n_state)),
  0,
  'an operator from an unrelated tenant is not notified'
);

SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000203', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notifications
   WHERE user_id = '86000000-0000-4000-8000-000000000203'
     AND reference_id = (SELECT direct_request_id FROM b1_r3_5n_state)),
  0,
  'an inactive destination operator is not notified'
);

SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000204', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notifications
   WHERE user_id = '86000000-0000-4000-8000-000000000204'
     AND reference_id = (SELECT direct_request_id FROM b1_r3_5n_state)),
  0,
  'a deleted destination operator is not notified'
);

SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000205', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notifications
   WHERE user_id = '86000000-0000-4000-8000-000000000205'
     AND reference_id = (SELECT direct_request_id FROM b1_r3_5n_state)),
  0,
  'a destination operator without connections:respond is not notified'
);

RESET ROLE;
UPDATE public.connection_requests
SET requester_approval_status = requester_approval_status
WHERE id = (SELECT direct_request_id FROM b1_r3_5n_state);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000202', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notifications
   WHERE user_id = '86000000-0000-4000-8000-000000000202'
     AND reference_id = (SELECT direct_request_id FROM b1_r3_5n_state)
     AND type = 'connection_request'),
  1,
  'repeating an approval-status update does not duplicate the notification'
);

SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000102', true);
UPDATE b1_r3_5n_state
SET internal_request_id = public.request_connection(
  '86000000-0000-4000-8000-000000000003',
  'Internal approval notification test'
);

SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000301', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notifications
   WHERE user_id = '86000000-0000-4000-8000-000000000301'
     AND reference_id = (SELECT internal_request_id FROM b1_r3_5n_state)),
  0,
  'destination is not notified while requester approval is pending'
);

SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000101', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notifications
   WHERE user_id = '86000000-0000-4000-8000-000000000101'
     AND reference_id = (SELECT internal_request_id FROM b1_r3_5n_state)
     AND type = 'connection_request'),
  1,
  'source administrator is notified to perform the internal approval'
);

SELECT public.review_internal_connection(
  (SELECT internal_request_id FROM b1_r3_5n_state),
  true,
  NULL
);

SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000301', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notifications
   WHERE user_id = '86000000-0000-4000-8000-000000000301'
     AND reference_id = (SELECT internal_request_id FROM b1_r3_5n_state)
     AND type = 'connection_request'),
  1,
  'destination administrator is notified after internal approval'
);
SELECT extensions.is(
  (SELECT reference_id FROM public.notifications
   WHERE user_id = '86000000-0000-4000-8000-000000000301'
     AND reference_id = (SELECT internal_request_id FROM b1_r3_5n_state)
     AND type = 'connection_request'),
  (SELECT internal_request_id FROM b1_r3_5n_state),
  'post-approval notification preserves the connection request reference_id'
);

SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000202', true);
SELECT public.respond_connection_request(
  (SELECT direct_request_id FROM b1_r3_5n_state),
  true,
  NULL
);
SELECT set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000101', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notifications
   WHERE user_id = '86000000-0000-4000-8000-000000000101'
     AND reference_id = (SELECT direct_request_id FROM b1_r3_5n_state)
     AND type = 'connection_accepted'),
  1,
  'the pre-existing accepted-connection notification flow remains active'
);

RESET ROLE;
SELECT extensions.is(
  (SELECT count(*)::integer
   FROM information_schema.routine_privileges
   WHERE routine_schema = 'public'
     AND routine_name = 'notify_on_connection_request'
     AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')),
  0,
  'the SECURITY DEFINER trigger function has no direct execute grants'
);
SELECT extensions.ok(
  position('SET search_path TO ''''' IN pg_get_functiondef('public.notify_on_connection_request()'::regprocedure)) > 0,
  'the SECURITY DEFINER trigger function has an empty search_path'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.connection_requests'::regclass
      AND tgname = 'on_connection_request_accepted'
      AND NOT tgisinternal
  ),
  'the existing accepted-connection trigger is preserved'
);

SELECT * FROM extensions.finish();
ROLLBACK;
