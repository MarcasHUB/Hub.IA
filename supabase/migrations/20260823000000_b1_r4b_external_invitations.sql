-- Fix RLS and constraints for Supplier Invitations (invitations)

-- 1. Add invited_by_id to track which operator sent the invite
ALTER TABLE public.invitations
ADD COLUMN IF NOT EXISTS invited_by_id uuid REFERENCES public.operators(id) ON DELETE SET NULL;

-- 2. Drop legacy policy
DROP POLICY IF EXISTS "invitations_org_all" ON public.invitations;

-- 3. Create B1 compliant policies
CREATE POLICY "invitations_org_select" ON public.invitations
FOR SELECT TO authenticated
USING (public.has_org_access(organization_id));

CREATE POLICY "invitations_org_insert" ON public.invitations
FOR INSERT TO authenticated
WITH CHECK (public.has_org_access(organization_id));

CREATE POLICY "invitations_org_update" ON public.invitations
FOR UPDATE TO authenticated
USING (public.has_org_access(organization_id))
WITH CHECK (public.has_org_access(organization_id));

CREATE POLICY "invitations_org_delete" ON public.invitations
FOR DELETE TO authenticated
USING (public.has_org_access(organization_id));
