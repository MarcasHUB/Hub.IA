\set ON_ERROR_STOP on

BEGIN;

INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'admin-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'invitee@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'buyer-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'admin-c@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'manager-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'requester-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (id, name, slug, status, is_platform_internal)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'Tenant A', 'b1-test-tenant-a', 'ativo', false),
  ('20000000-0000-0000-0000-000000000002', 'Tenant B', 'b1-test-tenant-b', 'ativo', false),
  ('20000000-0000-0000-0000-000000000003', 'Tenant C', 'b1-test-tenant-c', 'ativo', false),
  ('20000000-0000-0000-0000-000000000004', 'Tenant Inativo', 'b1-test-tenant-inactive', 'inativo', false)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  is_platform_internal = EXCLUDED.is_platform_internal;

INSERT INTO public.profiles (user_id, organization_id, full_name, email, is_super_admin, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Admin A', 'admin-a@example.test', false, now()),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Admin B', 'admin-b@example.test', false, now()),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Buyer A', 'buyer-a@example.test', false, now()),
  ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'Admin C', 'admin-c@example.test', false, now()),
  ('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'Manager B', 'manager-b@example.test', false, now()),
  ('10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', 'Requester B', 'requester-b@example.test', false, now())
ON CONFLICT (user_id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  is_super_admin = false,
  updated_at = now();

INSERT INTO public.operators (id, organization_id, nome, sobrenome, email, perfil, status, deleted_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Admin', 'A', 'admin-a@example.test', 'administrador', 'ativo', null, now()),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Admin', 'B', 'admin-b@example.test', 'administrador', 'ativo', null, now()),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Buyer', 'A', 'buyer-a@example.test', 'comprador', 'ativo', null, now()),
  ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'Admin', 'C', 'admin-c@example.test', 'administrador', 'ativo', null, now()),
  ('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'Manager', 'B', 'manager-b@example.test', 'gestor', 'ativo', null, now()),
  ('10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', 'Requester', 'B', 'requester-b@example.test', 'solicitante', 'ativo', null, now())
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  perfil = EXCLUDED.perfil,
  status = 'ativo',
  deleted_at = null,
  updated_at = now();

INSERT INTO public.user_roles (user_id, organization_id, role)
VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'admin'),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'admin'),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'buyer'),
  ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'admin'),
  ('10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'manager'),
  ('10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', 'requester')
ON CONFLICT (user_id, organization_id, role) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

DO $$
DECLARE
  v_identity record;
BEGIN
  SELECT * INTO v_identity FROM public.get_current_identity_context();
  IF v_identity.organization_id <> '20000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'B1_TEST_IDENTITY_TENANT_FAILED';
  END IF;
END;
$$;

CREATE TEMP TABLE b1_test_state (
  request_id uuid,
  internal_request_id uuid,
  invitation_count bigint
) ON COMMIT DROP;
INSERT INTO b1_test_state (invitation_count)
SELECT count(*) FROM public.invitations;

UPDATE b1_test_state
SET request_id = public.request_connection(
  '20000000-0000-0000-0000-000000000002',
  'Solicitação de teste transacional'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.connection_requests
    WHERE id = (SELECT request_id FROM b1_test_state)
      AND requester_company_id = '20000000-0000-0000-0000-000000000001'
      AND target_company_id = '20000000-0000-0000-0000-000000000002'
      AND requested_by_user_id = '10000000-0000-0000-0000-000000000001'
      AND requester_approval_status = 'not_required'
  ) THEN
    RAISE EXCEPTION 'B1_TEST_CANONICAL_REQUEST_ORIGIN_FAILED';
  END IF;

  IF (SELECT count(*) FROM public.invitations) <> (SELECT invitation_count FROM b1_test_state) THEN
    RAISE EXCEPTION 'B1_TEST_EXISTING_ORG_CREATED_INVITATION';
  END IF;

END;
$$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000006', true);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = (SELECT auth.uid())
      AND reference_id = (SELECT request_id FROM b1_test_state)
  ) THEN
    RAISE EXCEPTION 'B1_TEST_MANAGER_NOTIFICATION_MISSING';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

DO $$
BEGIN
  BEGIN
    PERFORM public.request_connection('20000000-0000-0000-0000-000000000002', null);
    RAISE EXCEPTION 'B1_TEST_DUPLICATE_CONNECTION_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'CONNECTION_ALREADY_EXISTS' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.request_connection('20000000-0000-0000-0000-000000000004', null);
    RAISE EXCEPTION 'B1_TEST_INACTIVE_TARGET_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'CONNECTION_TARGET_INVALID' THEN RAISE; END IF;
  END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.request_connection('20000000-0000-0000-0000-000000000001', null);
    RAISE EXCEPTION 'B1_TEST_REVERSE_DUPLICATE_CONNECTION_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'CONNECTION_ALREADY_EXISTS' THEN RAISE; END IF;
  END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

