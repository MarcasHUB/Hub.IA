-- Migration: supabase/migrations/20260803160941_fase_b1_identity_organization_alignment.sql
-- Fase B1 - Correção Real da Identidade Organizacional

DO $$
DECLARE
    hub_id UUID := '68a2f0b2-80f7-4868-bbb9-30b531c12db2';
    raizen_id UUID := '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1';
    
    user_adm UUID := '32a5db3a-e0d1-4ed4-aef4-27edf75d817d';
    user_everton UUID := 'f45e8c1b-2c50-4cca-86b3-f14cf45b951b';
    user_icloud UUID := '2b8ac705-c356-430d-9788-0e60e7821724';
BEGIN
    -- 1. VALIDAÇÃO DE PREEXISTÊNCIA
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = hub_id) THEN
        RAISE EXCEPTION 'Assertion Falhou: Organização Hub.IA (%) não encontrada.', hub_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = raizen_id) THEN
        RAISE EXCEPTION 'Assertion Falhou: Organização Raízen Canônica (%) não encontrada.', raizen_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_adm) THEN
        RAISE EXCEPTION 'Assertion Falhou: ADM GLOBAL (%) não encontrado em auth.users.', user_adm;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_everton) THEN
        RAISE EXCEPTION 'Assertion Falhou: Administrador Raízen (%) não encontrado em auth.users.', user_everton;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_icloud) THEN
        RAISE EXCEPTION 'Assertion Falhou: Usuário iCloud (%) não encontrado em auth.users.', user_icloud;
    END IF;

    -- 2. HUB.IA INTERNA
    UPDATE public.organizations
    SET
      is_platform_internal = true,
      updated_at = now()
    WHERE id = hub_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assertion Pós-Update Falhou: Hub.IA não foi atualizada.';
    END IF;

    -- 3. ADM GLOBAL (Vinícius Gmail)
    UPDATE public.profiles
    SET
      organization_id = hub_id,
      is_super_admin = true,
      updated_at = now()
    WHERE user_id = user_adm;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assertion Falhou: profile do ADM GLOBAL não atualizado.'; END IF;

    UPDATE public.operators
    SET
      organization_id = hub_id,
      perfil = 'administrador',
      status = 'ativo',
      updated_at = now()
    WHERE id = user_adm;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assertion Falhou: operator do ADM GLOBAL não atualizado.'; END IF;

    -- 4. Administrador Raízen (Everton)
    UPDATE public.profiles
    SET
      organization_id = raizen_id,
      is_super_admin = false,
      updated_at = now()
    WHERE user_id = user_everton;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assertion Falhou: profile do Everton não atualizado.'; END IF;

    UPDATE public.operators
    SET
      organization_id = raizen_id,
      perfil = 'administrador',
      status = 'ativo',
      updated_at = now()
    WHERE id = user_everton;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assertion Falhou: operator do Everton não atualizado.'; END IF;

    -- 5. Usuário Secundário (Vinícius iCloud)
    UPDATE public.profiles
    SET
      organization_id = raizen_id,
      is_super_admin = false,
      updated_at = now()
    WHERE user_id = user_icloud;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assertion Falhou: profile do usuário iCloud não atualizado.'; END IF;

    UPDATE public.operators
    SET
      organization_id = raizen_id,
      -- ATENÇÃO: 'auditor' não existe no ENUM operator_perfil. Ajustar antes de executar!
      perfil = 'auditor', 
      status = 'ativo',
      updated_at = now()
    WHERE id = user_icloud;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assertion Falhou: operator do usuário iCloud não atualizado.'; END IF;

END $$;
