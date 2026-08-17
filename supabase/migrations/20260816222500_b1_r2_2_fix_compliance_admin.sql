-- Migration: Fix compliance events admin check
-- Uses canonical B1 identity instead of querying operators table directly

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

  SELECT (operator_profile = 'administrador') INTO v_is_admin FROM private.current_identity();
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

  SELECT (operator_profile = 'administrador') INTO v_is_admin FROM private.current_identity();
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

  INSERT INTO public.compliance_event_audits (
      event_id,
      conversation_id,
      organization_id,
      admin_user_id,
      result_summary
  ) VALUES (
      p_event_id,
      v_event.conversation_id,
      v_my_org_id,
      auth.uid(),
      v_summary
  );

  RETURN v_summary;
END;
$$;

REVOKE ALL ON FUNCTION public.analyze_compliance_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analyze_compliance_context(uuid) TO authenticated;
