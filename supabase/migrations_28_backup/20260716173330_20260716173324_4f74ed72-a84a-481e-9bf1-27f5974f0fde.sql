
-- =========================================================
-- FASE 2 — BASE MESTRE DE MATERIAIS (MIGRATION PRINCIPAL)
-- =========================================================

-- 1) ENUMS ------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.material_validation_status AS ENUM ('pending_review','needs_correction','validated','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.material_visibility AS ENUM ('private','shared','global');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.material_source AS ENUM ('manual','csv_import','api','ai','marketplace','migration');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) FUNÇÕES AUXILIARES -----------------------------------
CREATE OR REPLACE FUNCTION public.normalize_text_key(_text text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(regexp_replace(
    translate(btrim(coalesce(_text,'')),
      'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    ),'\s+',' ','g'))
$$;

CREATE OR REPLACE FUNCTION public.set_manufacturer_normalized()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.normalized_name := public.normalize_text_key(NEW.name);
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  ELSIF TG_OP = 'INSERT' AND NEW.created_by <> auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'created_by deve ser o usuário autenticado';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_material_normalized()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.normalized_official_name := public.normalize_text_key(NEW.official_name);
  RETURN NEW;
END $$;

-- Trigger de proteção: impede alteração de campos administrativos por usuários comuns
CREATE OR REPLACE FUNCTION public.protect_material_admin_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_source IS DISTINCT FROM OLD.created_source
     OR NEW.validated_by IS DISTINCT FROM OLD.validated_by
     OR NEW.validated_at IS DISTINCT FROM OLD.validated_at
     OR NEW.master_owner_organization_id IS DISTINCT FROM OLD.master_owner_organization_id
     OR NEW.validation_status IS DISTINCT FROM OLD.validation_status
     OR NEW.visibility IS DISTINCT FROM OLD.visibility THEN
    RAISE EXCEPTION 'Campos administrativos do material só podem ser alterados por superadministrador';
  END IF;
  RETURN NEW;
END $$;

-- 3) MANUFACTURERS ----------------------------------------
CREATE TABLE public.manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manufacturers_normalized_name_unique UNIQUE (normalized_name)
);

GRANT SELECT, INSERT, UPDATE ON public.manufacturers TO authenticated;
GRANT ALL ON public.manufacturers TO service_role;

ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

CREATE POLICY manufacturers_select_all ON public.manufacturers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY manufacturers_insert_authored ON public.manufacturers
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY manufacturers_update_super_admin ON public.manufacturers
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER trg_manufacturers_normalize
  BEFORE INSERT OR UPDATE ON public.manufacturers
  FOR EACH ROW EXECUTE FUNCTION public.set_manufacturer_normalized();

CREATE TRIGGER trg_manufacturers_updated
  BEFORE UPDATE ON public.manufacturers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) MATERIALS --------------------------------------------
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  official_name text NOT NULL,
  normalized_official_name text NOT NULL,
  description text,
  unit text NOT NULL DEFAULT 'un',
  manufacturer_id uuid REFERENCES public.manufacturers(id),
  manufacturer_code text,
  technical_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_status public.material_validation_status NOT NULL DEFAULT 'pending_review',
  visibility public.material_visibility NOT NULL DEFAULT 'private',
  created_source public.material_source NOT NULL DEFAULT 'manual',
  master_owner_organization_id uuid REFERENCES public.organizations(id),
  created_by uuid,
  validated_by uuid,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT materials_manufacturer_code_pair CHECK (
    (manufacturer_id IS NULL AND manufacturer_code IS NULL)
    OR (manufacturer_id IS NOT NULL AND manufacturer_code IS NOT NULL)
  )
);

CREATE INDEX materials_owner_idx ON public.materials(master_owner_organization_id);
CREATE INDEX materials_manufacturer_idx ON public.materials(manufacturer_id);
CREATE INDEX materials_visibility_status_idx ON public.materials(visibility, validation_status);

GRANT SELECT, INSERT, UPDATE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY materials_select_scoped ON public.materials
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (visibility = 'global' AND validation_status = 'validated')
    OR (master_owner_organization_id = public.current_org_id())
  );

CREATE POLICY materials_insert_owner_pending ON public.materials
  FOR INSERT TO authenticated
  WITH CHECK (
    master_owner_organization_id = public.current_org_id()
    AND created_by = auth.uid()
    AND validation_status = 'pending_review'
    AND visibility = 'private'
    AND validated_by IS NULL
    AND validated_at IS NULL
    AND created_source IN ('manual','csv_import','api','ai','marketplace')
    AND (
      public.has_role(auth.uid(), public.current_org_id(), 'admin')
      OR public.has_role(auth.uid(), public.current_org_id(), 'buyer')
    )
  );

CREATE POLICY materials_update_owner_pending ON public.materials
  FOR UPDATE TO authenticated
  USING (
    master_owner_organization_id = public.current_org_id()
    AND validation_status IN ('pending_review','needs_correction')
    AND (
      public.has_role(auth.uid(), public.current_org_id(), 'admin')
      OR public.has_role(auth.uid(), public.current_org_id(), 'buyer')
    )
  )
  WITH CHECK (
    master_owner_organization_id = public.current_org_id()
    AND visibility = 'private'
    AND validated_by IS NULL
    AND validated_at IS NULL
    AND created_source IN ('manual','csv_import','api','ai','marketplace')
    AND validation_status IN ('pending_review','needs_correction')
  );

