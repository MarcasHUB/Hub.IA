-- HOTFIX C1.4.1 — Sincronização em tempo real da inativação de empresas e Validações Backend

-- 1. Habilitar publicação Realtime para a tabela organizations
-- Verifica se a publicação supabase_realtime existe (padrão no Supabase)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    -- Tenta adicionar a tabela organizations à publicação, ignorando se já estiver lá
    ALTER PUBLICATION supabase_realtime ADD TABLE organizations;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Ignora erro se a tabela já estiver na publicação
END
$$;

-- 2. Atualizar RPC accept_company_invitation para bloquear aceite de/para organizações inativas
CREATE OR REPLACE FUNCTION public.accept_company_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_my_org_id uuid;
    v_my_org_status text;
    v_inv_target_document text;
    v_inv_status text;
    v_inv_requester_org_id uuid;
    v_requester_org_status text;
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

    -- Obter o CNPJ e status da organização atual
    SELECT cnpj, status INTO v_my_org_document, v_my_org_status
    FROM public.organizations
    WHERE id = v_my_org_id
    LIMIT 1;

    IF v_my_org_status = 'inativo' THEN
        RAISE EXCEPTION 'Sua organização está inativa. Operação não permitida.' USING ERRCODE = '40300';
    END IF;

    -- 3. Localizar o convite pelo ID e bloquear se não existir
    SELECT document, status, organization_id
    INTO v_inv_target_document, v_inv_status, v_inv_requester_org_id
    FROM public.invitations
    WHERE id = p_invitation_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite não encontrado' USING ERRCODE = '40400';
    END IF;

    -- Obter o status da organização que enviou o convite
    SELECT status INTO v_requester_org_status
    FROM public.organizations
    WHERE id = v_inv_requester_org_id
    LIMIT 1;

    IF v_requester_org_status = 'inativo' THEN
        RAISE EXCEPTION 'A empresa remetente deste convite encontra-se inativa.' USING ERRCODE = '40300';
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
        -- 10. Atualizar connection_requests existente para 'accepted' caso esteja pendente
        UPDATE public.connection_requests
        SET status = 'accepted',
            responded_at = now(),
            responded_by_user_id = v_user_id
        WHERE id = v_connection_id AND status <> 'accepted';
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'connection_id', v_connection_id,
        'message', 'Convite aceito com sucesso'
    );

    RETURN v_result;
END;
$$;
