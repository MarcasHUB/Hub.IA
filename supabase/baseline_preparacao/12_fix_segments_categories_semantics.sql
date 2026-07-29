-- ========================================================================================
-- 12_fix_segments_categories_semantics.sql
-- Description: Migrates categories from segments, recreates the operators permissions,
-- cleans up segments and populates standard business segments.
-- ========================================================================================

-- 1. Create table operator_categories to replace operator_segments
CREATE TABLE IF NOT EXISTS public.operator_categories (
    operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (operator_id, category_id)
);

-- 2. Migrate existing categories (currently trapped in segments) to the categories table
-- Make sure organization_id maps correctly.
-- Skip duplicates based on normalized_name and organization_id.
INSERT INTO public.categories (id, organization_id, name, description, is_active, created_at, updated_at)
SELECT 
    s.id, 
    s.organization_id, 
    s.nome, 
    s.descricao, 
    (s.status = 'ativo'), 
    s.created_at, 
    s.updated_at
FROM public.segments s
WHERE NOT EXISTS (
    SELECT 1 FROM public.categories c 
    WHERE c.organization_id = s.organization_id 
    AND (c.name = s.nome OR c.normalized_name = lower(unaccent(s.nome)))
)
ON CONFLICT (id) DO NOTHING;

-- 3. Migrate the operator permissions from operator_segments to operator_categories
-- Resolve duplicate IDs if any were skipped above by mapping them to existing category
INSERT INTO public.operator_categories (operator_id, category_id, created_at)
SELECT os.operator_id, COALESCE(c.id, os.segment_id), os.created_at
FROM public.operator_segments os
LEFT JOIN public.segments s ON s.id = os.segment_id
LEFT JOIN public.categories c ON c.organization_id = s.organization_id AND (c.name = s.nome OR c.normalized_name = lower(unaccent(s.nome)))
ON CONFLICT (operator_id, category_id) DO NOTHING;

-- 4. Update the products table
UPDATE public.products p
SET category_id = COALESCE(c.id, p.segment_id)
FROM public.segments s
LEFT JOIN public.categories c ON c.organization_id = s.organization_id AND (c.name = s.nome OR c.normalized_name = lower(unaccent(s.nome)))
WHERE p.segment_id = s.id AND p.segment_id IS NOT NULL;

UPDATE public.products SET segment_id = NULL;

-- 5. Create company_segments table for the N:N relationship with companies/organizations
CREATE TABLE IF NOT EXISTS public.company_segments (
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (organization_id, segment_id)
);

-- 6. Cleanup foreign keys that would block deletion of segments
CREATE TABLE IF NOT EXISTS public.supplier_categories (
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (supplier_id, category_id)
);

INSERT INTO public.supplier_categories (supplier_id, category_id)
SELECT ss.supplier_id, COALESCE(c.id, ss.segment_id)
FROM public.supplier_segments ss
LEFT JOIN public.segments s ON s.id = ss.segment_id
LEFT JOIN public.categories c ON c.organization_id = s.organization_id AND (c.name = s.nome OR c.normalized_name = lower(unaccent(s.nome)))
ON CONFLICT (supplier_id, category_id) DO NOTHING;

-- 7. Now we can safely wipe the old data from segments and dependent tables
DELETE FROM public.operator_segments;
DELETE FROM public.supplier_segments;
DELETE FROM public.hubia_signals WHERE segment_id IS NOT NULL; 
DELETE FROM public.segments;

-- 8. Make organization_id nullable in segments so we can have global business segments
ALTER TABLE public.segments ALTER COLUMN organization_id DROP NOT NULL;

-- 9. Insert the global business segments
INSERT INTO public.segments (id, nome, descricao, status) VALUES
(gen_random_uuid(), 'Indústria', 'Segmento industrial e manufatura', 'ativo'),
(gen_random_uuid(), 'Mineração', 'Mineração e extração', 'ativo'),
(gen_random_uuid(), 'Construção Civil', 'Engenharia e construção', 'ativo'),
(gen_random_uuid(), 'Agronegócio', 'Agricultura e pecuária', 'ativo'),
(gen_random_uuid(), 'Logística', 'Transporte e logística', 'ativo'),
(gen_random_uuid(), 'Energia', 'Geração e distribuição de energia', 'ativo'),
(gen_random_uuid(), 'Saneamento', 'Saneamento básico e tratamento', 'ativo'),
(gen_random_uuid(), 'Óleo e Gás', 'Extração e refino de petróleo e gás', 'ativo'),
(gen_random_uuid(), 'Alimentício', 'Produção e processamento de alimentos', 'ativo'),
(gen_random_uuid(), 'Farmacêutico', 'Indústria farmacêutica e saúde', 'ativo'),
(gen_random_uuid(), 'Papel e Celulose', 'Produção de papel e celulose', 'ativo'),
(gen_random_uuid(), 'Metalurgia', 'Metalurgia e siderurgia', 'ativo');

-- 10. Drop the text array column from organizations / companies if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'segments') THEN
        ALTER TABLE public.organizations DROP COLUMN segments;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'segments') THEN
        ALTER TABLE public.companies DROP COLUMN segments;
    END IF;
END $$;
