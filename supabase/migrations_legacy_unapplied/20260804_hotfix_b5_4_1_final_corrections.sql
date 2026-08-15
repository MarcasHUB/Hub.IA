-- HOTFIX B5.4.1: CORREÇÃO FINAL DE PROFILE E AUTORIZAÇÃO

-- Criar RPC segura para atualizar perfil pessoal
CREATE OR REPLACE FUNCTION public.update_my_profile(
    p_full_name text,
    p_display_name text,
    p_phone text,
    p_job_title text,
    p_department text,
    p_avatar_url text
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_updated_profile public.profiles;
BEGIN
    -- Identificar o usuário que está fazendo a requisição
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado. Usuário não autenticado.';
    END IF;

    -- Executar UPDATE protegido
    UPDATE public.profiles
    SET 
        full_name = p_full_name,
        display_name = p_display_name,
        phone = p_phone,
        job_title = p_job_title,
        department = p_department,
        avatar_url = p_avatar_url,
        updated_at = pg_catalog.now()
    WHERE user_id = v_user_id
    RETURNING * INTO v_updated_profile;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Perfil não encontrado.';
    END IF;

    RETURN v_updated_profile;
END;
$$;

-- Restringir permissões para segurança
REVOKE ALL ON FUNCTION public.update_my_profile(text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_profile(text, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text, text, text) TO authenticated;
