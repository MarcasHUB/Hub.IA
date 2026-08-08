-- Migration: update_send_partner_message_rpc
-- Objetivo: Atualizar a RPC send_partner_message para aceitar p_metadata (F.3-B)

-- Dropar a versão antiga que não possui p_metadata
DROP FUNCTION IF EXISTS public.send_partner_message(uuid, text);

-- Criar a nova versão com p_metadata (com suporte a valor padrão nulo para retrocompatibilidade)
CREATE OR REPLACE FUNCTION public.send_partner_message(p_conversation_id uuid, p_content text, p_metadata jsonb DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_my_org_id uuid;
    v_user_id uuid;
    v_profile_id uuid;
    v_message_id uuid;
BEGIN
    v_user_id := auth.uid();
    v_my_org_id := public.current_authenticated_organization_id();

    IF v_user_id IS NULL OR v_my_org_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado ou sem organização' USING ERRCODE = '42501';
    END IF;
    
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

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
        is_system_message,
        metadata
    ) VALUES (
        p_conversation_id,
        v_my_org_id,
        v_profile_id,
        p_content,
        false,
        p_metadata
    )
    RETURNING id INTO v_message_id;

    RETURN v_message_id;
END;
$function$
GRANT EXECUTE ON FUNCTION public.send_partner_message(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_partner_message(uuid, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.send_partner_message(uuid, text, jsonb) FROM PUBLIC;
