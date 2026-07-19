-- 1. Criar função super-segura que ignora bloqueios de RLS internos ao checar a user_roles
CREATE OR REPLACE FUNCTION public.has_org_access(org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND organization_id = org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Atualizar a policy de OPERATORS
DROP POLICY IF EXISTS "operators_org_select" ON public.operators;
DROP POLICY IF EXISTS "operators_org_update" ON public.operators;
DROP POLICY IF EXISTS "operators_org_insert" ON public.operators;

CREATE POLICY "operators_org_select" ON public.operators 
FOR SELECT TO authenticated 
USING ( public.has_org_access(organization_id) );

CREATE POLICY "operators_org_update" ON public.operators 
FOR UPDATE TO authenticated 
USING ( public.has_org_access(organization_id) );

CREATE POLICY "operators_org_insert" ON public.operators 
FOR INSERT TO authenticated 
WITH CHECK ( public.has_org_access(organization_id) );

-- 3. Atualizar a policy de OPERATOR_INVITATIONS (Para manter consistência)
DROP POLICY IF EXISTS "operator_invitations_org_select" ON public.operator_invitations;
DROP POLICY IF EXISTS "operator_invitations_org_update" ON public.operator_invitations;
DROP POLICY IF EXISTS "operator_invitations_org_insert" ON public.operator_invitations;

CREATE POLICY "operator_invitations_org_select" ON public.operator_invitations 
FOR SELECT TO authenticated 
USING ( public.has_org_access(organization_id) );

CREATE POLICY "operator_invitations_org_update" ON public.operator_invitations 
FOR UPDATE TO authenticated 
USING ( public.has_org_access(organization_id) );

CREATE POLICY "operator_invitations_org_insert" ON public.operator_invitations 
FOR INSERT TO authenticated 
WITH CHECK ( public.has_org_access(organization_id) );

-- 4. FORÇAR RECARREGAMENTO DO CACHE DA API
NOTIFY pgrst, 'reload schema';
