-- HOTFIX C1.2.4 — Reapontamento das FKs de connection_requests para organizations

DO $$
BEGIN
  -- 1. Auditoria pré-migration: Validar se existem IDs que não estão em organizations
  IF EXISTS (
    SELECT 1
    FROM public.connection_requests cr
    LEFT JOIN public.organizations o
      ON o.id = cr.requester_company_id
    WHERE o.id IS NULL
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOQUEADA: Existem requester_company_id sem correspondência em organizations. Saneamento manual necessário.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.connection_requests cr
    LEFT JOIN public.organizations o
      ON o.id = cr.target_company_id
    WHERE o.id IS NULL
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOQUEADA: Existem target_company_id sem correspondência em organizations. Saneamento manual necessário.';
  END IF;
END $$;

-- 2. Troca das constraints (remoção das atuais)
ALTER TABLE public.connection_requests
  DROP CONSTRAINT IF EXISTS connection_requests_requester_company_id_fkey;

ALTER TABLE public.connection_requests
  DROP CONSTRAINT IF EXISTS connection_requests_target_company_id_fkey;

-- 3. Criação das novas constraints apontando para organizations
ALTER TABLE public.connection_requests
  ADD CONSTRAINT connection_requests_requester_company_id_fkey
  FOREIGN KEY (requester_company_id)
  REFERENCES public.organizations(id)
  ON DELETE CASCADE;

ALTER TABLE public.connection_requests
  ADD CONSTRAINT connection_requests_target_company_id_fkey
  FOREIGN KEY (target_company_id)
  REFERENCES public.organizations(id)
  ON DELETE CASCADE;

DO $$
DECLARE
    v_fk1_exists boolean;
    v_fk2_exists boolean;
BEGIN
  -- 4. Assertions pós-migration
  -- Verificar se as FKs apontam para organizations
  SELECT EXISTS (
      SELECT 1 
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc 
        ON kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'connection_requests'
        AND kcu.column_name = 'requester_company_id'
        AND ccu.table_name = 'organizations'
        AND tc.constraint_type = 'FOREIGN KEY'
  ) INTO v_fk1_exists;

  SELECT EXISTS (
      SELECT 1 
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc 
        ON kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'connection_requests'
        AND kcu.column_name = 'target_company_id'
        AND ccu.table_name = 'organizations'
        AND tc.constraint_type = 'FOREIGN KEY'
  ) INTO v_fk2_exists;

  IF NOT v_fk1_exists OR NOT v_fk2_exists THEN
      RAISE EXCEPTION 'MIGRATION FALHOU: As FKs não foram criadas apontando para organizations.';
  END IF;
END $$;

-- 5. Aplicação do saneamento Raízen × Chaparia
DO $$
DECLARE
    v_raizen_id uuid := '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1';
    v_chaparia_id uuid := '4e45c319-82d3-4cb7-b5f1-107290445325';
    v_raizen_exists boolean;
    v_chaparia_exists boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_raizen_id) INTO v_raizen_exists;
    SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_chaparia_id) INTO v_chaparia_exists;

    IF NOT (v_raizen_exists AND v_chaparia_exists) THEN
        RAISE NOTICE 'Organizações Raízen ou Chaparia não encontradas. Abortando Saneamento.';
        RETURN;
    END IF;

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
    ELSE
        UPDATE public.connection_requests
        SET status = 'accepted', updated_at = now()
        WHERE (
            (requester_company_id = v_raizen_id AND target_company_id = v_chaparia_id)
            OR (requester_company_id = v_chaparia_id AND target_company_id = v_raizen_id)
        ) AND status <> 'accepted';
    END IF;
END;
$$;
