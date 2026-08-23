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
WITH CHECK (
    public.has_org_access(organization_id)
    AND (
        invited_by_id IS NULL OR EXISTS (
            SELECT 1 FROM public.operators o
            WHERE o.id = invited_by_id
            AND o.user_id = auth.uid()
            AND o.organization_id = invitations.organization_id
        )
    )
);

CREATE POLICY "invitations_org_update" ON public.invitations
FOR UPDATE TO authenticated
USING (public.has_org_access(organization_id))
WITH CHECK (public.has_org_access(organization_id));

CREATE POLICY "invitations_org_delete" ON public.invitations
FOR DELETE TO authenticated
USING (public.has_org_access(organization_id));

-- 4. Automatically set invited_by_id if missing
CREATE OR REPLACE FUNCTION public.set_invitation_invited_by()
RETURNS trigger AS $$
BEGIN
    IF NEW.invited_by_id IS NULL THEN
        SELECT id INTO NEW.invited_by_id
        FROM public.operators
        WHERE user_id = auth.uid()
        AND organization_id = NEW.organization_id
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_invitation_invited_by ON public.invitations;
CREATE TRIGGER trg_set_invitation_invited_by
BEFORE INSERT ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.set_invitation_invited_by();

-- 5. Prevent Duplicate Invitations (Partial Unique Index)
CREATE UNIQUE INDEX IF NOT EXISTS unq_pending_invitation_per_org_doc 
ON public.invitations (organization_id, document) 
WHERE status = 'pendente';
