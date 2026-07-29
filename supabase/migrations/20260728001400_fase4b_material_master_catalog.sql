-- Migration: 20260728001400_fase4b_material_master_catalog.sql
-- Description: Evolve materials to act as global Material Master, prepare products as Catalog, and implement backfill.

BEGIN;

-- 1. Extend ENUMs se necessário
ALTER TYPE public.material_validation_status ADD VALUE IF NOT EXISTS 'merged';
ALTER TYPE public.material_validation_status ADD VALUE IF NOT EXISTS 'rejected';

-- 2. Adicionar colunas estruturais para governança global no Material Master
ALTER TABLE public.materials 
  ADD COLUMN IF NOT EXISTS normalized_manufacturer_code text,
  ADD COLUMN IF NOT EXISTS normalized_official_name text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS merged_into_material_id uuid REFERENCES public.materials(id),
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Criar índices de otimização de busca e normalização
CREATE INDEX IF NOT EXISTS idx_materials_normalized_code ON public.materials(normalized_manufacturer_code);
CREATE INDEX IF NOT EXISTS idx_materials_normalized_name ON public.materials(normalized_official_name);

-- 3. Garantir que products.material_id seja indexado (Idempotência/Segurança)
CREATE INDEX IF NOT EXISTS products_material_id_idx ON public.products USING btree (material_id);

-- 3.5 Backfill normalizando registros pré-existentes em materials
UPDATE public.materials
SET 
  normalized_manufacturer_code = BTRIM(UPPER(manufacturer_code)),
  normalized_official_name = public.normalize_text_key(official_name)
WHERE normalized_manufacturer_code IS NULL OR normalized_official_name IS NULL;

-- 4. Estratégia de Backfill Idempotente
DO $$
DECLARE
    prod_row RECORD;
    matched_material_id uuid;
    resolved_manufacturer_id uuid;
    norm_code text;
    norm_name text;
    norm_manufacturer text;
    match_count integer;
BEGIN
    FOR prod_row IN 
        SELECT id, name, description, manufacturer_code, category_id, organization_id, created_at,
               metadata->>'manufacturer' as manufacturer_name
        FROM public.products
        WHERE material_id IS NULL
        ORDER BY created_at ASC, id ASC
    LOOP
        matched_material_id := NULL;
        resolved_manufacturer_id := NULL;
        
        -- Normalizar código e nome do produto
        norm_code := BTRIM(UPPER(prod_row.manufacturer_code));
        norm_name := public.normalize_text_key(prod_row.name);
        
        IF prod_row.manufacturer_name IS NOT NULL AND BTRIM(prod_row.manufacturer_name) <> '' THEN
            norm_manufacturer := public.normalize_text_key(prod_row.manufacturer_name);
        ELSE
            norm_manufacturer := NULL;
        END IF;

        -- 4.A Resolver ou criar o Fabricante (manufacturer_id) na tabela oficial
        IF norm_manufacturer IS NOT NULL THEN
            SELECT id INTO resolved_manufacturer_id 
            FROM public.manufacturers 
            WHERE normalized_name = norm_manufacturer 
            LIMIT 1;

            IF resolved_manufacturer_id IS NULL THEN
                INSERT INTO public.manufacturers (name, normalized_name)
                VALUES (BTRIM(prod_row.manufacturer_name), norm_manufacturer)
                RETURNING id INTO resolved_manufacturer_id;
            END IF;
        END IF;

        -- 4.B Regras de Correspondência e Criação de Materials
        IF resolved_manufacturer_id IS NOT NULL AND norm_code IS NOT NULL AND norm_code <> '' THEN
            -- Caso B: Fabricante + Código (Correspondência estrita)
            SELECT count(*) INTO match_count
            FROM public.materials
            WHERE manufacturer_id = resolved_manufacturer_id
              AND normalized_manufacturer_code = norm_code;

            IF match_count = 1 THEN
                SELECT id INTO matched_material_id
                FROM public.materials
                WHERE manufacturer_id = resolved_manufacturer_id
                  AND normalized_manufacturer_code = norm_code
                LIMIT 1;
            END IF;
            
            IF matched_material_id IS NULL THEN
                -- Se não existe (ou é ambíguo), cria um novo pending_review
                INSERT INTO public.materials (
                    official_name, description, normalized_official_name,
                    master_owner_organization_id, validation_status, visibility, created_source,
                    is_active, manufacturer_id, manufacturer_code, normalized_manufacturer_code, created_at, updated_at
                ) VALUES (
                    prod_row.name, prod_row.description, norm_name,
                    prod_row.organization_id, 'pending_review'::material_validation_status, 'private'::material_visibility, 'manual'::material_source,
                    true, resolved_manufacturer_id, prod_row.manufacturer_code, norm_code, COALESCE(prod_row.created_at, now()), now()
                ) RETURNING id INTO matched_material_id;
            END IF;

        ELSIF norm_code IS NOT NULL AND norm_code <> '' THEN
            -- Caso C: Código sem fabricante
            SELECT count(*) INTO match_count
            FROM public.materials
            WHERE normalized_manufacturer_code = norm_code;

            IF match_count = 1 THEN
                SELECT id INTO matched_material_id
                FROM public.materials
                WHERE normalized_manufacturer_code = norm_code
                LIMIT 1;
            END IF;

            IF matched_material_id IS NULL THEN
                -- Se não acha (ou ambíguo), cria novo sem código e fabricante p/ respeitar constraint e não unificar falsamente
                INSERT INTO public.materials (
                    official_name, description, normalized_official_name,
                    master_owner_organization_id, validation_status, visibility, created_source,
                    is_active, manufacturer_id, manufacturer_code, normalized_manufacturer_code, created_at, updated_at
                ) VALUES (
                    prod_row.name, prod_row.description, norm_name,
                    prod_row.organization_id, 'pending_review'::material_validation_status, 'private'::material_visibility, 'manual'::material_source,
                    true, NULL, NULL, NULL, COALESCE(prod_row.created_at, now()), now()
                ) RETURNING id INTO matched_material_id;
            END IF;

        ELSE
            -- Caso D / E: Sem fabricante e sem código (ou apenas nome)
            INSERT INTO public.materials (
                official_name, description, normalized_official_name,
                master_owner_organization_id, validation_status, visibility, created_source,
                is_active, manufacturer_id, manufacturer_code, normalized_manufacturer_code, created_at, updated_at
            ) VALUES (
                prod_row.name, prod_row.description, norm_name,
                prod_row.organization_id, 'pending_review'::material_validation_status, 'private'::material_visibility, 'manual'::material_source,
                true, NULL, NULL, NULL, COALESCE(prod_row.created_at, now()), now()
            ) RETURNING id INTO matched_material_id;
        END IF;

        -- 4.C Atualizar produto com o ID resolvido/criado
        UPDATE public.products 
        SET material_id = matched_material_id
        WHERE id = prod_row.id;

    END LOOP;
