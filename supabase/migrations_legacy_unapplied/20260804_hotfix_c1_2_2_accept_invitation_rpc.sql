-- HOTFIX C1.2.2 — Consolidação Transacional do Aceite de Conexão (RPC)

CREATE OR REPLACE FUNCTION public.accept_company_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_my_org_id uuid;
    v_inv_target_document text;
    v_inv_status text;
    v_inv_requester_org_id uuid;
    v_my_org_document text;
    v_connection_id uuid;
    v_result jsonb;
BEGIN
    -- 1. Obter o usuário autenticado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
    END IF;

    -- 2. Localizar o tenant do usuário autenticado
    SELECT organization_id 
    INTO v_my_org_id
    FROM public.profiles
    WHERE user_id = v_user_id
    LIMIT 1;

    IF v_my_org_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não vinculado a nenhuma organização' USING ERRCODE = '42501';
    END IF;

    -- Obter o CNPJ/Documento da organização atual
    SELECT cnpj INTO v_my_org_document
    FROM public.organizations
    WHERE id = v_my_org_id
    LIMIT 1;

    -- 3. Localizar o convite pelo ID e bloquear se não existir
    SELECT document, status, organization_id
    INTO v_inv_target_document, v_inv_status, v_inv_requester_org_id
    FROM public.invitations
    WHERE id = p_invitation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite não encontrado' USING ERRCODE = '40400';
    END IF;

    -- 4. Validar se a empresa alvo do convite é de fato a empresa do usuário logado
    IF v_my_org_document IS NULL OR v_inv_target_document IS NULL OR v_my_org_document <> v_inv_target_document THEN
        RAISE EXCEPTION 'Convite não pertence à sua organização' USING ERRCODE = '40300';
    END IF;

    -- 5. Bloquear convite já cancelado ou recusado
    IF v_inv_status IN ('cancelado', 'recusado') THEN
        RAISE EXCEPTION 'O convite já foi %', v_inv_status USING ERRCODE = '40000';
    END IF;

    -- 6. Impedir conexão da empresa consigo mesma
    IF v_inv_requester_org_id = v_my_org_id THEN
        RAISE EXCEPTION 'Não é possível conectar com a própria empresa' USING ERRCODE = '40000';
    END IF;

    -- 7. Atualizar convite para 'aceito' e registrar a data (Idempotente)
    IF v_inv_status <> 'aceito' THEN
        UPDATE public.invitations
        SET status = 'aceito',
            updated_at = now()
        WHERE id = p_invitation_id;
    END IF;

    -- 8. Verificar se já existe vínculo na tabela connection_requests
    SELECT id INTO v_connection_id
    FROM public.connection_requests
    WHERE (requester_company_id = v_inv_requester_org_id AND target_company_id = v_my_org_id)
       OR (requester_company_id = v_my_org_id AND target_company_id = v_inv_requester_org_id)
    LIMIT 1;

    -- 9. Criar linha única em connection_requests se não existir
    IF v_connection_id IS NULL THEN
        INSERT INTO public.connection_requests (
            requester_company_id,
            target_company_id,
            requested_by_user_id,
            responded_by_user_id,
            responded_at,
            status
        ) VALUES (
            v_inv_requester_org_id,
            v_my_org_id,
            NULL, -- ou do convite, caso exista
            v_user_id,
            now(),
            'accepted'
        )
        RETURNING id INTO v_connection_id;
    ELSE
        -- Se já existe mas porventura estiver recusado/pendente, atualiza
        UPDATE public.connection_requests
        SET status = 'accepted',
            responded_by_user_id = v_user_id,
            responded_at = now()
        WHERE id = v_connection_id AND status <> 'accepted';
    END IF;

    -- 10. Construir JSON de resposta
    v_result := jsonb_build_object(
        'success', true,
        'invitation_id', p_invitation_id,
        'connection_request_id', v_connection_id,
        'requester_company_id', v_inv_requester_org_id,
        'target_company_id', v_my_org_id,
        'status', 'accepted'
    );

    RETURN v_result;
END;
$$;

-- 11. Revogar/Conceder Permissões
REVOKE ALL ON FUNCTION public.accept_company_invitation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_company_invitation(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.accept_company_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_company_invitation(uuid) TO service_role;
