BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
ALTER TABLE IF EXISTS public.invitations_backup_before_cleanup_f2_2 SET SCHEMA private;

REVOKE EXECUTE ON FUNCTION public.accept_operator_invitation_transactional(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_operator_invitation_transactional(text, uuid, text, text) TO service_role;

ALTER TABLE public.operator_invitations ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE public.operator_invitations ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_operator_invitations_token_hash ON public.operator_invitations (token_hash);

-- PATCH DETERMINÍSTICO CHAPARIA
DO $$
DECLARE
  v_comprador_id uuid;
  v_org_id uuid;
  v_count int;
BEGIN
  -- Identifica a Chaparia pela razão social exata ou próxima (garantindo apenas 1)
  SELECT id INTO STRICT v_org_id FROM public.organizations WHERE razao_social = 'Chaparia Ferro' OR razao_social ILIKE '%Chaparia%' LIMIT 1;
  
  -- Conta e seleciona o Comprador específico (deve haver exatamente 1 sem tenant no profile)
  SELECT count(*) INTO v_count FROM public.operators o LEFT JOIN public.profiles p ON p.user_id = o.id
  WHERE o.organization_id = v_org_id AND o.perfil = 'comprador' AND o.status = 'ativo' AND p.organization_id IS NULL;
  
  IF v_count = 1 THEN
    SELECT o.id INTO v_comprador_id FROM public.operators o LEFT JOIN public.profiles p ON p.user_id = o.id
    WHERE o.organization_id = v_org_id AND o.perfil = 'comprador' AND o.status = 'ativo' AND p.organization_id IS NULL;
    
    CREATE TABLE IF NOT EXISTS private.chaparia_patch_backup (user_id uuid, old_org_id uuid, patched_at timestamptz);
    INSERT INTO private.chaparia_patch_backup (user_id, old_org_id, patched_at) VALUES (v_comprador_id, NULL, now());
    
    UPDATE public.profiles SET organization_id = v_org_id WHERE user_id = v_comprador_id;
  END IF;
END;
$$;

-- CONNECTION REQUESTS
ALTER TABLE public.connection_requests ADD COLUMN IF NOT EXISTS requester_approval_status text;
ALTER TABLE public.connection_requests ADD COLUMN IF NOT EXISTS requester_approved_by uuid REFERENCES auth.users(id);
ALTER TABLE public.connection_requests ADD COLUMN IF NOT EXISTS requester_approved_at timestamptz;
ALTER TABLE public.connection_requests ADD COLUMN IF NOT EXISTS requester_rejected_by uuid REFERENCES auth.users(id);
ALTER TABLE public.connection_requests ADD COLUMN IF NOT EXISTS requester_rejected_at timestamptz;
ALTER TABLE public.connection_requests ADD COLUMN IF NOT EXISTS requester_rejection_reason text;

UPDATE public.connection_requests SET requester_approval_status = 'approved' WHERE status = 'accepted' AND requester_approval_status IS NULL;

ALTER TABLE public.connection_requests ADD CONSTRAINT chk_requester_approval_status CHECK (requester_approval_status IN ('pending', 'approved', 'rejected', 'not_required'));

-- POLICIES E VIEWS
DROP POLICY IF EXISTS "Target company managers can update connection requests" ON public.connection_requests;
DROP POLICY IF EXISTS "Users can view connection requests related to their company" ON public.connection_requests;
DROP POLICY IF EXISTS "Users can create connection requests for their company" ON public.connection_requests;
DROP POLICY IF EXISTS "connection_requests_select_own_organizations" ON public.connection_requests;
DROP POLICY IF EXISTS "Super admins can see all connection requests" ON public.connection_requests;

CREATE POLICY "tenant_connection_requests_select" ON public.connection_requests FOR SELECT
USING (
  (requester_company_id = (SELECT organization_id FROM public.operators WHERE id = auth.uid()) AND requester_approval_status IN ('pending', 'approved', 'rejected', 'not_required'))
  OR (target_company_id = (SELECT organization_id FROM public.operators WHERE id = auth.uid()) AND requester_approval_status IN ('approved', 'not_required'))
);

CREATE OR REPLACE VIEW public.active_partnerships WITH (security_invoker = true) AS
SELECT 
    CASE WHEN cr.requester_company_id = op.organization_id THEN cr.target_company_id ELSE cr.requester_company_id END as partner_organization_id,
    cr.id as connection_id,
    cr.status
FROM public.connection_requests cr
JOIN public.operators op ON op.id = auth.uid()
WHERE cr.status = 'accepted' AND (cr.requester_company_id = op.organization_id OR cr.target_company_id = op.organization_id);

REVOKE ALL ON public.active_partnerships FROM PUBLIC, anon;
GRANT SELECT ON public.active_partnerships TO authenticated;

-- RPCS DE APROVAÇÃO
CREATE OR REPLACE FUNCTION public.request_connection(p_target_company_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op public.operators; v_status text; v_req_id uuid;
BEGIN
  SELECT * INTO v_op FROM public.operators WHERE id = auth.uid() AND status = 'ativo';
  IF NOT FOUND THEN RAISE EXCEPTION 'Operador inválido'; END IF;
  IF v_op.perfil = 'administrador' THEN v_status := 'not_required'; ELSIF v_op.perfil = 'comprador' THEN v_status := 'pending'; ELSE RAISE EXCEPTION 'Não autorizado'; END IF;
  INSERT INTO public.connection_requests (requester_company_id, target_company_id, requested_by_user_id, status, requester_approval_status)
  VALUES (v_op.organization_id, p_target_company_id, auth.uid(), 'pending', v_status) RETURNING id INTO v_req_id;
  RETURN v_req_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_connection(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_connection(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_internal_connection(p_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op public.operators; v_req public.connection_requests;
BEGIN
  SELECT * INTO v_op FROM public.operators WHERE id = auth.uid() AND status = 'ativo';
  IF v_op.perfil != 'administrador' THEN RAISE EXCEPTION 'Restrito a administrador'; END IF;
  SELECT * INTO v_req FROM public.connection_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.requester_company_id != v_op.organization_id THEN RAISE EXCEPTION 'Tenant inválido'; END IF;
  IF v_req.requester_approval_status != 'pending' THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  UPDATE public.connection_requests SET requester_approval_status = 'approved', requester_approved_by = auth.uid(), requester_approved_at = now() WHERE id = p_request_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_internal_connection(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_internal_connection(uuid) TO authenticated;

-- NOTIFICAÇÕES (Triggers)
CREATE OR REPLACE FUNCTION public.notify_on_connection_request_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.requester_approval_status = 'pending' THEN
    INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id)
    SELECT id, 'Aprovação interna necessária', 'Nova solicitação de conexão.', 'internal_approval_required', 'connection_requests', NEW.id
    FROM public.operators WHERE organization_id = NEW.requester_company_id AND perfil = 'administrador';
  ELSIF NEW.requester_approval_status = 'not_required' THEN
    INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id)
    SELECT id, 'Nova solicitação de conexão', 'Uma empresa deseja se conectar.', 'external_connection_request', 'connection_requests', NEW.id
    FROM public.operators WHERE organization_id = NEW.target_company_id AND perfil = 'administrador';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_connection_request_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.requester_approval_status = 'pending' AND NEW.requester_approval_status = 'approved' THEN
    INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id)
    SELECT id, 'Nova solicitação de conexão', 'Uma empresa deseja se conectar.', 'external_connection_request', 'connection_requests', NEW.id
    FROM public.operators WHERE organization_id = NEW.target_company_id AND perfil = 'administrador';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_connection_request_created ON public.connection_requests;
CREATE TRIGGER on_connection_request_created AFTER INSERT ON public.connection_requests FOR EACH ROW EXECUTE FUNCTION public.notify_on_connection_request_insert();
CREATE TRIGGER on_connection_request_updated AFTER UPDATE ON public.connection_requests FOR EACH ROW EXECUTE FUNCTION public.notify_on_connection_request_update();

-- RPC ACEITE CONVITE
CREATE OR REPLACE FUNCTION public.accept_operator_invitation_transactional(p_token text, p_user_id uuid, p_ip text, p_user_agent text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_invite RECORD;
  v_now timestamptz := now();
  v_existing_profile_org uuid;
  v_app_role public.app_role;
  v_existing_role text;
  v_user_email text;
  v_op_exists boolean;
  v_prof_exists boolean;
BEGIN
  SELECT * INTO v_invite FROM public.operator_invitations WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex') OR token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite não encontrado.'; END IF;
  IF v_invite.status = 'aceito' THEN RETURN true; END IF;
  IF v_invite.status != 'pendente' THEN RAISE EXCEPTION 'Convite não pendente.'; END IF;
  IF v_invite.expires_at < v_now THEN RAISE EXCEPTION 'Convite expirado.'; END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  IF v_user_email != v_invite.email THEN RAISE EXCEPTION 'Email diverge do convite.'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.operators WHERE id = p_user_id) INTO v_op_exists;
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = p_user_id) INTO v_prof_exists;
  IF NOT v_op_exists OR NOT v_prof_exists THEN RAISE EXCEPTION 'Conta incompleta (missing profile or operator).'; END IF;

  SELECT organization_id INTO v_existing_profile_org FROM public.profiles WHERE user_id = p_user_id;
  IF v_existing_profile_org IS NOT NULL AND v_existing_profile_org != v_invite.organization_id THEN RAISE EXCEPTION 'Operador em outra org.'; END IF;

  CASE v_invite.perfil
      WHEN 'administrador' THEN v_app_role := 'admin'::public.app_role;
      WHEN 'comprador' THEN v_app_role := 'buyer'::public.app_role;
      WHEN 'gestor' THEN v_app_role := 'supplier_manager'::public.app_role;
      WHEN 'solicitante' THEN v_app_role := 'requester'::public.app_role;
      ELSE RAISE EXCEPTION 'Perfil incompatível sem app_role.';
  END CASE;

  SELECT role::text INTO v_existing_role FROM public.user_roles WHERE user_id = p_user_id AND organization_id = v_invite.organization_id LIMIT 1;
  IF FOUND AND v_existing_role != v_app_role::text THEN RAISE EXCEPTION 'Role existente incompatível.'; END IF;

  UPDATE public.profiles SET organization_id = v_invite.organization_id, updated_at = v_now WHERE user_id = p_user_id;
  UPDATE public.operators SET status = 'ativo', organization_id = v_invite.organization_id, accepted_at = v_now WHERE id = p_user_id;
  
  INSERT INTO public.user_roles (user_id, organization_id, role) VALUES (p_user_id, v_invite.organization_id, v_app_role) ON CONFLICT (user_id, organization_id, role) DO NOTHING;
  UPDATE public.operator_invitations SET status = 'aceito', updated_at = v_now, ip_aceite = p_ip, user_agent_aceite = p_user_agent WHERE id = v_invite.id;
  
  RETURN true;
END;
$$;

COMMIT;
