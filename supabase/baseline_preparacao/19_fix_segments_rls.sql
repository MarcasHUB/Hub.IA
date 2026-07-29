-- Migration 19: Fix segments RLS policies

-- 1. Remover policies antigas e engessadas
DROP POLICY IF EXISTS "segments_org_insert" ON public.segments;
DROP POLICY IF EXISTS "segments_org_update" ON public.segments;
DROP POLICY IF EXISTS "segments_org_delete" ON public.segments;
DROP POLICY IF EXISTS "segments_org_read" ON public.segments;

-- 2. Garantir que o RLS está ativo
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;

-- 3. Policy de Leitura (SELECT)
-- Permite leitura se for da mesma organização, ou se for global (NULL), ou se for Super Admin.
CREATE POLICY "segments_select_policy"
ON public.segments
FOR SELECT
USING (
  organization_id = get_auth_user_organization_id()
  OR organization_id IS NULL
  OR is_super_admin()
);

-- 4. Policy de Escrita (INSERT)
-- Permite inserção se for admin da organização ou se for Super Admin (este último pode inserir global).
CREATE POLICY "segments_insert_policy"
ON public.segments
FOR INSERT
WITH CHECK (
  (organization_id = get_auth_user_organization_id() AND has_role(auth.uid(), organization_id, 'admin'::app_role))
  OR is_super_admin()
);

-- 5. Policy de Atualização (UPDATE)
-- Permite atualização usando as mesmas regras de inserção
CREATE POLICY "segments_update_policy"
ON public.segments
FOR UPDATE
USING (
  (organization_id = get_auth_user_organization_id() AND has_role(auth.uid(), organization_id, 'admin'::app_role))
  OR is_super_admin()
)
WITH CHECK (
  (organization_id = get_auth_user_organization_id() AND has_role(auth.uid(), organization_id, 'admin'::app_role))
  OR is_super_admin()
);

-- 6. Policy de Deleção (DELETE)
-- Permite exclusão usando as mesmas regras
CREATE POLICY "segments_delete_policy"
ON public.segments
FOR DELETE
USING (
  (organization_id = get_auth_user_organization_id() AND has_role(auth.uid(), organization_id, 'admin'::app_role))
  OR is_super_admin()
);
