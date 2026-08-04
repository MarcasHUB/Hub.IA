-- ETAPA 1 — AUDITORIA OBRIGATÓRIA (C1.2)
-- Execute este script no SQL Editor do Supabase de Produção.

-- 1. Definição real de connection_requests
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'connection_requests';

-- 2. Linha exata que conecta Raízen e Chaparia
-- IDs fixos informados:
-- Raízen: 9e2e4d9c-9a9b-42cb-81cb-b2c861335af1
-- Chaparia: 4e45c319-82d3-4cb7-b5f1-107290445325
SELECT * FROM public.connection_requests
WHERE (requester_company_id = '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1' AND target_company_id = '4e45c319-82d3-4cb7-b5f1-107290445325')
   OR (requester_company_id = '4e45c319-82d3-4cb7-b5f1-107290445325' AND target_company_id = '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1');

-- 3. Definição real de conversations
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversations';

-- 4. Policies RLS atuais da tabela conversations e connection_requests
SELECT polname, polcmd, polroles, polqual, polwithcheck 
FROM pg_policy 
WHERE polrelid = 'public.conversations'::regclass OR polrelid = 'public.connection_requests'::regclass;

-- 5. Foreign keys e constraints da conversations
SELECT conname, pg_get_constraintdef(c.oid) 
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE conrelid = 'public.conversations'::regclass;

-- 6. Verificar duplicidades atuais de conversations entre as duas orgs
SELECT id, org_a, org_b, created_at
FROM public.conversations
WHERE (org_a = '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1' AND org_b = '4e45c319-82d3-4cb7-b5f1-107290445325')
   OR (org_a = '4e45c319-82d3-4cb7-b5f1-107290445325' AND org_b = '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1');