END
$$;

-- 5. Refinamento de RLS Policies para Materials

DROP POLICY IF EXISTS "materials_select_scoped" ON public.materials;
DROP POLICY IF EXISTS "materials_insert_owner_pending" ON public.materials;
DROP POLICY IF EXISTS "materials_update_owner_pending" ON public.materials;
DROP POLICY IF EXISTS "materials_super_admin_all" ON public.materials;
DROP POLICY IF EXISTS "materials_select" ON public.materials;
DROP POLICY IF EXISTS "materials_insert" ON public.materials;
DROP POLICY IF EXISTS "materials_update" ON public.materials;
DROP POLICY IF EXISTS "materials_delete" ON public.materials;

-- SELECT: leitura de validados e ativos, ou os do próprio tenant, ou acesso global p/ admins
CREATE POLICY "materials_select" ON public.materials
FOR SELECT TO authenticated
USING (
  (validation_status = 'validated'::material_validation_status AND is_active = true)
  OR
  (master_owner_organization_id = public.current_org_id())
  OR
  public.is_platform_admin()
  OR 
  public.is_super_admin()
);

-- INSERT: Tenants podem criar pendentes vinculados à sua própria organização
CREATE POLICY "materials_insert" ON public.materials
FOR INSERT TO authenticated
WITH CHECK (
  master_owner_organization_id = public.current_org_id()
  AND validation_status = 'pending_review'::material_validation_status
  AND reviewed_at IS NULL
  AND reviewed_by IS NULL
  AND merged_into_material_id IS NULL
);

-- UPDATE: Tenants editam apenas seus pendentes/em correção. Admins alteram tudo.
CREATE POLICY "materials_update" ON public.materials
FOR UPDATE TO authenticated
USING (
  (master_owner_organization_id = public.current_org_id() AND validation_status IN ('pending_review'::material_validation_status, 'needs_correction'::material_validation_status))
  OR 
  public.is_platform_admin()
  OR 
  public.is_super_admin()
)
WITH CHECK (
  (master_owner_organization_id = public.current_org_id() AND validation_status IN ('pending_review'::material_validation_status, 'needs_correction'::material_validation_status))
  OR 
  public.is_platform_admin()
  OR 
  public.is_super_admin()
);

-- DELETE: Proibido exclusão física para tenants comuns. Exclusão restrita a admins.
CREATE POLICY "materials_delete" ON public.materials
FOR DELETE TO authenticated
USING (
  public.is_platform_admin() OR public.is_super_admin()
);

-- 6. Trigger Administrativo de Proteção de Campos Confidenciais / Curadoria

CREATE OR REPLACE FUNCTION public.protect_material_admin_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_super_admin() OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
     IF NEW.validation_status NOT IN ('pending_review'::material_validation_status, 'needs_correction'::material_validation_status) THEN
         RAISE EXCEPTION 'Apenas administradores podem criar materiais com status final de validação.';
     END IF;
     RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
      IF NEW.created_by IS DISTINCT FROM OLD.created_by
         OR NEW.created_source IS DISTINCT FROM OLD.created_source
         OR NEW.validated_by IS DISTINCT FROM OLD.validated_by
         OR NEW.validated_at IS DISTINCT FROM OLD.validated_at
         OR NEW.master_owner_organization_id IS DISTINCT FROM OLD.master_owner_organization_id
         OR NEW.validation_status IS DISTINCT FROM OLD.validation_status
         OR NEW.visibility IS DISTINCT FROM OLD.visibility
         OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
         OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
         OR NEW.merged_into_material_id IS DISTINCT FROM OLD.merged_into_material_id
         OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        RAISE EXCEPTION 'Campos administrativos do material só podem ser alterados por administradores globais';
      END IF;
  END IF;
  
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_protect_material_admin_fields ON public.materials;
CREATE TRIGGER trg_protect_material_admin_fields
  BEFORE INSERT OR UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_material_admin_fields();

COMMIT;
