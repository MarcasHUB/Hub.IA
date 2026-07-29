
-- 1. Colunas de snapshot (idempotente)
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS product_name_snapshot            text,
  ADD COLUMN IF NOT EXISTS manufacturer_name_snapshot       text,
  ADD COLUMN IF NOT EXISTS manufacturer_code_snapshot       text,
  ADD COLUMN IF NOT EXISTS internal_sku_snapshot            text,
  ADD COLUMN IF NOT EXISTS description_snapshot             text,
  ADD COLUMN IF NOT EXISTS unit_snapshot                    text,
  ADD COLUMN IF NOT EXISTS category_name_snapshot           text,
  ADD COLUMN IF NOT EXISTS material_id_snapshot             uuid,
  ADD COLUMN IF NOT EXISTS organization_material_id_snapshot uuid,
  ADD COLUMN IF NOT EXISTS snapshot_source                  text,
  ADD COLUMN IF NOT EXISTS snapshot_created_at              timestamptz;

-- 2. Constraint idempotente para snapshot_source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotation_items_snapshot_source_chk'
      AND conrelid = 'public.quotation_items'::regclass
  ) THEN
    ALTER TABLE public.quotation_items
      ADD CONSTRAINT quotation_items_snapshot_source_chk
      CHECK (snapshot_source IS NULL OR snapshot_source IN (
        'created_with_quotation',
        'current_state_backfill'
      ));
  END IF;
END $$;

-- 3. Índice para lookup histórico por material
CREATE INDEX IF NOT EXISTS quotation_items_material_snapshot_idx
  ON public.quotation_items(material_id_snapshot);

-- 4. Backfill dos itens existentes (somente onde snapshot ainda não foi preenchido)
WITH src AS (
  SELECT
    qi.id AS qi_id,
    COALESCE(
      NULLIF(btrim(om.display_name), ''),
      NULLIF(btrim(p.name), ''),
      m.official_name
    ) AS product_name,
    mfr.name AS manufacturer_name,
    m.manufacturer_code AS manufacturer_code,
    COALESCE(
      NULLIF(btrim(om.internal_sku), ''),
      NULLIF(btrim(p.sku), '')
    ) AS internal_sku,
    COALESCE(p.description, m.description) AS description,
    COALESCE(
      NULLIF(btrim(qi.unit), ''),
      NULLIF(btrim(p.unit), ''),
      m.unit
    ) AS unit,
    c.name AS category_name,
    p.material_id AS material_id,
    om.id AS organization_material_id
  FROM public.quotation_items qi
  JOIN public.products p ON p.id = qi.product_id
  LEFT JOIN public.materials m ON m.id = p.material_id
  LEFT JOIN public.manufacturers mfr ON mfr.id = m.manufacturer_id
  LEFT JOIN public.organization_materials om
    ON om.material_id = p.material_id
   AND om.organization_id = p.organization_id
  LEFT JOIN public.categories c ON c.id = COALESCE(om.category_id, p.category_id)
  WHERE qi.snapshot_source IS NULL
)
UPDATE public.quotation_items qi
SET
  product_name_snapshot             = src.product_name,
  manufacturer_name_snapshot        = src.manufacturer_name,
  manufacturer_code_snapshot        = src.manufacturer_code,
  internal_sku_snapshot             = src.internal_sku,
  description_snapshot              = src.description,
  unit_snapshot                     = src.unit,
  category_name_snapshot            = src.category_name,
  material_id_snapshot              = src.material_id,
  organization_material_id_snapshot = src.organization_material_id,
  snapshot_source                   = 'current_state_backfill',
  snapshot_created_at               = now()
FROM src
WHERE qi.id = src.qi_id;
;
