
-- =========================================================
-- 1. COMPANIES: drop always-true SELECT policies
-- =========================================================
DROP POLICY IF EXISTS "Allow authenticated read companies" ON public.companies;
DROP POLICY IF EXISTS "Permitir leitura de companies para autenticados" ON public.companies;

-- Users may read: their own company (by cnpj), companies they have a conversation with, super admins see all
CREATE POLICY "companies_select_scoped" ON public.companies
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR cnpj IN (SELECT p.cnpj FROM public.profiles p WHERE p.user_id = auth.uid() AND p.cnpj IS NOT NULL)
  OR EXISTS (
    SELECT 1 FROM public.conversations conv
    JOIN public.companies own ON own.cnpj IN (SELECT p2.cnpj FROM public.profiles p2 WHERE p2.user_id = auth.uid())
    WHERE (conv.company_a_id = companies.id AND conv.company_b_id = own.id)
       OR (conv.company_b_id = companies.id AND conv.company_a_id = own.id)
  )
);

-- =========================================================
-- 2. PROFILES: drop always-true SELECT policy
-- =========================================================
DROP POLICY IF EXISTS "Permitir leitura de profiles para autenticados" ON public.profiles;

-- =========================================================
-- 3. PRODUCT_OFFERS: drop always-true SELECT policy (scoped ALL policy remains)
-- =========================================================
DROP POLICY IF EXISTS "Permitir leitura de ofertas para usuarios autenticados" ON public.product_offers;

-- =========================================================
-- 4. SUPPLIER_QUOTATIONS: drop always-true public policy
-- =========================================================
DROP POLICY IF EXISTS "Permitir TUDO em supplier_quotations para Fornecedores" ON public.supplier_quotations;

-- =========================================================
-- 5. SUPPLIER_QUOTATION_ITEMS: drop always-true public policy
-- =========================================================
DROP POLICY IF EXISTS "Permitir TUDO em supplier_quotation_items para Fornecedores" ON public.supplier_quotation_items;

-- =========================================================
-- 6. AUDIT_LOGS: add org-scoped admin SELECT (super admin policy already exists)
-- =========================================================
CREATE POLICY "audit_logs_org_admin_select" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT c.id FROM public.companies c
    JOIN public.profiles p ON p.cnpj = c.cnpj
    WHERE p.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
  )
);

-- =========================================================
-- 7. INVITES: add access policies (was RLS enabled, no policies)
-- =========================================================
CREATE POLICY "invites_super_admin_all" ON public.invites
FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "invites_invitee_select" ON public.invites
FOR SELECT TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- =========================================================
-- 8. SECURITY DEFINER hardening: revoke EXECUTE on internal helpers
-- =========================================================
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_connection_requests_modtime() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_organization_hub_score(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_all_hub_scores() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_any_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_auth_user_organization_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- get_invite_details must remain public (invite lookup pre-auth); keep as-is.

-- =========================================================
-- 9. Set fixed search_path on functions missing it
-- =========================================================
ALTER FUNCTION public.insert_audit_log(text, text, uuid, jsonb, uuid) SET search_path = public;
ALTER FUNCTION public.get_company_matches(uuid) SET search_path = public;
ALTER FUNCTION public.start_hubia_conversation(uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.create_rfq_from_conversation(uuid, uuid, uuid, text, text, text, numeric, text, timestamptz, uuid, text, text, text, text, text, text) SET search_path = public;
ALTER FUNCTION public.update_connection_requests_modtime() SET search_path = public;
ALTER FUNCTION public.claim_invite(uuid, uuid) SET search_path = public;

-- =========================================================
-- 10. Storage: drop broad SELECT policy that enables listing organization-logos
-- Direct URL access to public bucket files still works.
-- =========================================================
DROP POLICY IF EXISTS "Leitura Pública 10vraxa_0" ON storage.objects;
DROP POLICY IF EXISTS "Upload Autenticado 10vraxa_2" ON storage.objects;
;
