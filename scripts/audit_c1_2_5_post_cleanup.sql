-- SCRIPT DE AUDITORIA PRÉ/PÓS MIGRATION C1.2.5
-- Execute este script no SQL Editor do seu Supabase Dashboard ANTES de dar como encerrado.

-- 1. Auditoria de correspondência UUID (Órfãos)
-- Objetivo: Garantir que 100% dos IDs em connection_requests existem em organizations.
-- Nenhum NULL deve aparecer nas colunas requester_org ou target_org.
SELECT
    cr.id,
    cr.requester_company_id,
    ro.id AS requester_org,
    cr.target_company_id,
    to2.id AS target_org
FROM public.connection_requests cr
LEFT JOIN public.organizations ro
       ON ro.id = cr.requester_company_id
LEFT JOIN public.organizations to2
       ON to2.id = cr.target_company_id;


-- 2. Auditoria de Foreign Keys (Apontamentos)
-- Objetivo: Verificar para onde as FKs de connection_requests estão apontando.
-- Antes da Migration C1.2.5 deve retornar 'companies'.
-- Depois da Migration C1.2.5 deve retornar 'organizations' para ambas as FKs.
SELECT
    conname AS constraint_name,
    confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE conrelid = 'public.connection_requests'::regclass
AND contype = 'f';
