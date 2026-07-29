-- Migration: 20260728001200_fix_plpgsql_lint.sql
-- Objetivo:
-- 1. Adicionar invites.updated_at.
-- 2. Corrigir conversão de text para app_role nas funções claim_invite.
-- 3. Eliminar referências ambíguas em create_orc_revision.

BEGIN;

-- ============================================================
-- 1. COLUNA DE ATUALIZAÇÃO DOS CONVITES
-- ============================================================

ALTER TABLE public.invites
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();


-- ============================================================
-- 2. CLAIM INVITE: ASSINATURA (UUID, TEXT)
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_invite(
    p_invite_id UUID,
    p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $func$
DECLARE
    v_invite RECORD;
    v_user_id UUID;
    v_user_email TEXT;
BEGIN
    -- 1. Obtém o usuário autenticado
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION
            'Usuário não autenticado no Supabase Auth.';
    END IF;

    -- 2. Busca e bloqueia o convite
    SELECT i.*
    INTO v_invite
    FROM public.invites AS i
    WHERE i.id = p_invite_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite não encontrado.';
    END IF;

    IF v_invite.status <> 'pending' THEN
        RAISE EXCEPTION
            'Este convite não é mais válido (status: %).',
            v_invite.status;
    END IF;

    -- 3. Valida o e-mail
    SELECT au.email
    INTO v_user_email
    FROM auth.users AS au
    WHERE au.id = v_user_id;

    IF lower(v_user_email) IS DISTINCT FROM lower(v_invite.email) THEN
        RAISE EXCEPTION
            'O email do usuário logado (%) não corresponde ao email do convite (%).',
            v_user_email,
            v_invite.email;
    END IF;

    -- 4. Atualiza ou cria o perfil
    UPDATE public.profiles AS p
    SET
        cnpj = v_invite.cnpj,
        phone = p_phone,
        updated_at = now()
    WHERE p.id = v_user_id;

    IF NOT FOUND THEN
        INSERT INTO public.profiles (
            id,
            full_name,
            cnpj,
            phone,
            status,
            is_super_admin
        )
        VALUES (
            v_user_id,
            (
                SELECT au.raw_user_meta_data ->> 'full_name'
                FROM auth.users AS au
                WHERE au.id = v_user_id
            ),
            v_invite.cnpj,
            p_phone,
            'active',
            false
        );
    END IF;

    -- 5. Registra a role
    DELETE FROM public.user_roles AS ur
    WHERE ur.user_id = v_user_id;

    INSERT INTO public.user_roles (
        user_id,
        role
    )
    VALUES (
        v_user_id,
        v_invite.role::public.app_role
    );

    -- 6. Finaliza o convite
    UPDATE public.invites AS i
    SET
        status = 'accepted',
        updated_at = now()
    WHERE i.id = p_invite_id;

    RETURN jsonb_build_object(
        'success', true,
        'cnpj', v_invite.cnpj,
        'role', v_invite.role
    );
END;
$func$;

ALTER FUNCTION public.claim_invite(UUID, TEXT)
OWNER TO postgres;


-- ============================================================
-- 3. CLAIM INVITE: ASSINATURA (UUID, UUID)
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_invite(
    p_invite_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $func$
DECLARE
    v_invite RECORD;
BEGIN
    SELECT i.*
    INTO v_invite
    FROM public.invites AS i
    WHERE i.id = p_invite_id
      AND i.status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'error',
            'Convite inválido ou já processado.'
        );
    END IF;

    UPDATE public.invites AS i
    SET
        status = 'accepted',
        updated_at = now()
    WHERE i.id = p_invite_id;

    DELETE FROM public.user_roles AS ur
    WHERE ur.user_id = p_user_id;

    INSERT INTO public.user_roles (
        user_id,
        role
    )
    VALUES (
        p_user_id,
        v_invite.role::public.app_role
    );

    UPDATE public.profiles AS p
    SET
        cnpj = v_invite.cnpj,
        status = 'active'
    WHERE p.id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'cnpj', v_invite.cnpj
    );
END;
$func$;

ALTER FUNCTION public.claim_invite(UUID, UUID)
OWNER TO postgres;


