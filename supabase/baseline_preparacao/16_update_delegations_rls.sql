-- ==========================================
-- Migration 16: Update Delegations RLS
-- ==========================================

-- Disable RLS temporarily to clean up policies
ALTER TABLE public.delegations DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies for delegations
DROP POLICY IF EXISTS "Administradores da organização podem ver todas delegações" ON public.delegations;
DROP POLICY IF EXISTS "Gestores podem ver delegações da sua organização" ON public.delegations;
DROP POLICY IF EXISTS "Gestores podem criar e atualizar delegações da sua organização" ON public.delegations;
DROP POLICY IF EXISTS "Usuários podem criar delegações para si mesmos" ON public.delegations;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias delegações" ON public.delegations;
DROP POLICY IF EXISTS "Usuários podem ver delegações onde são delegador ou delegado" ON public.delegations;

-- Re-enable RLS
ALTER TABLE public.delegations ENABLE ROW LEVEL SECURITY;

-- Policy 1: Acesso de Leitura (SELECT)
-- Administradores, Gestores podem ver tudo da sua organização.
-- O próprio operador de origem ou substituto também pode ver as delegações onde está envolvido.
CREATE POLICY "delegations_select_policy" ON public.delegations
    FOR SELECT TO authenticated
    USING (
        organization_id = (SELECT organization_id FROM public.operators WHERE id = auth.uid())
    );

-- Policy 2: Criação (INSERT)
-- Apenas Administradores ou Gestores da mesma organização podem criar delegações.
-- Ou o próprio usuário pode criar para si mesmo.
CREATE POLICY "delegations_insert_policy" ON public.delegations
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = (SELECT organization_id FROM public.operators WHERE id = auth.uid()) AND
        (
            (SELECT perfil FROM public.operators WHERE id = auth.uid()) IN ('administrador', 'gestor') OR
            operador_origem_id = auth.uid()
        )
    );

-- Policy 3: Atualização (UPDATE)
CREATE POLICY "delegations_update_policy" ON public.delegations
    FOR UPDATE TO authenticated
    USING (
        organization_id = (SELECT organization_id FROM public.operators WHERE id = auth.uid()) AND
        (
            (SELECT perfil FROM public.operators WHERE id = auth.uid()) IN ('administrador', 'gestor') OR
            operador_origem_id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id = (SELECT organization_id FROM public.operators WHERE id = auth.uid()) AND
        (
            (SELECT perfil FROM public.operators WHERE id = auth.uid()) IN ('administrador', 'gestor') OR
            operador_origem_id = auth.uid()
        )
    );

-- Policy 4: Exclusão (DELETE)
CREATE POLICY "delegations_delete_policy" ON public.delegations
    FOR DELETE TO authenticated
    USING (
        organization_id = (SELECT organization_id FROM public.operators WHERE id = auth.uid()) AND
        (
            (SELECT perfil FROM public.operators WHERE id = auth.uid()) IN ('administrador', 'gestor') OR
            operador_origem_id = auth.uid()
        )
    );
