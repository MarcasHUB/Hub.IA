
-- 1) Adicionar colunas nullable
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS normalized_name text;

-- 2) Função de normalização (sem depender de unaccent)
CREATE OR REPLACE FUNCTION public.normalize_category_name(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT lower(
    regexp_replace(
      translate(
        btrim(coalesce(_name, '')),
        'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
      ),
      '\s+', ' ', 'g'
    )
  )
$$;

-- 3) Trigger BEFORE INSERT/UPDATE para popular normalized_name automaticamente
CREATE OR REPLACE FUNCTION public.set_category_normalized_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.normalized_name := public.normalize_category_name(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_normalize ON public.categories;
CREATE TRIGGER trg_categories_normalize
BEFORE INSERT OR UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.set_category_normalized_name();

-- 4) Backfill registros existentes
UPDATE public.categories
SET normalized_name = public.normalize_category_name(name)
WHERE normalized_name IS NULL;

-- 5) Abortar se houver duplicidades na mesma organização
DO $$
DECLARE
  v_dup int;
BEGIN
  SELECT count(*) INTO v_dup FROM (
    SELECT 1 FROM public.categories
    GROUP BY organization_id, normalized_name
    HAVING count(*) > 1
  ) s;
  IF v_dup > 0 THEN
    RAISE EXCEPTION 'Existem categorias duplicadas por organização. Ajuste manualmente antes de criar o índice único.';
  END IF;
END $$;

-- 6) Tornar obrigatório e criar índice único
ALTER TABLE public.categories
  ALTER COLUMN normalized_name SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS categories_org_normalized_name_uniq
  ON public.categories (organization_id, normalized_name);
;
