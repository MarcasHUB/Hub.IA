-- HOTFIX C1.2.5 — Limpeza explícita dos registros legados de teste e retomada da consolidação das FKs

DO $$
DECLARE
    v_id1 uuid := 'b4086c54-1856-4ef5-ab86-bc74836cc93a';
    v_id2 uuid := '01b14e63-3011-4692-a6a1-7e79bf9a9962';
    v_req1 uuid := '4cc68933-38f1-4ca4-8b9e-1eb6d1cb5b59';
    v_tgt1 uuid := '679ebd28-b627-42ef-8ca3-4574eb966409';
    v_req2 uuid := '26bf2355-0535-4b83-9188-f3536c52e434';
    v_tgt2 uuid := '26bf2355-0535-4b83-9188-f3536c52e434';
    v_dependents int;
BEGIN
    -- 1. Validar a existência exata e os pares correspondentes
    IF EXISTS (
        SELECT 1 FROM public.connection_requests
        WHERE id = v_id1 AND (requester_company_id <> v_req1 OR target_company_id <> v_tgt1)
    ) THEN
        RAISE EXCEPTION 'Registro 1 existe mas o par de empresas difere do esperado.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.connection_requests
        WHERE id = v_id2 AND (requester_company_id <> v_req2 OR target_company_id <> v_tgt2)
    ) THEN
        RAISE EXCEPTION 'Registro 2 existe mas o par de empresas difere do esperado (autoconexão).';
    END IF;

    -- 2. Auditar dependências antes da exclusão
    -- Verificando se existe alguma FK apontando para connection_requests.id
    SELECT count(*)
    INTO v_dependents
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc 
      ON kcu.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE ccu.table_name = 'connection_requests'
      AND ccu.column_name = 'id'
      AND tc.constraint_type = 'FOREIGN KEY';

    IF v_dependents > 0 THEN
        -- Como não temos o nome exato da tabela, verificamos na força bruta genérica se houver FK
        RAISE EXCEPTION 'LIMPEZA BLOQUEADA: DEPENDÊNCIA ENCONTRADA. A tabela connection_requests é referenciada por outras tabelas (FK).';
    END IF;

    -- 3. Excluir os registros
    DELETE FROM public.connection_requests
    WHERE id IN (v_id1, v_id2);

    -- 4. Confirmar exclusão
    IF EXISTS (
        SELECT 1
        FROM public.connection_requests
        WHERE id IN (v_id1, v_id2)
    ) THEN
        RAISE EXCEPTION 'Falha ao remover conexões legadas autorizadas.';
    END IF;

    -- 5. Auditar orphans e retomar a C1.2.4
    IF EXISTS (
      SELECT 1
      FROM public.connection_requests cr
      LEFT JOIN public.organizations o ON o.id = cr.requester_company_id
      WHERE o.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Existem requester_company_id sem correspondência em organizations.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.connection_requests cr
      LEFT JOIN public.organizations o ON o.id = cr.target_company_id
      WHERE o.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Existem target_company_id sem correspondência em organizations.';
    END IF;

END $$;

-- 6. Troca das constraints
ALTER TABLE public.connection_requests
  DROP CONSTRAINT IF EXISTS connection_requests_requester_company_id_fkey;

ALTER TABLE public.connection_requests
  DROP CONSTRAINT IF EXISTS connection_requests_target_company_id_fkey;

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
  SELECT EXISTS (
      SELECT 1 
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'connection_requests' AND kcu.column_name = 'requester_company_id' AND ccu.table_name = 'organizations' AND tc.constraint_type = 'FOREIGN KEY'
  ) INTO v_fk1_exists;

  SELECT EXISTS (
      SELECT 1 
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'connection_requests' AND kcu.column_name = 'target_company_id' AND ccu.table_name = 'organizations' AND tc.constraint_type = 'FOREIGN KEY'
  ) INTO v_fk2_exists;

  IF NOT v_fk1_exists OR NOT v_fk2_exists THEN
      RAISE EXCEPTION 'MIGRATION FALHOU: As FKs não foram criadas apontando para organizations.';
  END IF;
END $$;

-- 7. Consolidação Raízen × Chaparia
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
END $$;
