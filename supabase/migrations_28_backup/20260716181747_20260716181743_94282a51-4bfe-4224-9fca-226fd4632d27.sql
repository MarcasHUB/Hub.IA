
-- Migration B.1: snapshot_version + imutabilidade
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS snapshot_version smallint;

-- Backfill snapshot_version=1 para itens já com snapshot
UPDATE public.quotation_items
SET snapshot_version = 1
WHERE snapshot_source IS NOT NULL AND snapshot_version IS NULL;

-- Trigger: snapshot_* é somente-leitura após criação
CREATE OR REPLACE FUNCTION public.protect_quotation_item_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.snapshot_source IS NOT NULL THEN
    IF NEW.product_name_snapshot        IS DISTINCT FROM OLD.product_name_snapshot
    OR NEW.manufacturer_name_snapshot   IS DISTINCT FROM OLD.manufacturer_name_snapshot
    OR NEW.manufacturer_code_snapshot   IS DISTINCT FROM OLD.manufacturer_code_snapshot
    OR NEW.internal_sku_snapshot        IS DISTINCT FROM OLD.internal_sku_snapshot
    OR NEW.description_snapshot         IS DISTINCT FROM OLD.description_snapshot
    OR NEW.unit_snapshot                IS DISTINCT FROM OLD.unit_snapshot
    OR NEW.category_name_snapshot       IS DISTINCT FROM OLD.category_name_snapshot
    OR NEW.material_id_snapshot         IS DISTINCT FROM OLD.material_id_snapshot
    OR NEW.organization_material_id_snapshot IS DISTINCT FROM OLD.organization_material_id_snapshot
    OR NEW.snapshot_source              IS DISTINCT FROM OLD.snapshot_source
    OR NEW.snapshot_created_at          IS DISTINCT FROM OLD.snapshot_created_at
    OR NEW.snapshot_version             IS DISTINCT FROM OLD.snapshot_version
    THEN
      RAISE EXCEPTION 'Snapshot histórico é imutável após criação (quotation_items.id=%).', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotation_items_snapshot_immutable ON public.quotation_items;
CREATE TRIGGER quotation_items_snapshot_immutable
BEFORE UPDATE ON public.quotation_items
FOR EACH ROW EXECUTE FUNCTION public.protect_quotation_item_snapshot();
;
