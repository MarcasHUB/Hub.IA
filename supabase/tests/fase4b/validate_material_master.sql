-- Validation Script for Fase 4B Backfill

SELECT 'Metrics (First execution)' as metric;

SELECT 'Manufacturers Count' as metric, count(*) as count FROM public.manufacturers
UNION ALL
SELECT 'Materials Count' as metric, count(*) as count FROM public.materials
UNION ALL
SELECT 'Products Count' as metric, count(*) as count FROM public.products
UNION ALL
SELECT 'Products (material_id IS NULL)' as metric, count(*) as count FROM public.products WHERE material_id IS NULL
UNION ALL
SELECT 'Products (material_id IS NOT NULL)' as metric, count(*) as count FROM public.products WHERE material_id IS NOT NULL;

SELECT 'C1 - Vínculo Existente' as c, id, material_id FROM public.products WHERE name = 'Prod C1';

SELECT 'C2 - Mesmo Fab + Mesmo Codigo' as c, name, manufacturer_code, material_id FROM public.products WHERE name LIKE 'Prod C2%';

SELECT 'C3 - Fabs dif + Mesmo Codigo' as c, name, manufacturer_code, material_id FROM public.products WHERE name LIKE 'Prod C3%';

SELECT 'C4 - Mesmo nome + Codigos dif' as c, name, manufacturer_code, material_id FROM public.products WHERE name LIKE 'Produto Teste C4%';

SELECT 'C5 - Somente Nome (Validar novo)' as c, name, material_id FROM public.products WHERE name = 'Mat Validated';

SELECT 'C6 - Codigo único sem Fab' as c, name, material_id FROM public.products WHERE name = 'Prod C6';

SELECT 'C7 - Codigo ambíguo sem Fab' as c, name, material_id FROM public.products WHERE name = 'Prod C7';

SELECT 'C8 - Nulo sem match' as c, name, material_id FROM public.products WHERE name = 'Prod C8 Totalmente Novo';