CREATE POLICY materials_super_admin_all ON public.materials
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER trg_materials_normalize
  BEFORE INSERT OR UPDATE OF official_name ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.set_material_normalized();

CREATE TRIGGER trg_materials_protect_admin
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.protect_material_admin_fields();

CREATE TRIGGER trg_materials_updated
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) ORGANIZATION_MATERIALS -------------------------------
CREATE TABLE public.organization_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id),
  category_id uuid REFERENCES public.categories(id),
  internal_sku text,
  erp_code text,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  available_for_purchase boolean NOT NULL DEFAULT true,
  available_for_sale boolean NOT NULL DEFAULT false,
  commercial_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  logistics_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_materials_unique UNIQUE (organization_id, material_id)
);

CREATE INDEX organization_materials_org_idx ON public.organization_materials(organization_id);
CREATE INDEX organization_materials_material_idx ON public.organization_materials(material_id);

GRANT SELECT, INSERT, UPDATE ON public.organization_materials TO authenticated;
GRANT ALL ON public.organization_materials TO service_role;

ALTER TABLE public.organization_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_materials_select_own ON public.organization_materials
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_super_admin());

CREATE POLICY organization_materials_insert_own ON public.organization_materials
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (
      public.has_role(auth.uid(), organization_id, 'admin')
      OR public.has_role(auth.uid(), organization_id, 'buyer')
    )
    AND (
      category_id IS NULL
      OR EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.organization_id = organization_id)
    )
    AND EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = material_id
        AND (
          m.master_owner_organization_id = organization_id
          OR (m.visibility = 'global' AND m.validation_status = 'validated')
          OR public.is_super_admin()
        )
    )
  );

CREATE POLICY organization_materials_update_own ON public.organization_materials
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.has_role(auth.uid(), organization_id, 'admin')
      OR public.has_role(auth.uid(), organization_id, 'buyer')
    )
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (
      category_id IS NULL
      OR EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.organization_id = organization_id)
    )
    AND EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = material_id
        AND (
          m.master_owner_organization_id = organization_id
          OR (m.visibility = 'global' AND m.validation_status = 'validated')
          OR public.is_super_admin()
        )
    )
  );

CREATE TRIGGER trg_organization_materials_updated
  BEFORE UPDATE ON public.organization_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) products.material_id ---------------------------------
ALTER TABLE public.products
  ADD COLUMN material_id uuid REFERENCES public.materials(id) ON DELETE RESTRICT;

CREATE INDEX products_material_id_idx ON public.products(material_id);

-- 7) BACKFILL ---------------------------------------------
DO $$
DECLARE
  v_mat_count int;
  v_om_count int;
BEGIN
  SELECT count(*) INTO v_mat_count FROM public.materials;
  SELECT count(*) INTO v_om_count FROM public.organization_materials;

  IF v_mat_count = 0 AND v_om_count = 0 THEN
    INSERT INTO public.materials (
      id, official_name, normalized_official_name, description, unit,
      validation_status, visibility, created_source, master_owner_organization_id, created_at, updated_at
    )
    SELECT
      p.id, p.name, public.normalize_text_key(p.name), p.description, COALESCE(p.unit,'un'),
      'pending_review'::public.material_validation_status,
      'private'::public.material_visibility,
      'migration'::public.material_source,
      p.organization_id, now(), now()
    FROM public.products p
    ON CONFLICT DO NOTHING;

    INSERT INTO public.organization_materials (
      organization_id, material_id, category_id, internal_sku, display_name, created_at, updated_at
    )
    SELECT p.organization_id, p.id, p.category_id, p.sku, p.name, now(), now()
    FROM public.products p
    ON CONFLICT DO NOTHING;

    UPDATE public.products p SET material_id = p.id WHERE material_id IS NULL;
  END IF;
END $$;

-- 8) VALIDAÇÕES -------------------------------------------
DO $$
DECLARE
  v_orphan_products int;
  v_migration_materials int;
  v_org_materials int;
  v_link_mismatch int;
  v_cat_mismatch int;
BEGIN
  SELECT count(*) INTO v_orphan_products FROM public.products WHERE material_id IS NULL;
  SELECT count(*) INTO v_migration_materials FROM public.materials WHERE created_source = 'migration';
  SELECT count(*) INTO v_org_materials FROM public.organization_materials;
  SELECT count(*) INTO v_link_mismatch
    FROM public.organization_materials om
    JOIN public.materials m ON m.id = om.material_id
    WHERE m.master_owner_organization_id <> om.organization_id
      AND NOT (m.visibility = 'global' AND m.validation_status = 'validated');
  SELECT count(*) INTO v_cat_mismatch
    FROM public.organization_materials om
    JOIN public.categories c ON c.id = om.category_id
    WHERE c.organization_id <> om.organization_id;

  RAISE NOTICE 'VALIDAÇÃO: products sem material_id=%, materials(migration)=%, organization_materials=%, vinculos inconsistentes=%, categorias de outra org=%',
    v_orphan_products, v_migration_materials, v_org_materials, v_link_mismatch, v_cat_mismatch;
END $$;
;
