-- Migration: Fix partner identities resolution under RLS
-- Creates a SECURITY DEFINER function to replace the SECURITY INVOKER view

DROP VIEW IF EXISTS public.partner_identities;

CREATE OR REPLACE FUNCTION public.get_partner_identities()
RETURNS TABLE (
    partner_organization_id uuid,
    razao_social text,
    nome_fantasia text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_my_org_id uuid;
BEGIN
    v_my_org_id := public.current_authenticated_organization_id();

    IF v_my_org_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT DISTINCT
        o.id AS partner_organization_id,
        o.razao_social,
        o.nome_fantasia
    FROM public.connection_requests cr
    JOIN public.organizations o ON o.id = (
        CASE 
            WHEN cr.requester_company_id = v_my_org_id THEN cr.target_company_id
            ELSE cr.requester_company_id 
        END
    )
    WHERE (cr.requester_company_id = v_my_org_id OR cr.target_company_id = v_my_org_id)
      AND cr.status = 'accepted';
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_identities() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_identities() TO authenticated;
