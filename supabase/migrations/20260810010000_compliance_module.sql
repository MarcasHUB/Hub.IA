-- Migration: compliance_module
-- Objetivo: F.5B e F.5C Compliance Corporativo (Arquitetura)

-- 1. Helper function para checagem de Admin/Auditor
CREATE OR REPLACE FUNCTION public.is_compliance_auditor_or_admin(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.operators o
      JOIN public.profiles p
        ON lower(p.email) = lower(o.email)
       AND p.organization_id = o.organization_id
      WHERE p.user_id = auth.uid()
        AND o.organization_id = _org_id
        AND o.perfil IN ('administrador', 'auditor')
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = _org_id
        AND ur.role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_compliance_auditor_or_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_compliance_auditor_or_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_compliance_auditor_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_compliance_auditor_or_admin(uuid) TO service_role;

-- 2. Tabela compliance_events
CREATE TABLE public.compliance_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES public.organizations(id) NOT NULL,
    conversation_id uuid REFERENCES public.conversations(id) NOT NULL,
    message_id uuid REFERENCES public.messages(id),
    sender_user_id uuid REFERENCES public.profiles(user_id) NOT NULL,
    sender_organization_id uuid REFERENCES public.organizations(id) NOT NULL,
    recipient_organization_id uuid REFERENCES public.organizations(id) NOT NULL,
    event_type text NOT NULL,
    risk_level text NOT NULL DEFAULT 'low',
    risk_score integer NOT NULL DEFAULT 0,
    detection_source text DEFAULT 'client_heuristic',
    file_name text,
    mime_type text,
    user_warned boolean DEFAULT false,
    user_confirmed boolean DEFAULT false,
    was_cancelled boolean DEFAULT false,
    is_blocked boolean DEFAULT false,
    reasons jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    reviewed_by uuid REFERENCES public.profiles(user_id),
    
    CONSTRAINT ce_risk_score_check CHECK (risk_score >= 0 AND risk_score <= 100),
    CONSTRAINT ce_risk_level_check CHECK (risk_level IN ('low', 'medium', 'high')),
    CONSTRAINT ce_event_type_check CHECK (event_type IN ('attachment_flagged', 'upload_cancelled'))
);

CREATE INDEX idx_compliance_events_org ON public.compliance_events(organization_id);
CREATE INDEX idx_compliance_events_org_created ON public.compliance_events(organization_id, created_at DESC);
CREATE INDEX idx_compliance_events_org_risk_created ON public.compliance_events(organization_id, risk_level, created_at DESC);
CREATE INDEX idx_compliance_events_conversation ON public.compliance_events(conversation_id);

ALTER TABLE public.compliance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_compliance_access_admin_auditor" ON public.compliance_events
FOR SELECT TO authenticated
USING (public.is_compliance_auditor_or_admin(organization_id));

-- Nenhuma policy de INSERT, UPDATE ou DELETE para authenticated users. Escrita server-side.

