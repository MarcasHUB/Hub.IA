-- HOTFIX C1.2.8 — Correção RLS connection_requests para utilizar profiles.organization_id

-- 1. Remoção da Policy de SELECT legada
DROP POLICY IF EXISTS "Users can view connection requests related to their company" ON public.connection_requests;

-- Opcional (caso exista com outro nome de outras versões)
DROP POLICY IF EXISTS "connection_requests_select_own_organizations" ON public.connection_requests;

-- 2. Criação da nova Policy de leitura
CREATE POLICY "connection_requests_select_own_organizations"
ON public.connection_requests
FOR SELECT
TO authenticated
USING (
    requester_company_id = (
        SELECT p.organization_id
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
        LIMIT 1
    )
    OR
    target_company_id = (
        SELECT p.organization_id
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
        LIMIT 1
    )
);

-- 3. Confirmação de segurança (revoke anon)
REVOKE ALL ON TABLE public.connection_requests FROM anon;
GRANT SELECT ON TABLE public.connection_requests TO authenticated;
