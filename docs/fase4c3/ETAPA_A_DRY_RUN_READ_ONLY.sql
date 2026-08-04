/*
ETAPA A — DRY-RUN SOMENTE LEITURA

PROIBIDO:
- INSERT
- UPDATE
- DELETE
- ALTER
- DROP
- CREATE
- TRUNCATE
- qualquer comando destrutivo ou estrutural

Este script apenas consulta metadados e registros existentes.
*/

-- ============================================================================
-- 01. IDENTIFICACAO DO AMBIENTE
-- ============================================================================
SELECT 
  '01_IDENTIFICACAO_AMBIENTE' AS section,
  current_database() AS banco_atual,
  current_user AS usuario_atual,
  current_schema() AS schema_atual,
  current_setting('server_version') AS postgres_version,
  current_timestamp AS timestamp_real,
  current_setting('timezone') AS timezone,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') AS total_tabelas_public;

-- ============================================================================
-- 02. INVENTÁRIO REAL DE FOREIGN KEYS
-- ============================================================================
SELECT 
  '02_FOREIGN_KEYS' AS section,
  tc.table_schema AS schema,
  tc.table_name AS tabela_origem,
  kcu.column_name AS coluna_origem,
  tc.constraint_name AS constraint,
  ccu.table_name AS tabela_referenciada,
  ccu.column_name AS coluna_referenciada,
  rc.update_rule AS regra_on_update,
  rc.delete_rule AS regra_on_delete,
  tc.is_deferrable AS constraint_deferrable
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (
    ccu.table_name IN ('organizations', 'companies', 'profiles', 'operators', 'products', 'materials', 'organization_materials', 'categories', 'suppliers', 'conversations', 'invitations', 'user_roles', 'connection_requests', 'messages', 'quotation_requests', 'quotation_items', 'supplier_quotations', 'supplier_quotation_items', 'rfqs', 'audit_logs')
    OR tc.table_name IN ('organizations', 'companies', 'profiles', 'operators', 'products', 'materials', 'organization_materials', 'categories', 'suppliers', 'conversations', 'invitations', 'user_roles', 'connection_requests', 'messages', 'quotation_requests', 'quotation_items', 'supplier_quotations', 'supplier_quotation_items', 'rfqs', 'audit_logs')
  )
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 03. COLUNAS CONTENDO IDs CRÍTICOS (Sem FK Formal)
-- ============================================================================
SELECT 
  '03_COLUNAS_COM_IDS' AS section,
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND (
    column_name LIKE '%organization_id%' OR 
    column_name LIKE '%company_id%' OR 
    column_name LIKE '%company_a_id%' OR 
    column_name LIKE '%company_b_id%' OR 
    column_name LIKE '%supplier_id%' OR 
    column_name LIKE '%product_id%' OR 
    column_name LIKE '%material_id%' OR 
    column_name LIKE '%category_id%' OR 
    column_name LIKE '%conversation_id%' OR 
    column_name LIKE '%profile_id%' OR 
    column_name LIKE '%operator_id%'
  )
ORDER BY table_name, column_name;

-- ============================================================================
-- 04A. ORGANIZAÇÕES ENVOLVIDAS
-- ============================================================================
SELECT 
  '04A_ORGANIZACOES_ENVOLVIDAS' AS section,
  id,
  name,
  cnpj,
  created_at
FROM public.organizations
WHERE id IN (
  '68a2f0b2-80f7-4868-bbb9-30b531c12db2',
  'bb2edb49-8742-460f-8bff-96a84b4265b5',
  '206f40ea-1841-4f34-b373-3ced14e2bda3',
  '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
  'a0000000-0000-0000-0000-000000000001'
);

-- ============================================================================
-- 04B. TODAS AS COLUNAS DE ORGANIZATIONS EXISTENTES
-- ============================================================================
SELECT 
  '04B_COLUNAS_ORGANIZATIONS' AS section,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organizations'
ORDER BY ordinal_position;

-- ============================================================================
-- 05. USUÁRIOS PROTEGIDOS
-- ============================================================================
SELECT 
  '05A_AUTH_USERS' AS section,
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users
WHERE email IN (
  'viniciuscordebello@gmail.com',
  'everton.cordebello@raizen.com',
  'viniciuscordebello@icloud.com'
);

