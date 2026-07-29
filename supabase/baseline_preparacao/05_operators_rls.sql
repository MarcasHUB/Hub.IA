-- ==========================================
-- Migration: Políticas RLS para operators
-- ==========================================

-- Habilitar RLS (caso não esteja habilitado)
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas para evitar duplicidade
DROP POLICY IF EXISTS "operators_org_select" ON public.operators;
DROP POLICY IF EXISTS "operators_org_update" ON public.operators;
DROP POLICY IF EXISTS "operators_org_insert" ON public.operators;

-- SELECT: usuário autenticado só pode ler operadores da própria organização
CREATE POLICY "operators_org_select"
ON public.operators
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = operators.organization_id
    )
);

-- UPDATE: usuário autenticado só pode atualizar operadores da própria organização
CREATE POLICY "operators_org_update"
ON public.operators
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = operators.organization_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = operators.organization_id
    )
);

-- INSERT: usuário autenticado só pode inserir operadores na própria organização
CREATE POLICY "operators_org_insert"
ON public.operators
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = operators.organization_id
    )
);
