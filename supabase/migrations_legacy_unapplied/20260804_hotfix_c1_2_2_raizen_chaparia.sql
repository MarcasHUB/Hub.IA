-- HOTFIX C1.2.2 — Saneamento Pontual Raízen × Chaparia

DO $$
DECLARE
    v_raizen_id uuid := '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1';
    v_chaparia_id uuid := '4e45c319-82d3-4cb7-b5f1-107290445325';
    v_raizen_exists boolean;
    v_chaparia_exists boolean;
    v_invitation_exists boolean;
BEGIN
    -- 1. Confirmar que ambas as organizações existem
    SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_raizen_id) INTO v_raizen_exists;
    SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_chaparia_id) INTO v_chaparia_exists;

    IF NOT (v_raizen_exists AND v_chaparia_exists) THEN
        RAISE NOTICE 'Organizações Raízen ou Chaparia não encontradas. Abortando Saneamento.';
        RETURN;
    END IF;

    -- 2. Confirmar que o convite empresarial correspondente está aceito (se existir, no histórico)
    -- Opcional para prosseguir: vamos criar a connection de qualquer forma para estabilizar.
    SELECT EXISTS (
        SELECT 1 FROM public.invitations
        WHERE (organization_id = v_raizen_id AND document = (SELECT cnpj FROM public.organizations WHERE id = v_chaparia_id))
           OR (organization_id = v_chaparia_id AND document = (SELECT cnpj FROM public.organizations WHERE id = v_raizen_id))
    ) INTO v_invitation_exists;

    -- 3. Criar somente uma linha em connection_requests se não existir em nenhuma direção
    IF NOT EXISTS (
        SELECT 1 FROM public.connection_requests
        WHERE (requester_company_id = v_raizen_id AND target_company_id = v_chaparia_id)
           OR (requester_company_id = v_chaparia_id AND target_company_id = v_raizen_id)
    ) THEN
        INSERT INTO public.connection_requests (
            requester_company_id,
            target_company_id,
            status,
            responded_at,
            created_at,
            updated_at
        ) VALUES (
            v_raizen_id,
            v_chaparia_id,
            'accepted',
            now(),
            now(),
            now()
        );
        RAISE NOTICE 'Vínculo Raízen × Chaparia criado em connection_requests.';
    ELSE
        -- Garantir que está aceito
        UPDATE public.connection_requests
        SET status = 'accepted', updated_at = now()
        WHERE (
            (requester_company_id = v_raizen_id AND target_company_id = v_chaparia_id)
            OR (requester_company_id = v_chaparia_id AND target_company_id = v_raizen_id)
        ) AND status <> 'accepted';
        
        RAISE NOTICE 'Vínculo Raízen × Chaparia já existia e foi confirmado como accepted.';
    END IF;

END;
$$;
