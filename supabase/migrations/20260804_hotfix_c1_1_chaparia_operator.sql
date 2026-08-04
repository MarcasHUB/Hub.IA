DO $$
DECLARE
    v_user_id UUID := 'e34a4a69-2b0f-4ad3-8942-9eb5be752f6c';
    v_org_id UUID := '4e45c319-82d3-4cb7-b5f1-107290445325';
    v_email TEXT := 'viniciuscordebello@hotmail.com';
    v_operator_exists BOOLEAN;
    v_operator_cross_tenant BOOLEAN;
    v_profile_exists BOOLEAN;
BEGIN
    -- 1. Validar se o profile pertence à Chaparia
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = v_user_id AND organization_id = v_org_id
    ) INTO v_profile_exists;

    IF NOT v_profile_exists THEN
        RAISE EXCEPTION 'Profile não existe ou não pertence à organização Chaparia (%).', v_org_id;
    END IF;

    -- 2. Validar cross-tenant
    SELECT EXISTS (
        SELECT 1 FROM public.operators 
        WHERE LOWER(TRIM(email)) = v_email AND organization_id != v_org_id AND status = 'ativo' AND deleted_at IS NULL
    ) INTO v_operator_cross_tenant;

    IF v_operator_cross_tenant THEN
        RAISE EXCEPTION 'Conflito Cross-Tenant: E-mail % já possui operador ativo em outra organização.', v_email;
    END IF;

    -- 3. Inserir Operator se não existir
    SELECT EXISTS (
        SELECT 1 FROM public.operators WHERE id = v_user_id
    ) INTO v_operator_exists;

    IF NOT v_operator_exists THEN
        INSERT INTO public.operators (
            id, organization_id, email, nome, sobrenome, cargo, perfil, status
        ) VALUES (
            v_user_id,
            v_org_id,
            v_email,
            'Vinícius',
            'Cordebello',
            'Administrador Empresarial',
            'administrador',
            'ativo'
        );
    END IF;

    -- 4. Inserir a conexão entre Raízen (9e2e4d9c-...) e Chaparia (4e45c319-...) se não existir
    -- A Raízen é a organizadora
    INSERT INTO public.connection_requests (
        requester_company_id,
        target_company_id,
        status,
        requested_by_user_id
    )
    SELECT 
        '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1'::UUID, 
        v_org_id, 
        'accepted',
        'e34a4a69-2b0f-4ad3-8942-9eb5be752f6c'::UUID
    WHERE NOT EXISTS (
        SELECT 1 FROM public.connection_requests
        WHERE (requester_company_id = '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1'::UUID AND target_company_id = v_org_id)
           OR (requester_company_id = v_org_id AND target_company_id = '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1'::UUID)
    );
END $$;
