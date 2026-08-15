-- FIXTURE EXCLUSIVAMENTE LOCAL.
-- Nao executar em projeto vinculado/remoto. Ela satisfaz pre-condicoes de uma
-- migration historica sem alterar o arquivo historico aplicado em producao.

BEGIN;

-- Compatibilidade local para migration historica que referencia este status
-- antes de qualquer migration adiciona-lo ao enum.
ALTER TYPE public.invitation_status ADD VALUE IF NOT EXISTS 'enviado';

INSERT INTO public.organizations (
  id, name, slug, cnpj, razao_social, nome_fantasia, status, is_platform_internal
) VALUES
  (
    '68a2f0b2-80f7-4868-bbb9-30b531c12db2',
    'Hub.IA Local Fixture',
    'hub-ia-local-fixture',
    '10.000.000/0001-01',
    'Hub.IA Local Fixture Ltda.',
    'Hub.IA Local',
    'ativo',
    true
  ),
  (
    '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
    'Tenant Raizen Local Fixture',
    'tenant-raizen-local-fixture',
    '20.000.000/0001-02',
    'Tenant Raizen Local Fixture S.A.',
    'Raizen Local',
    'ativo',
    false
  ),
  (
    '4e45c319-82d3-4cb7-b5f1-107290445325',
    'Tenant Chaparia Local Fixture',
    'tenant-chaparia-local-fixture',
    '30.000.000/0001-03',
    'Tenant Chaparia Local Fixture Ltda.',
    'Chaparia Local',
    'ativo',
    false
  )
ON CONFLICT (id) DO NOTHING;

-- Compatibilidade com FKs legado de connection_requests anteriores ao
-- reapontamento para organizations.
INSERT INTO public.companies (id, trade_name, legal_name, cnpj, status)
VALUES
  (
    '68a2f0b2-80f7-4868-bbb9-30b531c12db2',
    'Hub.IA Local', 'Hub.IA Local Fixture Ltda.', '10.000.000/0001-01', 'active'
  ),
  (
    '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
    'Raizen Local', 'Tenant Raizen Local Fixture S.A.', '20.000.000/0001-02', 'active'
  ),
  (
    '4e45c319-82d3-4cb7-b5f1-107290445325',
    'Chaparia Local', 'Tenant Chaparia Local Fixture Ltda.', '30.000.000/0001-03', 'active'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '32a5db3a-e0d1-4ed4-aef4-27edf75d817d',
    'authenticated', 'authenticated', 'platform-admin@local.invalid', NULL,
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f45e8c1b-2c50-4cca-86b3-f14cf45b951b',
    'authenticated', 'authenticated', 'tenant-admin@local.invalid', NULL,
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '2b8ac705-c356-430d-9788-0e60e7821724',
    'authenticated', 'authenticated', 'tenant-auditor@local.invalid', NULL,
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e34a4a69-2b0f-4ad3-8942-9eb5be752f6c',
    'authenticated', 'authenticated', 'chaparia-admin@local.invalid', NULL,
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (
  id, user_id, organization_id, full_name, email, status, is_super_admin
) VALUES
  (
    '32a5db3a-e0d1-4ed4-aef4-27edf75d817d',
    '32a5db3a-e0d1-4ed4-aef4-27edf75d817d',
    '68a2f0b2-80f7-4868-bbb9-30b531c12db2',
    'Platform Admin Local', 'platform-admin@local.invalid', 'active', true
  ),
  (
    'f45e8c1b-2c50-4cca-86b3-f14cf45b951b',
    'f45e8c1b-2c50-4cca-86b3-f14cf45b951b',
    '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
    'Tenant Admin Local', 'tenant-admin@local.invalid', 'active', false
  ),
  (
    '2b8ac705-c356-430d-9788-0e60e7821724',
    '2b8ac705-c356-430d-9788-0e60e7821724',
    '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
    'Tenant Auditor Local', 'tenant-auditor@local.invalid', 'active', false
  ),
  (
    'e34a4a69-2b0f-4ad3-8942-9eb5be752f6c',
    'e34a4a69-2b0f-4ad3-8942-9eb5be752f6c',
    '4e45c319-82d3-4cb7-b5f1-107290445325',
    'Chaparia Admin Local', 'chaparia-admin@local.invalid', 'active', false
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.operators (
  id, organization_id, nome, sobrenome, email, perfil, status
) VALUES
  (
    '32a5db3a-e0d1-4ed4-aef4-27edf75d817d',
    '68a2f0b2-80f7-4868-bbb9-30b531c12db2',
    'Platform', 'Admin', 'platform-admin@local.invalid', 'administrador', 'ativo'
  ),
  (
    'f45e8c1b-2c50-4cca-86b3-f14cf45b951b',
    '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
    'Tenant', 'Admin', 'tenant-admin@local.invalid', 'administrador', 'ativo'
  ),
  (
    '2b8ac705-c356-430d-9788-0e60e7821724',
    '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
    'Tenant', 'Auditor', 'tenant-auditor@local.invalid', 'auditor', 'ativo'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, organization_id, role)
VALUES
  (
    '32a5db3a-e0d1-4ed4-aef4-27edf75d817d',
    '68a2f0b2-80f7-4868-bbb9-30b531c12db2',
    'admin'
  ),
  (
    'f45e8c1b-2c50-4cca-86b3-f14cf45b951b',
    '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
    'admin'
  ),
  (
    '2b8ac705-c356-430d-9788-0e60e7821724',
    '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
    'auditor'
  )
ON CONFLICT (user_id, organization_id, role) DO NOTHING;

INSERT INTO public.platform_admins (user_id, role, status)
VALUES (
  '32a5db3a-e0d1-4ed4-aef4-27edf75d817d',
  'platform_admin',
  'active'
)
ON CONFLICT (user_id) DO UPDATE
SET role = EXCLUDED.role, status = EXCLUDED.status, updated_at = now();

COMMIT;
