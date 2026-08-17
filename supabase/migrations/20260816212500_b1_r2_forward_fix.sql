-- Migration: fix/b1-r2-chat-compliance

BEGIN;

-- ========================================================================================
-- 1. IDENTIDADE DE PARCEIROS NO CHAT E COMPLIANCE (Views Seguras)
-- ========================================================================================

-- Retorna metadados mínimos (nome e logo) de organizações contrapartes em conexões aceitas
CREATE OR REPLACE VIEW public.partner_identities WITH (security_invoker = true) AS
SELECT
    CASE 
        WHEN cr.requester_company_id = op.organization_id THEN cr.target_company_id
        ELSE cr.requester_company_id 
    END as partner_organization_id,
    o.razao_social,
    o.nome_fantasia,
    o.id as org_id
FROM public.connection_requests cr
JOIN public.operators op ON op.id = auth.uid()
JOIN public.organizations o ON o.id = (
    CASE 
        WHEN cr.requester_company_id = op.organization_id THEN cr.target_company_id
        ELSE cr.requester_company_id 
    END
)
WHERE cr.status = 'accepted'
  AND (cr.requester_company_id = op.organization_id OR cr.target_company_id = op.organization_id);

-- Mas o RLS em public.organizations impediria o JOIN de o.razao_social!
-- Solução: Criar função SECURITY DEFINER para resolver os nomes com base na validação acima.

CREATE OR REPLACE FUNCTION public.get_partner_metadata(p_target_org_id uuid)
RETURNS TABLE (razao_social text, nome_fantasia text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_my_org_id uuid;
  v_is_partner boolean;
BEGIN
  v_my_org_id := public.current_authenticated_organization_id();
  IF v_my_org_id IS NULL THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.connection_requests
    WHERE status = 'accepted'
      AND ((requester_company_id = v_my_org_id AND target_company_id = p_target_org_id)
       OR (target_company_id = v_my_org_id AND requester_company_id = p_target_org_id))
  ) INTO v_is_partner;

  IF v_is_partner THEN
    RETURN QUERY SELECT o.razao_social, o.nome_fantasia FROM public.organizations o WHERE o.id = p_target_org_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.get_partner_metadata(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_metadata(uuid) TO authenticated;

-- ========================================================================================
-- 2. RESOLUÇÃO DE IDENTIDADE PARA COMPLIANCE EVENTS (Security Definer View)
-- ========================================================================================
-- O Administrador visualiza seus eventos e o nome do destino.

CREATE OR REPLACE FUNCTION public.get_my_compliance_events()
RETURNS TABLE (
    id uuid,
    created_at timestamptz,
    conversation_id uuid,
    sender_user_id uuid,
    recipient_organization_id uuid,
    recipient_name text,
    event_type text,
    risk_level text,
    file_name text,
    sender_name text,
    was_cancelled boolean,
    user_confirmed boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_my_org_id uuid;
  v_is_admin boolean;
BEGIN
  v_my_org_id := public.current_authenticated_organization_id();
  IF v_my_org_id IS NULL THEN RETURN; END IF;

  SELECT (perfil = 'administrador') INTO v_is_admin FROM public.operators WHERE id = auth.uid();
  IF NOT v_is_admin AND NOT public.is_super_admin() THEN RETURN; END IF;

  RETURN QUERY
  SELECT 
    ce.id,
    ce.created_at,
    ce.conversation_id,
    ce.sender_user_id,
    ce.recipient_organization_id,
    COALESCE(ro.razao_social, ro.nome_fantasia, 'Desconhecido') as recipient_name,
    ce.event_type,
    ce.risk_level,
    ce.file_name,
    COALESCE(p.full_name, 'Usuário') as sender_name,
    ce.was_cancelled,
    ce.user_confirmed
  FROM public.compliance_events ce
  LEFT JOIN public.organizations ro ON ro.id = ce.recipient_organization_id
  LEFT JOIN public.profiles p ON p.user_id = ce.sender_user_id
  WHERE ce.organization_id = v_my_org_id
  ORDER BY ce.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_compliance_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_compliance_events() TO authenticated;


-- ========================================================================================
-- 3. ANÁLISE DE CONTEXTO DO EVENTO (RPC DE AUDITORIA)
-- ========================================================================================

CREATE TABLE IF NOT EXISTS public.compliance_event_audits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid REFERENCES public.compliance_events(id) ON DELETE CASCADE,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    admin_user_id uuid REFERENCES auth.users(id),
    requested_at timestamptz DEFAULT now(),
    result_summary text NOT NULL
);

ALTER TABLE public.compliance_event_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_audits" ON public.compliance_event_audits FOR SELECT TO authenticated
USING (organization_id = public.current_authenticated_organization_id() AND EXISTS (SELECT 1 FROM public.operators WHERE id = auth.uid() AND perfil = 'administrador'));

CREATE OR REPLACE FUNCTION public.analyze_compliance_context(p_event_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_my_org_id uuid;
  v_is_admin boolean;
  v_event public.compliance_events;
  v_summary text;
  v_recipient_name text;
BEGIN
  v_my_org_id := public.current_authenticated_organization_id();
  IF v_my_org_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT (perfil = 'administrador') INTO v_is_admin FROM public.operators WHERE id = auth.uid();
  IF NOT v_is_admin AND NOT public.is_super_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT * INTO v_event FROM public.compliance_events WHERE id = p_event_id AND organization_id = v_my_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;

  SELECT COALESCE(razao_social, nome_fantasia, 'Desconhecido') INTO v_recipient_name FROM public.organizations WHERE id = v_event.recipient_organization_id;

  v_summary := 'Resultado: ';
  IF v_event.was_cancelled THEN
      v_summary := v_summary || 'Nenhum vazamento confirmado.' || E'\nMotivo: O arquivo classificado como ' || upper(v_event.risk_level) || ' (' || COALESCE(v_event.file_name, 'arquivo') || ') teve seu envio cancelado pelo usuário.';
  ELSIF v_event.user_confirmed THEN
      v_summary := v_summary || 'Possível exposição confirmada.' || E'\nMotivo: O usuário confirmou o envio de arquivo classificado como ' || upper(v_event.risk_level) || ' (' || COALESCE(v_event.file_name, 'arquivo') || ') ao parceiro ' || v_recipient_name || '.';
  ELSE
      v_summary := v_summary || 'Situação indeterminada.' || E'\nMotivo: O arquivo classificado como ' || upper(v_event.risk_level) || ' foi processado pelo DLP.';
  END IF;

  v_summary := v_summary || E'\nInformações detectadas: Padrões de risco encontrados: ' || COALESCE(v_event.reasons::text, 'não especificado');

  INSERT INTO public.compliance_event_audits (event_id, conversation_id, organization_id, admin_user_id, result_summary)
  VALUES (p_event_id, v_event.conversation_id, v_my_org_id, auth.uid(), v_summary);

  RETURN v_summary;
END;
$$;
REVOKE ALL ON FUNCTION public.analyze_compliance_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analyze_compliance_context(uuid) TO authenticated;

COMMIT;
