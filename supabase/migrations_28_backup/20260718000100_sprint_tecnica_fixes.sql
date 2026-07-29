-- Migration: 20260718_001_sprint_tecnica_fixes
-- Descrição: Ajustes de segurança e governança para a Sprint Técnica.

-- 1. SOFT DELETE PARA MATERIAIS
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. RLS PARA ORGANIZATIONS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Select: Usuário só vê sua própria organização
CREATE POLICY "organizations_select" 
ON public.organizations 
FOR SELECT 
TO authenticated 
USING (
  id IN (SELECT organization_id FROM public.operators WHERE id = auth.uid())
);

-- Update: Apenas administradores da organização podem editar seus dados base
CREATE POLICY "organizations_update" 
ON public.organizations 
FOR UPDATE 
TO authenticated 
USING (
  id IN (SELECT organization_id FROM public.operators WHERE id = auth.uid() AND perfil = 'administrador')
);

-- 3. RLS PARA DELEGATIONS
ALTER TABLE delegations ENABLE ROW LEVEL SECURITY;

-- Insert: Apenas pode delegar quem for o operador de origem e estiver autenticado
CREATE POLICY "delegations_insert" 
ON public.delegations 
FOR INSERT 
TO authenticated 
WITH CHECK (operador_origem_id = auth.uid());

-- Select: Operadores veem as delegações de sua empresa
CREATE POLICY "delegations_select"
ON public.delegations
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM public.operators WHERE id = auth.uid())
);

-- Update: O operador de origem (ou admin) pode encerrar/cancelar sua delegação
CREATE POLICY "delegations_update"
ON public.delegations
FOR UPDATE
TO authenticated
USING (
  operador_origem_id = auth.uid() OR
  organization_id IN (SELECT organization_id FROM public.operators WHERE id = auth.uid() AND perfil = 'administrador')
);
