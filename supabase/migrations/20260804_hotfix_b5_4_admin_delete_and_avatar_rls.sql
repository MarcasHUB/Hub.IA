-- HOTFIX B5.4: PERMISSÃO DE EXCLUSÃO POR ADMINISTRADORES E CORREÇÃO DE RLS DO AVATAR

-- 1. CORREÇÃO DE RLS DO PROFILE
-- Drop existing flawed policies
DROP POLICY IF EXISTS "users_update_policy" ON "public"."profiles";
DROP POLICY IF EXISTS "profiles_update_self" ON "public"."profiles";

-- Create functional policy for updating personal data
CREATE POLICY "profiles_update_own_data" ON "public"."profiles" 
FOR UPDATE TO "authenticated" 
USING ("user_id" = "auth"."uid"()) 
WITH CHECK ("user_id" = "auth"."uid"());

-- 2. CORREÇÃO DA RPC DE EXCLUSÃO DE OPERADORES
CREATE OR REPLACE FUNCTION public.delete_operator_permanently(p_operator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id uuid;
    v_caller_org uuid;
    v_caller_super boolean;
    v_caller_perfil text;
    v_caller_status text;
    
    v_target_org uuid;
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

    -- Buscar dados do solicitante em profiles
    SELECT organization_id, is_super_admin
    INTO v_caller_org, v_caller_super
    FROM public.profiles
    WHERE user_id = v_caller_id;

    -- Buscar perfil do solicitante em operators
    SELECT perfil, status
    INTO v_caller_perfil, v_caller_status
    FROM public.operators
    WHERE id = v_caller_id AND deleted_at IS NULL;

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

    -- Verificar permissões
    -- Pode excluir se for SUPER ADMIN GLOBAL ou ADMINISTRADOR da própria empresa ativo
    IF v_caller_super IS TRUE THEN
        -- Permitido (ADM GLOBAL)
        NULL;
    ELSIF v_caller_org = v_target_org AND v_caller_perfil = 'administrador' AND v_caller_status = 'ativo' THEN
        -- Permitido (Administrador da mesma empresa)
        NULL;
    ELSE
        RAISE EXCEPTION 'Operação bloqueada: Permissão insuficiente para excluir operador. Apenas ADM GLOBAL ou administrador da empresa podem realizar esta ação.';
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

    -- Tratar Dependências Históricas
    DELETE FROM public.delegations
    WHERE operador_origem_id = p_operator_id
       OR operador_substituto_id = p_operator_id;

    -- Limpar Entidades Públicas e de Relacionamento
    DELETE FROM public.profiles WHERE user_id = p_operator_id;
    DELETE FROM public.operators WHERE id = p_operator_id;

    -- Limpar Auth (Usuário da Plataforma)
    DELETE FROM auth.users WHERE id = p_operator_id;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'message', 'Operador excluído definitivamente.',
        'operator_id', p_operator_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_operator_permanently(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_operator_permanently(uuid) TO authenticated;
