CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;
SELECT extensions.plan(60);

INSERT INTO public.organizations (id, name, slug, status, is_platform_internal)
VALUES
  ('93000000-0000-4000-8000-000000000001', 'Tenant A Pending Update', 'tenant-a-pending-update', 'ativo', false),
  ('94000000-0000-4000-8000-000000000001', 'Tenant B Pending Update', 'tenant-b-pending-update', 'ativo', false);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin-a-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'manager-a-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '94000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin-b-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000201', 'authenticated', 'authenticated', 'success-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000202', 'authenticated', 'authenticated', 'active-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000203', 'authenticated', 'authenticated', 'cancelled-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000204', 'authenticated', 'authenticated', 'accepted-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000205', 'authenticated', 'authenticated', 'manager-invalid-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000206', 'authenticated', 'authenticated', 'category-invalid-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000207', 'authenticated', 'authenticated', 'atomic-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000208', 'authenticated', 'authenticated', 'expired-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000209', 'authenticated', 'authenticated', 'duplicate-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000210', 'authenticated', 'authenticated', 'missing-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000211', 'authenticated', 'authenticated', 'different-auth-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '93000000-0000-4000-8000-000000000212', 'authenticated', 'authenticated', 'role-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '94000000-0000-4000-8000-000000000201', 'authenticated', 'authenticated', 'target-b-update@local.invalid', NULL, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.profiles (id, user_id, organization_id, full_name, email, status)
VALUES
  ('93000000-0000-4000-8000-000000000101', '93000000-0000-4000-8000-000000000101', '93000000-0000-4000-8000-000000000001', 'Admin A Update', 'admin-a-update@local.invalid', 'active'),
  ('93000000-0000-4000-8000-000000000102', '93000000-0000-4000-8000-000000000102', '93000000-0000-4000-8000-000000000001', 'Manager A Update', 'manager-a-update@local.invalid', 'active'),
  ('94000000-0000-4000-8000-000000000101', '94000000-0000-4000-8000-000000000101', '94000000-0000-4000-8000-000000000001', 'Admin B Update', 'admin-b-update@local.invalid', 'active'),
  ('93000000-0000-4000-8000-000000000201', '93000000-0000-4000-8000-000000000201', '93000000-0000-4000-8000-000000000001', 'Legacy Pending Name', 'success-update@local.invalid', 'active');