DO $$
BEGIN
  BEGIN
    PERFORM public.request_connection('20000000-0000-0000-0000-000000000001', null);
    RAISE EXCEPTION 'B1_TEST_SELF_CONNECTION_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'CONNECTION_SELF_FORBIDDEN' THEN RAISE; END IF;
  END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
UPDATE b1_test_state
SET internal_request_id = public.request_connection(
  '20000000-0000-0000-0000-000000000003',
  'Solicitação sujeita a aprovação interna'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.connection_requests
    WHERE id = (SELECT internal_request_id FROM b1_test_state)
      AND status = 'pending'
      AND requester_approval_status = 'pending'
  ) THEN
    RAISE EXCEPTION 'B1_TEST_INTERNAL_APPROVAL_NOT_REQUIRED';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.list_partner_connections()
    WHERE connection_id = (SELECT internal_request_id FROM b1_test_state)
  ) THEN
    RAISE EXCEPTION 'B1_TEST_INTERNAL_REQUEST_LEAKED_TO_TARGET';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT public.review_internal_connection(
  (SELECT internal_request_id FROM b1_test_state),
  true,
  null
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.list_partner_connections()
    WHERE connection_id = (SELECT internal_request_id FROM b1_test_state)
      AND can_respond
  ) THEN
    RAISE EXCEPTION 'B1_TEST_INTERNAL_APPROVAL_NOT_VISIBLE';
  END IF;
END;
$$;
SELECT public.respond_connection_request(
  (SELECT internal_request_id FROM b1_test_state),
  true,
  null
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.respond_connection_request((SELECT request_id FROM b1_test_state), true, null);
    RAISE EXCEPTION 'B1_TEST_CROSS_TENANT_RESPONSE_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'CONNECTION_RESPONSE_INVALID' THEN RAISE; END IF;
  END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000007', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.respond_connection_request((SELECT request_id FROM b1_test_state), true, null);
    RAISE EXCEPTION 'B1_TEST_UNAUTHORIZED_PROFILE_RESPONSE_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'CONNECTION_RESPONSE_FORBIDDEN' THEN RAISE; END IF;
  END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000006', true);
SELECT public.respond_connection_request((SELECT request_id FROM b1_test_state), true, null);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.list_partner_connections()
    WHERE partner_organization_id = '20000000-0000-0000-0000-000000000001'
      AND connection_status = 'accepted'
      AND direction = 'received'
  ) THEN
    RAISE EXCEPTION 'B1_TEST_PARTNERSHIP_ACCEPT_FAILED';
  END IF;
END;
$$;

RESET ROLE;
SET LOCAL ROLE service_role;

DO $$
DECLARE
  v_invitation_id uuid;
  v_hash constant text := repeat('a', 64);
BEGIN
  v_invitation_id := public.create_operator_invitation_transactional(
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'invitee@example.test',
    'Invitee',
    'Test',
    null,
    null,
    'comprador',
    null,
    ARRAY[]::uuid[],
    true,
    v_hash,
    now() + interval '72 hours'
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.operator_invitations
    WHERE id = v_invitation_id
      AND token_hash = v_hash
      AND token = v_hash
      AND token_hash ~ '^[0-9a-f]{64}$'
  ) THEN
    RAISE EXCEPTION 'B1_TEST_TOKEN_HASH_FAILED';
  END IF;

  PERFORM public.accept_operator_invitation_transactional(
    v_hash,
    '10000000-0000-0000-0000-000000000003',
    '127.0.0.1',
    'b1-local-test'
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.operators
    WHERE id = '10000000-0000-0000-0000-000000000003'
      AND organization_id = '20000000-0000-0000-0000-000000000001'
      AND status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'B1_TEST_INVITE_ACCEPT_FAILED';
  END IF;
END;
$$;

RESET ROLE;

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.operator_invitations', 'INSERT')
     OR has_table_privilege('authenticated', 'public.operator_invitations', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.operator_invitations', 'DELETE') THEN
    RAISE EXCEPTION 'B1_TEST_OPERATOR_INVITATION_DIRECT_WRITE_GRANT';
  END IF;
END;
$$;

ROLLBACK;