-- ============================================================
-- 4. CREATE ORC REVISION
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_orc_revision(
    p_quotation_id UUID
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    status public.quotation_status,
    created_at TIMESTAMPTZ,
    organization_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $func$
DECLARE
    v_org UUID := public.current_org_id();
    v_user UUID := auth.uid();
    v_target public.quotation_requests%ROWTYPE;
    v_root_title TEXT;
    v_head public.quotation_requests%ROWTYPE;
    v_next_rev INT;
    v_new_title TEXT;
    v_new public.quotation_requests%ROWTYPE;
BEGIN
    IF v_org IS NULL THEN
        RAISE EXCEPTION
            'Usuário não pertence a uma organização.';
    END IF;

    -- Busca o orçamento solicitado
    SELECT qr.*
    INTO v_target
    FROM public.quotation_requests AS qr
    WHERE qr.id = p_quotation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orçamento não encontrado.';
    END IF;

    IF v_target.organization_id <> v_org THEN
        RAISE EXCEPTION
            'Orçamento pertence a outra organização.';
    END IF;

    IF v_target.status IN (
        'draft'::public.quotation_status,
        'cancelled'::public.quotation_status,
        'closed'::public.quotation_status
    ) THEN
        RAISE EXCEPTION
            'Não é possível criar revisão de um orçamento com status %.',
            v_target.status;
    END IF;

    v_root_title :=
        regexp_replace(
            v_target.title,
            '\.rev[0-9]+$',
            ''
        );

    -- Localiza a revisão mais recente
    SELECT qr.*
    INTO v_head
    FROM public.quotation_requests AS qr
    WHERE qr.organization_id = v_org
      AND (
          qr.title = v_root_title
          OR qr.title ~ (
              '^'
              || regexp_replace(
                  v_root_title,
                  '([\\.\+\*\?\(\)\[\]\{\}\|\^\$])',
                  '\\\1',
                  'g'
              )
              || '\.rev[0-9]+$'
          )
      )
    ORDER BY
        CASE
            WHEN qr.title = v_root_title THEN 0
            ELSE (
                regexp_replace(
                    qr.title,
                    '^.*\.rev([0-9]+)$',
                    '\1'
                )
            )::INT
        END DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Não foi possível localizar a revisão atual do orçamento.';
    END IF;

    IF v_head.id <> p_quotation_id THEN
        RAISE EXCEPTION
            'Este orçamento já foi substituído por uma revisão mais recente.';
    END IF;

    IF v_head.title = v_root_title THEN
        v_next_rev := 1;
    ELSE
        v_next_rev :=
            (
                regexp_replace(
                    v_head.title,
                    '^.*\.rev([0-9]+)$',
                    '\1'
                )
            )::INT + 1;
    END IF;

    v_new_title :=
        v_root_title || '.rev' || v_next_rev::TEXT;

    -- Cria a nova revisão
    INSERT INTO public.quotation_requests (
        organization_id,
        title,
        status,
        notes,
        due_date,
        priority_level,
        created_by
    )
    VALUES (
        v_org,
        v_new_title,
        'draft'::public.quotation_status,
        v_head.notes,
        v_head.due_date,
        v_head.priority_level,
        v_user
    )
    RETURNING *
    INTO v_new;

    -- Copia os itens
    INSERT INTO public.quotation_items (
        request_id,
        product_id,
        quantity,
        unit
    )
    SELECT
        v_new.id,
        qi.product_id,
        qi.quantity,
        qi.unit
    FROM public.quotation_items AS qi
    WHERE qi.request_id = v_head.id;

    -- Cancela a revisão anterior
    UPDATE public.quotation_requests AS qr
    SET
        status = 'cancelled'::public.quotation_status,
        updated_at = now()
    WHERE qr.id = v_head.id;

    -- Auditoria
    PERFORM public.insert_audit_log(
        'quotation_superseded',
        'quotation_request',
        v_head.id,
        jsonb_build_object(
            'superseded_by_id', v_new.id,
            'superseded_by_title', v_new.title,
            'previous_title', v_head.title
        ),
        v_org
    );

    PERFORM public.insert_audit_log(
        'quotation_revision_created',
        'quotation_request',
        v_new.id,
        jsonb_build_object(
            'supersedes_id', v_head.id,
            'supersedes_title', v_head.title,
            'title', v_new.title,
            'revision', v_next_rev
        ),
        v_org
    );

    RETURN QUERY
    SELECT
        v_new.id,
        v_new.title,
        v_new.status,
        v_new.created_at,
        v_new.organization_id;
END;
$func$;

ALTER FUNCTION public.create_orc_revision(UUID)
OWNER TO postgres;

COMMIT;