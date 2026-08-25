BEGIN;

-- 1. Create Wrapper for Organization ID
CREATE OR REPLACE FUNCTION public.support_current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ci.organization_id
  FROM private.current_identity() AS ci;
$$;

REVOKE ALL ON FUNCTION public.support_current_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.support_current_organization_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.support_current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.support_current_organization_id() TO service_role;

-- 2. Create Wrapper for Platform Admin
CREATE OR REPLACE FUNCTION public.support_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    private.is_current_platform_admin(),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.support_is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.support_is_platform_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.support_is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.support_is_platform_admin() TO service_role;

-- 3. Drop existing SELECT policies
DROP POLICY IF EXISTS support_tickets_select_tenant ON public.support_tickets;
DROP POLICY IF EXISTS support_tickets_select_platform_admin ON public.support_tickets;
DROP POLICY IF EXISTS support_messages_select_tenant ON public.support_messages;
DROP POLICY IF EXISTS support_messages_select_platform_admin ON public.support_messages;

-- 4. Recreate Policies TO authenticated using the wrappers

CREATE POLICY support_tickets_select_tenant 
ON public.support_tickets
FOR SELECT 
TO authenticated 
USING (
  organization_id = public.support_current_organization_id()
);

CREATE POLICY support_tickets_select_platform_admin 
ON public.support_tickets
FOR SELECT 
TO authenticated 
USING (
  public.support_is_platform_admin()
);

CREATE POLICY support_messages_select_tenant 
ON public.support_messages
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 
    FROM public.support_tickets t 
    WHERE t.id = support_messages.ticket_id 
      AND t.organization_id = public.support_current_organization_id()
  )
);

CREATE POLICY support_messages_select_platform_admin 
ON public.support_messages
FOR SELECT 
TO authenticated 
USING (
  public.support_is_platform_admin()
);

COMMIT;
