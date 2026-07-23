-- ==========================================
-- Migration: Data Migration de Perfis Legados e Atualização Final de Constraints
-- ==========================================

-- 1. Migração de Dados na Tabela operators
UPDATE public.operators 
SET perfil = 'solicitante'
WHERE perfil = 'consulta' AND cargo LIKE '%[APP]%';

UPDATE public.operators 
SET perfil = 'auditor'
WHERE perfil = 'consulta' AND (cargo NOT LIKE '%[APP]%' OR cargo IS NULL);

-- 2. Migração de Dados na Tabela operator_invitations
UPDATE public.operator_invitations 
SET perfil = 'solicitante'
WHERE perfil = 'consulta' AND cargo LIKE '%[APP]%';

UPDATE public.operator_invitations 
SET perfil = 'auditor'
WHERE perfil = 'consulta' AND (cargo NOT LIKE '%[APP]%' OR cargo IS NULL);

-- 3. Atualização Final dos CHECK constraints (Removendo 'consulta')
ALTER TABLE public.operators DROP CONSTRAINT IF EXISTS operators_perfil_check;
ALTER TABLE public.operators ADD CONSTRAINT operators_perfil_check 
CHECK (perfil::text = ANY (ARRAY['administrador'::character varying, 'gestor'::character varying, 'comprador'::character varying, 'solicitante'::character varying, 'auditor'::character varying]::text[]));

ALTER TABLE public.operator_invitations DROP CONSTRAINT IF EXISTS operator_invitations_perfil_check;
ALTER TABLE public.operator_invitations ADD CONSTRAINT operator_invitations_perfil_check 
CHECK (perfil::text = ANY (ARRAY['administrador'::character varying, 'gestor'::character varying, 'comprador'::character varying, 'solicitante'::character varying, 'auditor'::character varying]::text[]));