-- 3. Função para cancelar anexo suspeito (Cancelamento no Pre-flight)
CREATE OR REPLACE FUNCTION public.register_compliance_cancelled_event(
  p_conversation_id uuid,
  p_file_name text,
  p_mime_type text,
  p_risk_score integer,
  p_risk_level text,
  p_reasons jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_my_org_id uuid;
  v_profile_id uuid;
  v_recipient_org_id uuid;
  v_event_id uuid;
BEGIN
  v_user_id := auth.uid();
  v_my_org_id := public.current_authenticated_organization_id();

  IF v_user_id IS NULL OR v_my_org_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado ou sem organização' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  -- Obter a organização destinatária validando a conversa
  SELECT 
    CASE WHEN organization_a_id = v_my_org_id THEN organization_b_id ELSE organization_a_id END
  INTO v_recipient_org_id
  FROM public.conversations
  WHERE id = p_conversation_id
    AND (organization_a_id = v_my_org_id OR organization_b_id = v_my_org_id);

  IF v_recipient_org_id IS NULL THEN
    RAISE EXCEPTION 'Conversa inválida ou acesso negado' USING ERRCODE = '40300';
  END IF;

  -- Criar o evento associado à organização do usuário remetente
  INSERT INTO public.compliance_events (
    organization_id,
    conversation_id,
    message_id,
    sender_user_id,
    sender_organization_id,
    recipient_organization_id,
    event_type,
    risk_level,
    risk_score,
    file_name,
    mime_type,
    user_warned,
    user_confirmed,
    was_cancelled,
    is_blocked,
    reasons
  ) VALUES (
    v_my_org_id,
    p_conversation_id,
    NULL,
    v_user_id,
    v_my_org_id,
    v_recipient_org_id,
    'upload_cancelled',
    p_risk_level,
    p_risk_score,
    p_file_name,
    p_mime_type,
    TRUE,
    FALSE,
    TRUE,
    FALSE,
    p_reasons
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_compliance_cancelled_event(uuid, text, text, integer, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_compliance_cancelled_event(uuid, text, text, integer, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_compliance_cancelled_event(uuid, text, text, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_compliance_cancelled_event(uuid, text, text, integer, text, jsonb) TO service_role;

-- 4. Substituição do send_partner_message

CREATE OR REPLACE FUNCTION public.send_partner_message(
    p_conversation_id uuid, 
    p_content text, 
    p_metadata jsonb DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $$
DECLARE
    v_my_org_id uuid;
    v_user_id uuid;
    v_profile_id uuid;
    v_message_id uuid;
    v_recipient_org_id uuid;
    
    -- DLP Flags
    v_is_attachment boolean := FALSE;
    v_flagged boolean := FALSE;
    v_risk_score integer := 0;
    v_risk_level text := 'low';
    v_dlp_status text := 'pending';
    v_reasons jsonb := '[]'::jsonb;
    v_file_name text := NULL;
    v_mime_type text := NULL;
    v_user_confirmed boolean := FALSE;
BEGIN
    v_user_id := auth.uid();
    v_my_org_id := public.current_authenticated_organization_id();

    IF v_user_id IS NULL OR v_my_org_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado ou sem organização' USING ERRCODE = '42501';
    END IF;
    
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

    -- Validar que a conversa existe e a organização atual faz parte dela
    SELECT 
      CASE WHEN organization_a_id = v_my_org_id THEN organization_b_id ELSE organization_a_id END
    INTO v_recipient_org_id
    FROM public.conversations
    WHERE id = p_conversation_id
      AND (organization_a_id = v_my_org_id OR organization_b_id = v_my_org_id);

    IF v_recipient_org_id IS NULL THEN
        RAISE EXCEPTION 'Conversa inválida ou acesso negado' USING ERRCODE = '40300';
    END IF;

    -- Extrair DLP data do metadata
    IF p_metadata IS NOT NULL THEN
      IF (p_metadata->>'type') = 'attachment' THEN
        v_is_attachment := TRUE;
        v_file_name := p_metadata->'attachment'->>'name';
        v_mime_type := p_metadata->'attachment'->>'mimeType';
        
        IF p_metadata ? 'compliance' THEN
          v_flagged := lower(COALESCE(p_metadata->'compliance'->>'flagged', 'false')) = 'true';
          v_user_confirmed := lower(COALESCE(p_metadata->'compliance'->>'userConfirmed', 'false')) = 'true';

          -- Normalize risk_score
          BEGIN
            v_risk_score := (p_metadata->'compliance'->>'riskScore')::integer;
            IF v_risk_score < 0 THEN v_risk_score := 0; END IF;
            IF v_risk_score > 100 THEN v_risk_score := 100; END IF;
          EXCEPTION WHEN OTHERS THEN
            v_risk_score := 0;
          END;

          -- Normalize risk_level
          v_risk_level := lower(COALESCE(p_metadata->'compliance'->>'riskLevel', 'low'));
          IF v_risk_level NOT IN ('low', 'medium', 'high') THEN
            v_risk_level := 'low';
          END IF;

          -- Normalize reasons
          IF jsonb_typeof(p_metadata->'compliance'->'reasons') = 'array' THEN
            v_reasons := p_metadata->'compliance'->'reasons';
          ELSE
            v_reasons := '[]'::jsonb;
          END IF;
          
          IF v_flagged THEN
            IF NOT v_user_confirmed THEN
              RAISE EXCEPTION 'Envio de arquivo sensível requer confirmação do usuário' USING ERRCODE = 'P0001';
            END IF;
            v_dlp_status := 'client_flagged';
          ELSE
            v_dlp_status := 'client_checked';
          END IF;
        END IF;
      END IF;
    END IF;

    -- Inserir a mensagem
    INSERT INTO public.messages (
        conversation_id,
        sender_organization_id,
        sender_id,
        content,
        is_system_message,
        metadata,
        dlp_status,
        risk_score,
        is_blocked
    ) VALUES (
        p_conversation_id,
        v_my_org_id,
        v_profile_id,
        p_content,
        false,
        p_metadata,
        v_dlp_status,
        v_risk_score,
        false
    )
    RETURNING id INTO v_message_id;

    -- Se for anexo sensível, gerar evento analítico na mesma transação
    IF v_flagged THEN
      INSERT INTO public.compliance_events (
        organization_id,
        conversation_id,
        message_id,
        sender_user_id,
        sender_organization_id,
        recipient_organization_id,
        event_type,
        risk_level,
        risk_score,
        file_name,
        mime_type,
        user_warned,
        user_confirmed,
        was_cancelled,
        is_blocked,
        reasons
      ) VALUES (
        v_my_org_id,
        p_conversation_id,
        v_message_id,
        v_user_id,
        v_my_org_id,
        v_recipient_org_id,
        'attachment_flagged',
        v_risk_level,
        v_risk_score,
        v_file_name,
        v_mime_type,
        TRUE,
        v_user_confirmed,
        FALSE,
        FALSE,
        v_reasons
      );
    END IF;

    RETURN v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_partner_message(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_partner_message(uuid, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.send_partner_message(uuid, text, jsonb) FROM PUBLIC;