SELECT 
  '05B_PROFILES' AS section,
  p.id AS profile_id,
  p.user_id,
  p.organization_id,
  p.is_super_admin,
  u.email
FROM public.profiles p
JOIN auth.users u ON p.user_id = u.id
WHERE u.email IN (
  'viniciuscordebello@gmail.com',
  'everton.cordebello@raizen.com',
  'viniciuscordebello@icloud.com'
);

SELECT 
  '05C_OPERATORS' AS section,
  o.id AS operator_id,
  o.user_id,
  o.organization_id,
  u.email
FROM public.operators o
JOIN auth.users u ON o.user_id = u.id
WHERE u.email IN (
  'viniciuscordebello@gmail.com',
  'everton.cordebello@raizen.com',
  'viniciuscordebello@icloud.com'
);

SELECT 
  '05D_USER_ROLES' AS section,
  ur.id AS user_role_id,
  ur.user_id,
  ur.organization_id,
  ur.role_name,
  ur.role_scope,
  u.email
FROM public.user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email IN (
  'viniciuscordebello@gmail.com',
  'everton.cordebello@raizen.com',
  'viniciuscordebello@icloud.com'
);

-- ============================================================================
-- 06. CONTAGENS SEPARADAS POR ORGANIZAÇÃO
-- ============================================================================
SELECT 
  '06A_CONTAGEM_PROFILES' AS section,
  organization_id,
  count(*) AS record_count
FROM public.profiles
WHERE organization_id IN (
  '68a2f0b2-80f7-4868-bbb9-30b531c12db2',
  'bb2edb49-8742-460f-8bff-96a84b4265b5',
  '206f40ea-1841-4f34-b373-3ced14e2bda3',
  '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
  'a0000000-0000-0000-0000-000000000001'
)
GROUP BY organization_id;

SELECT 
  '06B_CONTAGEM_OPERATORS' AS section,
  organization_id,
  count(*) AS record_count
FROM public.operators
WHERE organization_id IN (
  '68a2f0b2-80f7-4868-bbb9-30b531c12db2',
  'bb2edb49-8742-460f-8bff-96a84b4265b5',
  '206f40ea-1841-4f34-b373-3ced14e2bda3',
  '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
  'a0000000-0000-0000-0000-000000000001'
)
GROUP BY organization_id;

SELECT 
  '06C_CONTAGEM_PRODUCTS' AS section,
  organization_id,
  count(*) AS record_count
FROM public.products
WHERE organization_id IN (
  '68a2f0b2-80f7-4868-bbb9-30b531c12db2',
  'bb2edb49-8742-460f-8bff-96a84b4265b5',
  '206f40ea-1841-4f34-b373-3ced14e2bda3',
  '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
  'a0000000-0000-0000-0000-000000000001'
)
GROUP BY organization_id;

SELECT 
  '06D_CONTAGEM_ORG_MATERIALS' AS section,
  organization_id,
  count(*) AS record_count
FROM public.organization_materials
WHERE organization_id IN (
  '68a2f0b2-80f7-4868-bbb9-30b531c12db2',
  'bb2edb49-8742-460f-8bff-96a84b4265b5',
  '206f40ea-1841-4f34-b373-3ced14e2bda3',
  '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
  'a0000000-0000-0000-0000-000000000001'
)
GROUP BY organization_id;

SELECT 
  '06E_CONTAGEM_INVITATIONS' AS section,
  organization_id,
  count(*) AS record_count
FROM public.invitations
WHERE organization_id IN (
  '68a2f0b2-80f7-4868-bbb9-30b531c12db2',
  'bb2edb49-8742-460f-8bff-96a84b4265b5',
  '206f40ea-1841-4f34-b373-3ced14e2bda3',
  '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
  'a0000000-0000-0000-0000-000000000001'
)
GROUP BY organization_id;

SELECT 
  '06F_CONTAGEM_CONVERSATIONS' AS section,
  company_a_id AS organization_id,
  count(*) AS record_count
