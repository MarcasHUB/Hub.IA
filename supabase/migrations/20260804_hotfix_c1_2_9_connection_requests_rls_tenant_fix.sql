-- HOTFIX C1.2.9 — Blindagem da resolução do tenant na RLS

-- 1. Criar helper mínimo SECURITY DEFINER para obter o tenant sem acionar RLS adicional de profiles
CREATE OR REPLACE FUNCTION public.current_authenticated_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1;
$$;

-- 2. Blindar os privilégios da função
REVOKE ALL ON FUNCTION public.current_authenticated_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_authenticated_organization_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_authenticated_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_authenticated_organization_id() TO service_role;

-- 3. Recriar a policy de SELECT para connection_requests
DROP POLICY IF EXISTS "connection_requests_select_own_organizations" ON public.connection_requests;

CREATE POLICY "connection_requests_select_own_organizations"
ON public.connection_requests
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    requester_company_id = public.current_authenticated_organization_id()
    OR
    target_company_id = public.current_authenticated_organization_id()
);

-- 4. Substituir a policy antiga de super admin
DROP POLICY IF EXISTS "Super admins can see all connection requests" ON public.connection_requests;

CREATE POLICY "connection_requests_select_super_admin"
ON public.connection_requests
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.is_super_admin IS TRUE
    )
);
