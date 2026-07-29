
-- Fix always-true INSERT policy on audit_logs
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Revoke public/anon execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_invite_details(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.manage_operator(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_invite(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_invite(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_rfq_from_conversation(uuid, uuid, uuid, text, text, text, numeric, text, timestamptz, uuid, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.insert_audit_log(text, text, uuid, jsonb, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_company_matches(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.start_hubia_conversation(uuid, uuid, text) FROM PUBLIC, anon;

-- Revoke authenticated execute on RLS-only helper functions (called via SECURITY DEFINER from policies; do not need direct RPC access)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_auth_user_organization_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon, authenticated;
;
