-- supabase/migrations/20260803_hotfix_b1_3_operator_hard_delete_and_raizen_restore.sql

DO $$
BEGIN
    -- 1. Restaurar os dois operadores ativos da Raízen
    UPDATE public.operators
    SET
      organization_id = '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1',
      status = 'ativo',
      deleted_at = NULL,
      updated_at = now()
    WHERE id IN (
      'f45e8c1b-2c50-4cca-86b3-f14cf45b951b',
      '2b8ac705-c356-430d-9788-0e60e7821724'
    );

    -- Validar a restauração
    IF (
      SELECT count(*)
      FROM public.operators
      WHERE id IN (
        'f45e8c1b-2c50-4cca-86b3-f14cf45b951b',
        '2b8ac705-c356-430d-9788-0e60e7821724'
      )
        AND organization_id = '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1'
        AND status = 'ativo'
        AND deleted_at IS NULL
    ) <> 2 THEN
      RAISE EXCEPTION 'Falha ao restaurar os dois operadores ativos da Raízen';
    END IF;
END $$;

-- 2. Criar função para exclusão definitiva transacional e segura
CREATE OR REPLACE FUNCTION public.delete_operator_permanently(p_operator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id uuid;
    v_caller_org uuid;
    v_caller_super boolean;
    
    v_target_org uuid;
    v_target_profile_org uuid;
    v_target_perfil text;
    v_target_status text;
    
    v_admin_count integer;
    v_protected_adm uuid := '32a5db3a-e0d1-4ed4-aef4-27edf75d817d';
BEGIN
    -- Identificar usuário autenticado
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado. Usuário não autenticado.';
    END IF;

    -- Buscar dados do solicitante
    SELECT organization_id, is_super_admin
    INTO v_caller_org, v_caller_super
    FROM public.profiles
    WHERE user_id = v_caller_id;

    -- Bloquear autoexclusão
    IF p_operator_id = v_caller_id THEN
        RAISE EXCEPTION 'Operação bloqueada: O usuário não pode excluir a si mesmo.';
    END IF;

    -- Bloquear exclusão do ADM GLOBAL protegido
    IF p_operator_id = v_protected_adm THEN
        RAISE EXCEPTION 'Operação bloqueada: Não é permitido excluir o Administrador Global protegido.';
    END IF;

    -- Buscar dados do alvo
    SELECT organization_id, perfil, status
    INTO v_target_org, v_target_perfil, v_target_status
    FROM public.operators
    WHERE id = p_operator_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Operador não encontrado.';
    END IF;

    -- Verificar permissão (mesma organização ou super admin)
    IF v_caller_org <> v_target_org AND v_caller_super IS NOT TRUE THEN
        RAISE EXCEPTION 'Operação bloqueada: Permissão insuficiente para excluir operador de outra organização.';
    END IF;

    -- Bloquear exclusão do último administrador da empresa
    IF v_target_perfil = 'administrador' AND v_target_status = 'ativo' THEN
        SELECT count(*)
        INTO v_admin_count
        FROM public.operators
        WHERE organization_id = v_target_org
          AND perfil = 'administrador'
          AND status = 'ativo'
          AND deleted_at IS NULL;

        IF v_admin_count <= 1 THEN
            RAISE EXCEPTION 'Operação bloqueada: A organização deve possuir ao menos um administrador ativo.';
        END IF;
    END IF;

    -- 1. Tratar Dependências Históricas (NO ACTION na modelagem original)
    -- Remover delegações relacionadas ao operador
    DELETE FROM public.delegations
    WHERE operador_origem_id = p_operator_id
       OR operador_substituto_id = p_operator_id;

    -- 2. Limpar Entidades Públicas e de Relacionamento (Cascade / Set Null fazem o resto)
    -- Apagar profile primeiro (para não violar FK caso exista)
    DELETE FROM public.profiles WHERE user_id = p_operator_id;
    
    -- Apagar operator
    DELETE FROM public.operators WHERE id = p_operator_id;

    -- 3. Limpar Auth (Usuário da Plataforma)
    -- Em PostgreSQL, uma function SECURITY DEFINER rodando no schema public
    -- sendo owner do DB (o que ocorre via Migrations) e com search_path auth,
    -- pode deletar da auth.users.
    DELETE FROM auth.users WHERE id = p_operator_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Operador excluído definitivamente.',
        'operator_id', p_operator_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_operator_permanently(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_operator_permanently(uuid) TO authenticated;
