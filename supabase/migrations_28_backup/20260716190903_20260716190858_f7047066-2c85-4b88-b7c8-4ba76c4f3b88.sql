-- =========================================================
-- D1: Business Units + Numeração generalizada (completa)
-- Idempotente. Sem alteração de dados de negócio.
-- =========================================================

-- ---------- business_units ----------
CREATE TABLE IF NOT EXISTS public.business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_units_code_format CHECK (code ~ '^[A-Z0-9]{2,8}$'),
  CONSTRAINT business_units_org_code_unique UNIQUE (organization_id, code)
);

-- Suporte à FK composta
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'business_units_id_org_unique'
      AND conrelid = 'public.business_units'::regclass
  ) THEN
    ALTER TABLE public.business_units
      ADD CONSTRAINT business_units_id_org_unique UNIQUE (id, organization_id);
  END IF;
END$$;

GRANT SELECT, INSERT, UPDATE ON public.business_units TO authenticated;
GRANT ALL ON public.business_units TO service_role;

ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bu_select_same_org" ON public.business_units;
CREATE POLICY "bu_select_same_org" ON public.business_units
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "bu_insert_admin" ON public.business_units;
CREATE POLICY "bu_insert_admin" ON public.business_units
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND public.has_role(auth.uid(), public.current_org_id(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "bu_update_admin" ON public.business_units;
CREATE POLICY "bu_update_admin" ON public.business_units
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public.has_role(auth.uid(), public.current_org_id(), 'admin'::app_role)
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND public.has_role(auth.uid(), public.current_org_id(), 'admin'::app_role)
  );

-- Sem policy de DELETE para authenticated.

DROP TRIGGER IF EXISTS trg_business_units_updated_at ON public.business_units;
CREATE TRIGGER trg_business_units_updated_at
  BEFORE UPDATE ON public.business_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_business_units_org ON public.business_units(organization_id);

-- ---------- number_counters ----------
CREATE TABLE IF NOT EXISTS public.number_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  business_unit_id uuid NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('PR','ORC','PO')),
  year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill defensivo de colunas ausentes (registros legados)
ALTER TABLE public.number_counters ADD COLUMN IF NOT EXISTS id uuid;
UPDATE public.number_counters SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.number_counters ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.number_counters ALTER COLUMN id SET DEFAULT gen_random_uuid();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.number_counters'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.number_counters ADD PRIMARY KEY (id);
  END IF;
END$$;

ALTER TABLE public.number_counters ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.number_counters ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- FK composta (id + organization_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'number_counters_business_unit_id_fkey'
      AND conrelid = 'public.number_counters'::regclass
  ) THEN
    ALTER TABLE public.number_counters DROP CONSTRAINT number_counters_business_unit_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'number_counters_bu_org_fkey'
      AND conrelid = 'public.number_counters'::regclass
  ) THEN
    ALTER TABLE public.number_counters
      ADD CONSTRAINT number_counters_bu_org_fkey
      FOREIGN KEY (business_unit_id, organization_id)
      REFERENCES public.business_units(id, organization_id)
      ON DELETE RESTRICT;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS number_counters_unique
  ON public.number_counters (
    organization_id,
    COALESCE(business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
    entity_type,
    year
  );

GRANT SELECT ON public.number_counters TO authenticated;
GRANT ALL ON public.number_counters TO service_role;

ALTER TABLE public.number_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "number_counters_select_same_org" ON public.number_counters;
CREATE POLICY "number_counters_select_same_org" ON public.number_counters
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

-- Sem policies de INSERT/UPDATE/DELETE para authenticated.

-- ---------- next_document_number ----------
CREATE OR REPLACE FUNCTION public.next_document_number(
  p_org_id uuid,
  p_business_unit_id uuid,
  p_entity_type text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
  v_num integer;
  v_bu_code text;
  v_prefix text;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id é obrigatório';
  END IF;

  IF p_entity_type IS NULL OR p_entity_type NOT IN ('PR','ORC','PO') THEN
    RAISE EXCEPTION 'entity_type inválido: %', p_entity_type;
  END IF;

  IF p_business_unit_id IS NOT NULL THEN
    SELECT code INTO v_bu_code
    FROM public.business_units
    WHERE id = p_business_unit_id
      AND organization_id = p_org_id
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Business Unit inválida, inativa ou não pertencente à organização';
    END IF;
  END IF;

  INSERT INTO public.number_counters (organization_id, business_unit_id, entity_type, year, last_number)
  VALUES (p_org_id, p_business_unit_id, p_entity_type, v_year, 1)
  ON CONFLICT (organization_id, (COALESCE(business_unit_id, '00000000-0000-0000-0000-000000000000'::uuid)), entity_type, year)
  DO UPDATE SET last_number = public.number_counters.last_number + 1,
                updated_at = now()
  RETURNING last_number INTO v_num;

  IF v_bu_code IS NOT NULL THEN
    v_prefix := p_entity_type || '-' || v_bu_code;
  ELSE
    v_prefix := p_entity_type;
  END IF;

  RETURN v_prefix || '-' || v_year::text || '-' || lpad(v_num::text, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_document_number(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_document_number(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(uuid, uuid, text) TO service_role;;
