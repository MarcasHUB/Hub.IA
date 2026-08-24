-- B1-R.4F.3 CNPJ Global Uniqueness

-- Add generated column if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'cnpj_normalized'
  ) THEN
    ALTER TABLE public.organizations
    ADD COLUMN cnpj_normalized text
    GENERATED ALWAYS AS (
      nullif(
        regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g'),
        ''
      )
    ) STORED;
  END IF;
END $$;

-- Add check constraint for length 14
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_type = 'CHECK'
    AND table_name = 'organizations'
    AND constraint_name = 'organizations_cnpj_normalized_check'
  ) THEN
    ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_cnpj_normalized_check
    CHECK (cnpj_normalized IS NULL OR length(cnpj_normalized) = 14);
  END IF;
END $$;

-- Add unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_cnpj_normalized
ON public.organizations (cnpj_normalized)
WHERE cnpj_normalized IS NOT NULL;

-- Atualizar trigger
CREATE OR REPLACE FUNCTION public.trg_valida_invitation_nova()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_cnpj text;
  v_count integer;
  v_status text;
  v_exists uuid;
BEGIN
  v_status := lower(trim(coalesce(NEW.status, '')));

  IF NEW.document IS NOT NULL AND v_status IN ('pending', 'pendente') THEN
    v_clean_cnpj := regexp_replace(coalesce(NEW.document, ''), '[^0-9]', '', 'g');

    IF length(v_clean_cnpj) <> 14 THEN
      RAISE EXCEPTION 'INVITATION_CNPJ_INVALID';
    END IF;

    -- Usa a coluna normalizada se possível
    SELECT count(*)
    INTO v_count
    FROM public.organizations o
    WHERE coalesce(o.cnpj_normalized, regexp_replace(coalesce(o.cnpj, ''), '[^0-9]', '', 'g')) = v_clean_cnpj;

    IF v_count >= 1 THEN
      RAISE EXCEPTION 'ORGANIZATION_ALREADY_EXISTS';
    END IF;

    SELECT i.id INTO v_exists
    FROM public.invitations i
    WHERE i.organization_id = NEW.organization_id
      AND regexp_replace(coalesce(i.document, ''), '[^0-9]', '', 'g') = v_clean_cnpj
      AND lower(trim(coalesce(i.status,''))) IN ('pending','pendente')
      AND (i.expires_at IS NULL OR i.expires_at > now())
      AND (TG_OP = 'INSERT' OR i.id != NEW.id)
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'INVITATION_ALREADY_PENDING';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
