-- Migration: 20260728001300_fase3_post_deploy_fixes.sql
-- Description: Enable RLS on associative tables, add AS RESTRICTIVE policies to isolate platform_internal records, and create SECURITY DEFINER helpers.

BEGIN;

-- 1. Enable RLS on exposed tables
ALTER TABLE public.company_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_categories ENABLE ROW LEVEL SECURITY;

-- 2. Security Definer Helpers for Isolation
-- These functions bypass RLS to reliably check if a record belongs to the internal platform.
-- This prevents the "NOT EXISTS = TRUE" flaw when tenants cannot read internal rows.

-- Helper: is_org_internal
CREATE OR REPLACE FUNCTION public.is_org_internal(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_org_id AND is_platform_internal = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_internal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_internal(uuid) TO authenticated, service_role;

-- Helper: is_operator_internal
CREATE OR REPLACE FUNCTION public.is_operator_internal(p_operator_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.operators op
    JOIN public.organizations o ON op.organization_id = o.id
    WHERE op.id = p_operator_id AND o.is_platform_internal = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_operator_internal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_operator_internal(uuid) TO authenticated, service_role;

-- Helper: is_supplier_internal
CREATE OR REPLACE FUNCTION public.is_supplier_internal(p_supplier_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.suppliers s
    JOIN public.organizations o ON s.organization_id = o.id
    WHERE s.id = p_supplier_id AND o.is_platform_internal = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_supplier_internal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_supplier_internal(uuid) TO authenticated, service_role;


-- 3. Policies for company_segments (FK: organization_id)
CREATE POLICY "company_segments_select" ON public.company_segments
FOR SELECT TO authenticated
USING (public.has_org_access(organization_id) OR public.is_super_admin());

CREATE POLICY "company_segments_insert" ON public.company_segments
FOR INSERT TO authenticated
WITH CHECK (public.has_org_access(organization_id) OR public.is_super_admin());

CREATE POLICY "company_segments_update" ON public.company_segments
FOR UPDATE TO authenticated
USING (public.has_org_access(organization_id) OR public.is_super_admin())
WITH CHECK (public.has_org_access(organization_id) OR public.is_super_admin());

CREATE POLICY "company_segments_delete" ON public.company_segments
FOR DELETE TO authenticated
USING (public.has_org_access(organization_id) OR public.is_super_admin());

-- RESTRICTIVE POLICY (Using Helper)
CREATE POLICY "company_segments_isolation" ON public.company_segments
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT public.is_org_internal(organization_id) OR public.is_platform_admin())
WITH CHECK (NOT public.is_org_internal(organization_id) OR public.is_platform_admin());


-- 4. Policies for operator_categories (FK: operator_id -> operators.organization_id)
CREATE POLICY "operator_categories_select" ON public.operator_categories
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.operators op
    WHERE op.id = operator_categories.operator_id 
      AND (public.has_org_access(op.organization_id) OR public.is_super_admin())
  )
);

CREATE POLICY "operator_categories_insert" ON public.operator_categories
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.operators op
    WHERE op.id = operator_categories.operator_id 
      AND (public.has_org_access(op.organization_id) OR public.is_super_admin())
  )
);

CREATE POLICY "operator_categories_update" ON public.operator_categories
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.operators op
    WHERE op.id = operator_categories.operator_id 
      AND (public.has_org_access(op.organization_id) OR public.is_super_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.operators op
    WHERE op.id = operator_categories.operator_id 
      AND (public.has_org_access(op.organization_id) OR public.is_super_admin())
  )
);

CREATE POLICY "operator_categories_delete" ON public.operator_categories
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.operators op
    WHERE op.id = operator_categories.operator_id 
      AND (public.has_org_access(op.organization_id) OR public.is_super_admin())
  )
);

-- RESTRICTIVE POLICY (Using Helper)
CREATE POLICY "operator_categories_isolation" ON public.operator_categories
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT public.is_operator_internal(operator_id) OR public.is_platform_admin())
WITH CHECK (NOT public.is_operator_internal(operator_id) OR public.is_platform_admin());


-- 5. Policies for supplier_categories (FK: supplier_id -> suppliers.organization_id)
CREATE POLICY "supplier_categories_select" ON public.supplier_categories
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_categories.supplier_id 
      AND (public.has_org_access(s.organization_id) OR public.is_super_admin())
  )
);

CREATE POLICY "supplier_categories_insert" ON public.supplier_categories
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_categories.supplier_id 
      AND (public.has_org_access(s.organization_id) OR public.is_super_admin())
  )
);

CREATE POLICY "supplier_categories_update" ON public.supplier_categories
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_categories.supplier_id 
      AND (public.has_org_access(s.organization_id) OR public.is_super_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_categories.supplier_id 
      AND (public.has_org_access(s.organization_id) OR public.is_super_admin())
  )
);

CREATE POLICY "supplier_categories_delete" ON public.supplier_categories
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = supplier_categories.supplier_id 
      AND (public.has_org_access(s.organization_id) OR public.is_super_admin())
  )
);

-- RESTRICTIVE POLICY (Using Helper)
CREATE POLICY "supplier_categories_isolation" ON public.supplier_categories
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT public.is_supplier_internal(supplier_id) OR public.is_platform_admin())
WITH CHECK (NOT public.is_supplier_internal(supplier_id) OR public.is_platform_admin());


-- 6. Restrictive policy for operators table directly
CREATE POLICY "operators_isolation" ON public.operators
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT public.is_org_internal(organization_id) OR public.is_platform_admin())
WITH CHECK (NOT public.is_org_internal(organization_id) OR public.is_platform_admin());

COMMIT;