FROM public.conversations
WHERE company_a_id IN (
  '68a2f0b2-80f7-4868-bbb9-30b531c12db2',
  'bb2edb49-8742-460f-8bff-96a84b4265b5',
  '206f40ea-1841-4f34-b373-3ced14e2bda3',
  '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
  'a0000000-0000-0000-0000-000000000001'
)
GROUP BY company_a_id
UNION ALL
SELECT 
  company_b_id AS organization_id,
  count(*) AS record_count
FROM public.conversations
WHERE company_b_id IN (
  '68a2f0b2-80f7-4868-bbb9-30b531c12db2',
  'bb2edb49-8742-460f-8bff-96a84b4265b5',
  '206f40ea-1841-4f34-b373-3ced14e2bda3',
  '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
  'a0000000-0000-0000-0000-000000000001'
)
GROUP BY company_b_id;

-- ============================================================================
-- 07. PRODUTOS DA SUPPLYHUB LTDA
-- ============================================================================
SELECT 
  '07_PRODUTOS_SUPPLYHUB' AS section,
  id,
  organization_id,
  material_id,
  category_id,
  sku,
  name,
  description,
  is_active,
  created_at,
  updated_at
FROM public.products
WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';

-- ============================================================================
-- 08. SUPPLIERS (Fornecedores)
-- ============================================================================
SELECT 
  '08_SUPPLIERS' AS section,
  id,
  name,
  cnpj,
  email,
  created_at,
  is_demo,
  is_active,
  archived_at,
  status
FROM public.suppliers
ORDER BY created_at DESC;

-- ============================================================================
-- 09. CATEGORIAS DUPLICADAS
-- ============================================================================
SELECT 
  '09A_CATEGORIAS_DUPLICADAS' AS section,
  LOWER(TRIM(name)) AS normalized_name,
  COUNT(id) AS ocorrencias,
  ARRAY_AGG(id) AS ids_encontrados,
  ARRAY_AGG(organization_id) AS org_ids
FROM public.categories
GROUP BY LOWER(TRIM(name))
HAVING COUNT(id) > 1
ORDER BY ocorrencias DESC;

SELECT 
  '09B_CATEGORIAS_DETALHES' AS section,
  id,
  name,
  organization_id,
  created_at
FROM public.categories
WHERE LOWER(TRIM(name)) IN (
  SELECT LOWER(TRIM(name))
  FROM public.categories
  GROUP BY LOWER(TRIM(name))
  HAVING COUNT(id) > 1
)
ORDER BY LOWER(TRIM(name)), created_at;

-- ============================================================================
-- 10. CONVERSAS (Identificação)
-- ============================================================================
SELECT 
  '10_CONVERSAS' AS section,
  id,
  company_a_id,
  company_b_id,
  created_at,
  updated_at
FROM public.conversations
WHERE company_a_id = 'a0000000-0000-0000-0000-000000000001' 
   OR company_b_id = 'a0000000-0000-0000-0000-000000000001'
   OR company_a_id IN ('206f40ea-1841-4f34-b373-3ced14e2bda3', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1')
   OR company_b_id IN ('206f40ea-1841-4f34-b373-3ced14e2bda3', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1');

-- ============================================================================
-- 11. STORAGE METADADOS
-- ============================================================================
SELECT 
  '11_STORAGE_METADADOS' AS section,
  bucket_id,
  name AS objeto_nome,
  path_tokens[1] AS prefixo_ou_conversa_id,
  metadata ->> 'size' AS tamanho,
  metadata ->> 'mimetype' AS mimetype,
  created_at,
  updated_at
FROM storage.objects
WHERE bucket_id = 'messages';

-- ============================================================================
-- 12. RLS E POLICIES
-- ============================================================================
SELECT 
  '12A_RLS_POLICIES' AS section,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'companies', 'conversations', 'connection_requests', 'profiles', 'operators', 'products', 'materials', 'categories', 'suppliers');

SELECT
  '12B_RLS_TABLE_STATUS' AS section,
  c.relname AS tablename,
  c.relrowsecurity,
  c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('organizations', 'companies', 'conversations', 'connection_requests', 'profiles', 'operators', 'products', 'materials', 'categories', 'suppliers');
