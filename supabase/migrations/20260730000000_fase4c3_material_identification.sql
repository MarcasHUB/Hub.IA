-- Migration for Phase 4C.3
-- Ensures uniqueness of materials by normalized code and manufacturer

-- 1. Normalization function
CREATE OR REPLACE FUNCTION normalize_manufacturer_code(code TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN regexp_replace(upper(trim(code)), '[^A-Z0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql;

-- 2. Add column if it doesn't exist
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS normalized_manufacturer_code TEXT;

-- 3. Update existing records
UPDATE public.materials 
SET normalized_manufacturer_code = normalize_manufacturer_code(manufacturer_code)
WHERE manufacturer_code IS NOT NULL AND normalized_manufacturer_code IS NULL;

-- 4. Trigger to auto-normalize
CREATE OR REPLACE FUNCTION trg_normalize_materials()
RETURNS TRIGGER AS $$
BEGIN
    NEW.normalized_manufacturer_code = normalize_manufacturer_code(NEW.manufacturer_code);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_normalize_materials ON public.materials;
CREATE TRIGGER trigger_normalize_materials
BEFORE INSERT OR UPDATE OF manufacturer_code ON public.materials
FOR EACH ROW
EXECUTE FUNCTION trg_normalize_materials();

-- 5. Constraint
ALTER TABLE public.materials 
DROP CONSTRAINT IF EXISTS unique_material_manufacturer_code;

ALTER TABLE public.materials
ADD CONSTRAINT unique_material_manufacturer_code 
UNIQUE (manufacturer_id, normalized_manufacturer_code);

-- 6. Update products with foreign key
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS fk_products_material_id;

ALTER TABLE public.products
ADD CONSTRAINT fk_products_material_id
FOREIGN KEY (material_id) REFERENCES public.materials(id)
ON DELETE RESTRICT;