INSERT INTO public.operators (
  id, organization_id, nome, sobrenome, email, telefone, cargo, perfil,
  status, gestor_id, deleted_at, todas_categorias
) VALUES
  ('93000000-0000-4000-8000-000000000101', '93000000-0000-4000-8000-000000000001', 'Admin', 'A Update', 'admin-a-update@local.invalid', NULL, 'Admin', 'administrador', 'ativo', NULL, NULL, true),
  ('93000000-0000-4000-8000-000000000102', '93000000-0000-4000-8000-000000000001', 'Manager', 'A Update', 'manager-a-update@local.invalid', NULL, 'Manager', 'gestor', 'ativo', '93000000-0000-4000-8000-000000000101', NULL, true),
  ('94000000-0000-4000-8000-000000000101', '94000000-0000-4000-8000-000000000001', 'Admin', 'B Update', 'admin-b-update@local.invalid', NULL, 'Admin', 'administrador', 'ativo', NULL, NULL, true),
  ('93000000-0000-4000-8000-000000000201', '93000000-0000-4000-8000-000000000001', 'Old', 'Pending', 'success-update@local.invalid', 'old-phone', 'Old cargo', 'comprador', 'pendente', '93000000-0000-4000-8000-000000000101', NULL, false),
  ('93000000-0000-4000-8000-000000000202', '93000000-0000-4000-8000-000000000001', 'Active', 'Target', 'active-update@local.invalid', NULL, 'Active cargo', 'comprador', 'ativo', '93000000-0000-4000-8000-000000000101', NULL, false),
  ('93000000-0000-4000-8000-000000000203', '93000000-0000-4000-8000-000000000001', 'Cancelled', 'Target', 'cancelled-update@local.invalid', NULL, 'Cancelled cargo', 'comprador', 'cancelado', '93000000-0000-4000-8000-000000000101', NULL, false),
  ('93000000-0000-4000-8000-000000000204', '93000000-0000-4000-8000-000000000001', 'Accepted', 'Invitation', 'accepted-update@local.invalid', NULL, 'Accepted cargo', 'comprador', 'pendente', '93000000-0000-4000-8000-000000000101', NULL, false),
  ('93000000-0000-4000-8000-000000000205', '93000000-0000-4000-8000-000000000001', 'Manager', 'Invalid', 'manager-invalid-update@local.invalid', NULL, 'Manager invalid cargo', 'comprador', 'pendente', '93000000-0000-4000-8000-000000000101', NULL, false),
  ('93000000-0000-4000-8000-000000000206', '93000000-0000-4000-8000-000000000001', 'Category', 'Invalid', 'category-invalid-update@local.invalid', NULL, 'Category invalid cargo', 'comprador', 'pendente', '93000000-0000-4000-8000-000000000101', NULL, false),
  ('93000000-0000-4000-8000-000000000207', '93000000-0000-4000-8000-000000000001', 'Atomic', 'Original', 'atomic-update@local.invalid', NULL, 'Atomic original cargo', 'comprador', 'pendente', '93000000-0000-4000-8000-000000000101', NULL, false),
  ('93000000-0000-4000-8000-000000000208', '93000000-0000-4000-8000-000000000001', 'Expired', 'Original', 'expired-update@local.invalid', NULL, 'Expired original cargo', 'comprador', 'pendente', '93000000-0000-4000-8000-000000000101', NULL, false),
  ('93000000-0000-4000-8000-000000000209', '93000000-0000-4000-8000-000000000001', 'Duplicate', 'Original', 'duplicate-update@local.invalid', NULL, 'Duplicate original cargo', 'comprador', 'pendente', '93000000-0000-4000-8000-000000000101', NULL, false),
  ('93000000-0000-4000-8000-000000000210', '93000000-0000-4000-8000-000000000001', 'Missing', 'Original', 'missing-update@local.invalid', NULL, 'Missing original cargo', 'comprador', 'pendente', '93000000-0000-4000-8000-000000000101', NULL, false),
  ('93000000-0000-4000-8000-000000000211', '93000000-0000-4000-8000-000000000001', 'Auth', 'Mismatch', 'auth-mismatch-update@local.invalid', NULL, 'Auth mismatch cargo', 'comprador', 'pendente', '93000000-0000-4000-8000-000000000101', NULL, false),
  ('93000000-0000-4000-8000-000000000212', '93000000-0000-4000-8000-000000000001', 'Role', 'Original', 'role-update@local.invalid', NULL, 'Role original cargo', 'comprador', 'pendente', '93000000-0000-4000-8000-000000000101', NULL, false),
  ('94000000-0000-4000-8000-000000000201', '94000000-0000-4000-8000-000000000001', 'Foreign', 'Target', 'target-b-update@local.invalid', NULL, 'Foreign cargo', 'comprador', 'pendente', '94000000-0000-4000-8000-000000000101', NULL, false);

INSERT INTO public.user_roles (user_id, organization_id, role)
VALUES
  ('93000000-0000-4000-8000-000000000101', '93000000-0000-4000-8000-000000000001', 'admin'),
  ('93000000-0000-4000-8000-000000000102', '93000000-0000-4000-8000-000000000001', 'supplier_manager'),
  ('94000000-0000-4000-8000-000000000101', '94000000-0000-4000-8000-000000000001', 'admin'),
  ('93000000-0000-4000-8000-000000000212', '93000000-0000-4000-8000-000000000001', 'buyer');

