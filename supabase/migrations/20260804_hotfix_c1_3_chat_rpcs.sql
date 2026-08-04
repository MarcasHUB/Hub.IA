-- HOTFIX C1.3 — Diagnóstico e correção do Chat entre empresas conectadas
-- RPCs transacionais para criação de conversas e envio de mensagens

-- 1. Criação / Busca da Conversa
CREATE OR REPLACE FUNCTION public.get_or_create_partner_conversation(p_partner_organization_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_my_org_id uuid;
    v_conversation_id uuid;
    v_canonical_a uuid;
    v_canonical_b uuid;
BEGIN
    -- Obter a organização atual de forma segura e canônica
    v_my_org_id := public.current_authenticated_organization_id();

    IF v_my_org_id IS NULL THEN
        RAISE EXCEPTION 'Organização não encontrada para o usuário autenticado' USING ERRCODE = '42501';
    END IF;

    IF p_partner_organization_id IS NULL OR v_my_org_id = p_partner_organization_id THEN
        RAISE EXCEPTION 'Parceiro inválido ou autoconexão não permitida' USING ERRCODE = '40000';
    END IF;

    -- Validar se existe parceria ativa
    IF NOT EXISTS (
        SELECT 1
        FROM public.connection_requests cr
        WHERE cr.status = 'accepted'
          AND (
              (cr.requester_company_id = v_my_org_id AND cr.target_company_id = p_partner_organization_id)
              OR
              (cr.requester_company_id = p_partner_organization_id AND cr.target_company_id = v_my_org_id)
          )
    ) THEN
        RAISE EXCEPTION 'Não existe parceria ativa entre as empresas' USING ERRCODE = '40300';
    END IF;

    -- Criar ordem canônica
    IF v_my_org_id < p_partner_organization_id THEN
        v_canonical_a := v_my_org_id;
        v_canonical_b := p_partner_organization_id;
    ELSE
        v_canonical_a := p_partner_organization_id;
        v_canonical_b := v_my_org_id;
    END IF;

    -- Buscar conversa existente
    SELECT id INTO v_conversation_id
    FROM public.conversations
    WHERE organization_a_id = v_canonical_a
      AND organization_b_id = v_canonical_b
    LIMIT 1;

    -- Se não existe, cria
    IF v_conversation_id IS NULL THEN
        INSERT INTO public.conversations (
            organization_a_id,
            organization_b_id,
            company_a_id, -- Retrocompatibilidade, pode ser desativado no futuro
            company_b_id,
            status
        ) VALUES (
            v_canonical_a,
            v_canonical_b,
            v_canonical_a,
            v_canonical_b,
            'ativo'
        )
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$;

-- 2. Envio de Mensagem
CREATE OR REPLACE FUNCTION public.send_partner_message(
    p_conversation_id uuid,
    p_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_my_org_id uuid;
    v_user_id uuid;
    v_message_id uuid;
BEGIN
    v_user_id := auth.uid();
    v_my_org_id := public.current_authenticated_organization_id();

    IF v_user_id IS NULL OR v_my_org_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado ou sem organização' USING ERRCODE = '42501';
    END IF;

    -- Validar que a conversa existe e a organização atual faz parte dela
    IF NOT EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = p_conversation_id
          AND (c.organization_a_id = v_my_org_id OR c.organization_b_id = v_my_org_id)
    ) THEN
        RAISE EXCEPTION 'Conversa inválida ou acesso negado' USING ERRCODE = '40300';
    END IF;

    -- Inserir a mensagem
    INSERT INTO public.messages (
        conversation_id,
        sender_organization_id,
        sender_id,
        content,
        is_system_message
    ) VALUES (
        p_conversation_id,
        v_my_org_id,
        v_user_id,
        p_content,
        false
    )
    RETURNING id INTO v_message_id;

    RETURN v_message_id;
END;
$$;

-- Revogar e Conceder Permissões
REVOKE ALL ON FUNCTION public.get_or_create_partner_conversation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_partner_conversation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_partner_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_partner_conversation(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.send_partner_message(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_partner_message(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_partner_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_partner_message(uuid, text) TO service_role;
