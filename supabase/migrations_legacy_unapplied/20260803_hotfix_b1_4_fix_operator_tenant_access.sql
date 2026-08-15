-- supabase/migrations/20260803_hotfix_b1_4_fix_operator_tenant_access.sql

-- 1. Corrigir a função has_org_access para considerar profiles.organization_id e super_admin
CREATE OR REPLACE FUNCTION public.has_org_access(
  org_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.is_super_admin IS TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.organization_id = org_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = org_id
    );
$$;

-- 2. Garantir policy de SELECT em operators
DROP POLICY IF EXISTS "operators_org_select" ON public.operators;

CREATE POLICY "operators_org_select" 
ON public.operators 
FOR SELECT 
TO authenticated 
USING (
  public.has_org_access(organization_id) OR public.is_super_admin()
);