INSERT INTO public.categories (id, organization_id, name, normalized_name)
VALUES
  ('93000000-0000-4000-8000-000000000301', '93000000-0000-4000-8000-000000000001', 'Old Category Update', 'old category update'),
  ('93000000-0000-4000-8000-000000000302', '93000000-0000-4000-8000-000000000001', 'New Category Update', 'new category update'),
  ('94000000-0000-4000-8000-000000000301', '94000000-0000-4000-8000-000000000001', 'Foreign Category Update', 'foreign category update');

INSERT INTO public.operator_categories (operator_id, category_id)
VALUES
  ('93000000-0000-4000-8000-000000000201', '93000000-0000-4000-8000-000000000301'),
  ('93000000-0000-4000-8000-000000000205', '93000000-0000-4000-8000-000000000301'),
  ('93000000-0000-4000-8000-000000000206', '93000000-0000-4000-8000-000000000301'),
  ('93000000-0000-4000-8000-000000000207', '93000000-0000-4000-8000-000000000301');

INSERT INTO public.operator_invitations (
  id, organization_id, email, nome, cargo, perfil, token, token_hash,
  status, category_ids, todas_categorias, expires_at
) VALUES
  ('93000000-0000-4000-8000-000000000401', '93000000-0000-4000-8000-000000000001', 'success-update@local.invalid', 'Old Pending', 'Old cargo', 'comprador', repeat('1', 64), repeat('1', 64), 'pendente', ARRAY['93000000-0000-4000-8000-000000000301']::uuid[], false, '2099-01-01 00:00:00+00'),
  ('93000000-0000-4000-8000-000000000402', '93000000-0000-4000-8000-000000000001', 'active-update@local.invalid', 'Active Target', 'Active cargo', 'comprador', repeat('2', 64), repeat('2', 64), 'pendente', ARRAY[]::uuid[], false, '2099-01-01 00:00:00+00'),
  ('93000000-0000-4000-8000-000000000403', '93000000-0000-4000-8000-000000000001', 'cancelled-update@local.invalid', 'Cancelled Target', 'Cancelled cargo', 'comprador', repeat('3', 64), repeat('3', 64), 'pendente', ARRAY[]::uuid[], false, '2099-01-01 00:00:00+00'),
  ('93000000-0000-4000-8000-000000000404', '93000000-0000-4000-8000-000000000001', 'accepted-update@local.invalid', 'Accepted Invitation', 'Accepted cargo', 'comprador', repeat('4', 64), repeat('4', 64), 'aceito', ARRAY[]::uuid[], false, '2099-01-01 00:00:00+00'),
  ('93000000-0000-4000-8000-000000000405', '93000000-0000-4000-8000-000000000001', 'manager-invalid-update@local.invalid', 'Manager Invalid', 'Manager invalid cargo', 'comprador', repeat('5', 64), repeat('5', 64), 'pendente', ARRAY['93000000-0000-4000-8000-000000000301']::uuid[], false, '2099-01-01 00:00:00+00'),
  ('93000000-0000-4000-8000-000000000406', '93000000-0000-4000-8000-000000000001', 'category-invalid-update@local.invalid', 'Category Invalid', 'Category invalid cargo', 'comprador', repeat('6', 64), repeat('6', 64), 'pendente', ARRAY['93000000-0000-4000-8000-000000000301']::uuid[], false, '2099-01-01 00:00:00+00'),
  ('93000000-0000-4000-8000-000000000407', '93000000-0000-4000-8000-000000000001', 'atomic-update@local.invalid', 'Atomic Original', 'Atomic original cargo', 'comprador', repeat('7', 64), repeat('7', 64), 'pendente', ARRAY['93000000-0000-4000-8000-000000000301']::uuid[], false, '2099-01-01 00:00:00+00'),
  ('93000000-0000-4000-8000-000000000408', '93000000-0000-4000-8000-000000000001', 'expired-update@local.invalid', 'Expired Original', 'Expired original cargo', 'comprador', repeat('8', 64), repeat('8', 64), 'pendente', ARRAY[]::uuid[], false, now() - interval '1 minute'),
  ('93000000-0000-4000-8000-000000000409', '93000000-0000-4000-8000-000000000001', 'duplicate-update@local.invalid', 'Duplicate Original', 'Duplicate original cargo', 'comprador', repeat('9', 64), repeat('9', 64), 'pendente', ARRAY[]::uuid[], false, '2099-01-01 00:00:00+00'),
  ('93000000-0000-4000-8000-000000000410', '93000000-0000-4000-8000-000000000001', 'duplicate-update@local.invalid', 'Duplicate Second', 'Duplicate second cargo', 'comprador', repeat('a', 64), repeat('a', 64), 'pendente', ARRAY[]::uuid[], false, '2099-01-01 00:00:00+00'),
  ('93000000-0000-4000-8000-000000000411', '93000000-0000-4000-8000-000000000001', 'auth-mismatch-update@local.invalid', 'Auth Mismatch', 'Auth mismatch cargo', 'comprador', repeat('b', 64), repeat('b', 64), 'pendente', ARRAY[]::uuid[], false, '2099-01-01 00:00:00+00'),
  ('93000000-0000-4000-8000-000000000412', '93000000-0000-4000-8000-000000000001', 'role-update@local.invalid', 'Role Original', 'Role original cargo', 'comprador', repeat('c', 64), repeat('c', 64), 'pendente', ARRAY[]::uuid[], false, '2099-01-01 00:00:00+00'),
  ('94000000-0000-4000-8000-000000000401', '94000000-0000-4000-8000-000000000001', 'target-b-update@local.invalid', 'Foreign Target', 'Foreign cargo', 'comprador', repeat('d', 64), repeat('d', 64), 'pendente', ARRAY[]::uuid[], false, '2099-01-01 00:00:00+00');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000101', true);
