-- ETAPA 3 e 4 — CHAT SEGURO E POLICIES (C1.2)
-- Execute este script no SQL Editor do Supabase de Produção para criar a RPC segura.

-- 1. Cria a RPC get_or_create_partner_conversation com search_path vazio
CREATE OR REPLACE FUNCTION public.get_or_create_partner_conversation(p_partner_organization_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_my_org_id uuid;
    v_is_super_admin boolean;
    v_connection_exists boolean;
    v_conversation_id uuid;
    v_org_a uuid;
    v_org_b uuid;
BEGIN
    -- 1. Identifica o usuário autenticado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
    END IF;

    -- 2. Obtém a organização atual e privilégios do profile
    SELECT organization_id, is_super_admin 
    INTO v_my_org_id, v_is_super_admin
    FROM public.profiles
    WHERE user_id = v_user_id
    LIMIT 1;

    IF v_my_org_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não vinculado a nenhuma organização' USING ERRCODE = '42501';
    END IF;

    -- 3. Validar se o parceiro é diferente de si mesmo
    IF v_my_org_id = p_partner_organization_id THEN
        RAISE EXCEPTION 'Não é possível criar conversa consigo mesmo' USING ERRCODE = '40000';
    END IF;

    -- 4. Validar se existe conexão "accepted" entre as duas empresas bidirecionalmente
    SELECT EXISTS (
        SELECT 1 FROM public.connection_requests
        WHERE status = 'accepted'
          AND (
            (requester_company_id = v_my_org_id AND target_company_id = p_partner_organization_id)
            OR
            (requester_company_id = p_partner_organization_id AND target_company_id = v_my_org_id)
          )
    ) INTO v_connection_exists;

    IF NOT v_connection_exists THEN
        RAISE EXCEPTION 'Não existe parceria ativa entre estas organizações' USING ERRCODE = '40300';
    END IF;

    -- 5. Definir a chave canônica (org menor, org maior) para evitar duplicidades
    IF v_my_org_id < p_partner_organization_id THEN
        v_org_a := v_my_org_id;
        v_org_b := p_partner_organization_id;
    ELSE
        v_org_a := p_partner_organization_id;
        v_org_b := v_my_org_id;
    END IF;

    -- 6. Buscar conversa existente (verificar como está o esquema de conversation, assume-se que as colunas org_a/org_b existam ou participants)
    -- NOTA: O schema exato de conversations depende da auditoria (Etapa 1). 
    -- Assumindo que a tabela conversations tenha as colunas: id, organization_a, organization_b
    SELECT id INTO v_conversation_id
    FROM public.conversations
    WHERE (organization_a = v_org_a AND organization_b = v_org_b)
       OR (organization_a = v_org_b AND organization_b = v_org_a)
    LIMIT 1;

    -- 7. Se não existir, criar a conversa
    IF v_conversation_id IS NULL THEN
        INSERT INTO public.conversations (organization_a, organization_b, created_at)
        VALUES (v_org_a, v_org_b, now())
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$;

-- 8. Permissões estritas da RPC
REVOKE ALL ON FUNCTION public.get_or_create_partner_conversation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_partner_conversation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_partner_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_partner_conversation(uuid) TO service_role;