SELECT extensions.lives_ok(
  $$ SELECT public.update_pending_operator_invitation(
       '93000000-0000-4000-8000-000000000201', 'Isabela', 'Bocca', '(11) 99999-0000',
       'Compradora', 'comprador', '93000000-0000-4000-8000-000000000102', false,
       ARRAY['93000000-0000-4000-8000-000000000302']::uuid[]
     ) $$,
  'A: authorized administrator edits a pending operator in its tenant'
);
RESET ROLE;
SELECT extensions.is((SELECT nome FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000201'), 'Isabela', 'B: operator first name is updated');
SELECT extensions.is((SELECT sobrenome FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000201'), 'Bocca', 'B: operator surname is updated');
SELECT extensions.is((SELECT telefone FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000201'), '(11) 99999-0000', 'pending operator phone is updated');
SELECT extensions.is((SELECT cargo FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000201'), 'Compradora', 'pending operator title is updated');
SELECT extensions.is((SELECT perfil::text FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000201'), 'comprador', 'pending operator profile is updated consistently');
SELECT extensions.is((SELECT gestor_id FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000201'), '93000000-0000-4000-8000-000000000102'::uuid, 'valid manager is persisted');
SELECT extensions.is((SELECT nome FROM public.operator_invitations WHERE id = '93000000-0000-4000-8000-000000000401'), 'Isabela Bocca', 'B: pending invitation receives the complete operator name');
SELECT extensions.ok((SELECT cargo = 'Compradora' AND perfil = 'comprador' FROM public.operator_invitations WHERE id = '93000000-0000-4000-8000-000000000401'), 'invitation title and profile remain coherent');
SELECT extensions.is((SELECT full_name FROM public.profiles WHERE user_id = '93000000-0000-4000-8000-000000000201'), 'Legacy Pending Name', 'C: profile name is unchanged before acceptance');
SELECT extensions.is((SELECT count(*)::integer FROM public.operator_categories WHERE operator_id = '93000000-0000-4000-8000-000000000201'), 1, 'M: valid categories are synchronized atomically');
SELECT extensions.is((SELECT category_id FROM public.operator_categories WHERE operator_id = '93000000-0000-4000-8000-000000000201'), '93000000-0000-4000-8000-000000000302'::uuid, 'M: old category is replaced by the requested tenant category');
SELECT extensions.is((SELECT category_ids FROM public.operator_invitations WHERE id = '93000000-0000-4000-8000-000000000401'), ARRAY['93000000-0000-4000-8000-000000000302']::uuid[], 'M: invitation categories match operator categories');
SELECT extensions.is((SELECT token_hash FROM public.operator_invitations WHERE id = '93000000-0000-4000-8000-000000000401'), repeat('1', 64), 'N: token_hash is unchanged');
SELECT extensions.is((SELECT expires_at FROM public.operator_invitations WHERE id = '93000000-0000-4000-8000-000000000401'), '2099-01-01 00:00:00+00'::timestamptz, 'O: expiration is unchanged');
SELECT extensions.is((SELECT email FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000201'), 'success-update@local.invalid', 'operator email is immutable');
SELECT extensions.is((SELECT email FROM public.operator_invitations WHERE id = '93000000-0000-4000-8000-000000000401'), 'success-update@local.invalid', 'invitation email is immutable');
SELECT extensions.is((SELECT email FROM auth.users WHERE id = '93000000-0000-4000-8000-000000000201'), 'success-update@local.invalid', 'Auth email is untouched');
SELECT extensions.is((SELECT count(*)::integer FROM public.operator_invitations WHERE organization_id = '93000000-0000-4000-8000-000000000001' AND email = 'success-update@local.invalid' AND status = 'pendente'), 1, 'P: update creates no duplicate invitation');
SELECT extensions.is((SELECT count(*)::integer FROM public.user_roles WHERE user_id = '93000000-0000-4000-8000-000000000201'), 0, 'pending update does not create a user role');

SET LOCAL ROLE service_role;
SELECT extensions.lives_ok(
  $$ SELECT public.accept_operator_invitation_transactional(
       repeat('1', 64), '93000000-0000-4000-8000-000000000201', '127.0.0.1', 'B1-R.3.5U fixture'
     ) $$,
  'D: updated invitation remains acceptable through B1-R.3.5I'
);
RESET ROLE;
SELECT extensions.is((SELECT full_name FROM public.profiles WHERE user_id = '93000000-0000-4000-8000-000000000201'), 'Isabela Bocca', 'D: B1-R.3.5I promotes the updated canonical name on acceptance');
SELECT extensions.is((SELECT status::text FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000201'), 'ativo', 'D: accepted operator becomes active');
SELECT extensions.is((SELECT role::text FROM public.user_roles WHERE user_id = '93000000-0000-4000-8000-000000000201'), 'buyer', 'D: accepted updated profile receives the expected role');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000202', 'Changed', 'Active', NULL, NULL, 'comprador', NULL, true, ARRAY[]::uuid[]) $$,
  'P0001', 'OPERATOR_INVITE_NOT_PENDING', 'E: active operator cannot be edited by the pending contract'
);
RESET ROLE;
SELECT extensions.is((SELECT nome FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000202'), 'Active', 'E: active operator remains unchanged');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000203', 'Changed', 'Cancelled', NULL, NULL, 'comprador', NULL, true, ARRAY[]::uuid[]) $$,
  'P0001', 'OPERATOR_INVITE_NOT_PENDING', 'F: cancelled operator cannot be edited'
);
RESET ROLE;
SELECT extensions.is((SELECT nome FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000203'), 'Cancelled', 'F: cancelled operator remains unchanged');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000204', 'Changed', 'Accepted', NULL, NULL, 'comprador', NULL, true, ARRAY[]::uuid[]) $$,
  'P0001', 'OPERATOR_INVITE_NOT_PENDING', 'G: accepted invitation cannot be edited'
);
RESET ROLE;
SELECT extensions.is((SELECT nome FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000204'), 'Accepted', 'G: operator tied only to an accepted invitation remains unchanged');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('94000000-0000-4000-8000-000000000201', 'Cross', 'Tenant', NULL, NULL, 'comprador', NULL, true, ARRAY[]::uuid[]) $$,
  'P0001', 'OPERATOR_INVITE_NOT_FOUND', 'H/J: manipulated cross-tenant operator id fails closed'
);
RESET ROLE;
SELECT extensions.is((SELECT nome FROM public.operators WHERE id = '94000000-0000-4000-8000-000000000201'), 'Foreign', 'H/J: foreign operator remains unchanged');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000102', true);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000207', 'Unauthorized', 'Change', NULL, NULL, 'comprador', NULL, true, ARRAY[]::uuid[]) $$,
  'P0001', 'FORBIDDEN', 'I: caller without operators_manage is forbidden'
);
RESET ROLE;
SELECT extensions.is((SELECT nome FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000207'), 'Atomic', 'Q: forbidden operation mutates no operator');
SELECT extensions.is((SELECT nome FROM public.operator_invitations WHERE id = '93000000-0000-4000-8000-000000000407'), 'Atomic Original', 'Q: forbidden operation mutates no invitation');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000205', 'Invalid', 'Hierarchy', NULL, NULL, 'solicitante', '93000000-0000-4000-8000-000000000101', false, ARRAY[]::uuid[]) $$,
  'P0001', 'OPERATOR_MANAGER_HIERARCHY_INVALID', 'K: invalid manager hierarchy is rejected'
);
RESET ROLE;
SELECT extensions.is((SELECT nome FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000205'), 'Manager', 'Q: hierarchy error mutates no operator');
SELECT extensions.is((SELECT nome FROM public.operator_invitations WHERE id = '93000000-0000-4000-8000-000000000405'), 'Manager Invalid', 'Q: hierarchy error mutates no invitation');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000206', 'Invalid', 'Category', NULL, NULL, 'comprador', NULL, false, ARRAY['94000000-0000-4000-8000-000000000301']::uuid[]) $$,
  'P0001', 'OPERATOR_CATEGORY_INVALID', 'L: cross-tenant category is rejected'
);
RESET ROLE;
SELECT extensions.is((SELECT category_id FROM public.operator_categories WHERE operator_id = '93000000-0000-4000-8000-000000000206'), '93000000-0000-4000-8000-000000000301'::uuid, 'Q: category error preserves existing operator category');
SELECT extensions.is((SELECT nome FROM public.operator_invitations WHERE id = '93000000-0000-4000-8000-000000000406'), 'Category Invalid', 'Q: category error mutates no invitation');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000208', 'Changed', 'Expired', NULL, NULL, 'comprador', NULL, true, ARRAY[]::uuid[]) $$,
  'P0001', 'OPERATOR_INVITE_EXPIRED', 'expired pending invitation cannot be edited'
);
RESET ROLE;
SELECT extensions.is((SELECT nome FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000208'), 'Expired', 'expired invitation leaves operator unchanged');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000209', 'Changed', 'Duplicate', NULL, NULL, 'comprador', NULL, true, ARRAY[]::uuid[]) $$,
  'P0001', 'OPERATOR_INVITE_IDENTITY_INCONSISTENT', 'multiple pending invitations fail closed'
);
RESET ROLE;
SELECT extensions.is((SELECT count(*)::integer FROM public.operator_invitations WHERE email = 'duplicate-update@local.invalid' AND status = 'pendente'), 2, 'duplicate inconsistency is not silently reconciled');
SELECT extensions.is((SELECT nome FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000209'), 'Duplicate', 'duplicate inconsistency mutates no operator');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000212', 'Changed', 'Role', NULL, NULL, 'comprador', NULL, true, ARRAY[]::uuid[]) $$,
  'P0001', 'OPERATOR_IDENTITY_INCONSISTENT', 'pending operator with an accepted role fails closed'
);
RESET ROLE;
SELECT extensions.is((SELECT count(*)::integer FROM public.user_roles WHERE user_id = '93000000-0000-4000-8000-000000000212'), 1, 'identity inconsistency preserves the existing role');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000210', 'Changed', 'Missing', NULL, NULL, 'comprador', NULL, true, ARRAY[]::uuid[]) $$,
  'P0001', 'OPERATOR_INVITE_NOT_FOUND', 'pending operator without an invitation fails closed'
);
RESET ROLE;
SELECT extensions.is((SELECT nome FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000210'), 'Missing', 'missing invitation mutates no operator');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000211', 'Changed', 'Auth', NULL, NULL, 'comprador', NULL, true, ARRAY[]::uuid[]) $$,
  'P0001', 'OPERATOR_AUTH_IDENTITY_MISMATCH', 'mismatched Auth identity fails closed'
);
RESET ROLE;
SELECT extensions.is((SELECT nome FROM public.operators WHERE id = '93000000-0000-4000-8000-000000000211'), 'Auth', 'Auth mismatch mutates no operator');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000101', true);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000205', 'Admin', 'With Manager', NULL, NULL, 'administrador', '93000000-0000-4000-8000-000000000101', true, ARRAY[]::uuid[]) $$,
  'P0001', 'OPERATOR_MANAGER_FORBIDDEN_FOR_ADMIN', 'administrator profile cannot receive a manager'
);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000205', 'Auditor', 'Without Manager', NULL, NULL, 'auditor', NULL, true, ARRAY[]::uuid[]) $$,
  'P0001', 'OPERATOR_MANAGER_REQUIRED', 'auditor profile requires an administrator manager'
);
SELECT extensions.throws_ok(
  $$ SELECT public.update_pending_operator_invitation('93000000-0000-4000-8000-000000000205', 'Buyer', 'Foreign Manager', NULL, NULL, 'comprador', '94000000-0000-4000-8000-000000000101', true, ARRAY[]::uuid[]) $$,
  'P0001', 'OPERATOR_MANAGER_INVALID', 'cross-tenant manager id is rejected'
);
RESET ROLE;

SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.update_pending_operator_invitation(uuid,text,text,text,text,public.operator_perfil,uuid,boolean,uuid[])', 'EXECUTE'),
  'authenticated can execute the pending update RPC'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.update_pending_operator_invitation(uuid,text,text,text,text,public.operator_perfil,uuid,boolean,uuid[])', 'EXECUTE'),
  'anon cannot execute the pending update RPC'
);
SELECT extensions.ok(
  NOT has_function_privilege('service_role', 'public.update_pending_operator_invitation(uuid,text,text,text,text,public.operator_perfil,uuid,boolean,uuid[])', 'EXECUTE'),
  'service_role receives no unnecessary execute privilege'
);
SELECT extensions.is(
  (SELECT count(*)::integer
   FROM pg_catalog.pg_proc AS p
   WHERE p.oid = 'public.update_pending_operator_invitation(uuid,text,text,text,text,public.operator_perfil,uuid,boolean,uuid[])'::regprocedure
     AND p.prosecdef
     AND p.proconfig @> ARRAY['search_path=""']
     AND NOT EXISTS (
       SELECT 1
       FROM pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) AS acl
       WHERE acl.grantee = 0
         AND acl.privilege_type = 'EXECUTE'
     )),
  1,
  'RPC has the exact secure signature, SECURITY DEFINER, empty search_path and no PUBLIC execute'
);
SELECT extensions.is(
  (SELECT count(*)::integer
   FROM pg_catalog.pg_proc AS p
   JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'update_pending_operator_invitation'
     AND pg_catalog.pg_get_function_identity_arguments(p.oid) =
       'p_operator_id uuid, p_nome text, p_cargo text, p_perfil public.operator_perfil, p_todas_categorias boolean, p_category_ids uuid[]'),
  0,
  'legacy incomplete overload is absent'
);

SELECT * FROM extensions.finish();
ROLLBACK;
