-- Fixtures para testes do Material Master e Backfill da Fase 4B

-- Limpeza
DELETE FROM public.products;
DELETE FROM public.organization_materials;
DELETE FROM public.materials;
DELETE FROM public.manufacturers;
DELETE FROM public.organizations;

-- Organizações de Teste
INSERT INTO public.organizations (id, name, slug) VALUES 
('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'org-alpha'),
('22222222-2222-2222-2222-222222222222', 'Org Beta',  'org-beta'),
('33333333-3333-3333-3333-333333333333', 'Org Gamma', 'org-gamma');

-- Fabricante Preexistente
INSERT INTO public.manufacturers (id, name, normalized_name) VALUES 
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Fabricante Base', 'FABRICANTE BASE'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fabricante Multi', 'FABRICANTE MULTI');

-- Desabilitar temporariamente a trigger para permitir a inserção de status administrativos pelo script de teste (já que psql não tem jwt.claims)
ALTER TABLE public.materials DISABLE TRIGGER trg_protect_material_admin_fields;

-- Materiais Preexistentes (Cenário 1, 6, 7 e Testes RLS)
INSERT INTO public.materials (id, official_name, normalized_official_name, manufacturer_id, manufacturer_code, normalized_manufacturer_code, master_owner_organization_id, validation_status, is_active)
VALUES 
-- Mat 1 (usado em C1)
('e1111111-1111-1111-1111-111111111111', 'Mat 1', 'MAT 1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CODE-EXISTING', 'CODE-EXISTING', '11111111-1111-1111-1111-111111111111', 'pending_review', true),
-- Mat 6 (usado em C6 - Código único sem fabricante)
('e6666666-6666-6666-6666-666666666666', 'Mat 6', 'MAT 6', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'UNICO1', 'UNICO1', '11111111-1111-1111-1111-111111111111', 'pending_review', true),
-- Mat 7A e 7B (usado em C7 - Código ambíguo sem fabricante)
('e7777777-7777-7777-7777-777777777777', 'Mat 7A', 'MAT 7A', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AMBIG', 'AMBIG', '11111111-1111-1111-1111-111111111111', 'pending_review', true),
('e7777778-7777-7777-7777-777777777777', 'Mat 7B', 'MAT 7B', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'AMBIG', 'AMBIG', '11111111-1111-1111-1111-111111111111', 'pending_review', true),
-- Materiais extras para RLS (Status: validated, rejected, merged, inactive)
('e8888881-8888-8888-8888-888888888881', 'Mat Validated', 'MAT VALIDATED', NULL, NULL, NULL, '11111111-1111-1111-1111-111111111111', 'validated', true),
('e8888882-8888-8888-8888-888888888882', 'Mat Pending', 'MAT PENDING', NULL, NULL, NULL, '22222222-2222-2222-2222-222222222222', 'pending_review', true),
('e8888883-8888-8888-8888-888888888883', 'Mat Rejected', 'MAT REJECTED', NULL, NULL, NULL, '11111111-1111-1111-1111-111111111111', 'rejected', true),
('e8888884-8888-8888-8888-888888888884', 'Mat Merged', 'MAT MERGED', NULL, NULL, NULL, '11111111-1111-1111-1111-111111111111', 'merged', true),
('e8888885-8888-8888-8888-888888888885', 'Mat Inactive', 'MAT INACTIVE', NULL, NULL, NULL, '11111111-1111-1111-1111-111111111111', 'validated', false);

-- Reabilitar trigger
ALTER TABLE public.materials ENABLE TRIGGER trg_protect_material_admin_fields;

-- Cenário 1: Vínculo Existente
INSERT INTO public.products (id, organization_id, name, material_id)
VALUES ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Prod C1', 'e1111111-1111-1111-1111-111111111111');

-- Cenário 2: Mesmo fabricante + mesmo código (Dois products de orgs diferentes, C2A e C2B)
INSERT INTO public.products (id, organization_id, sku, name, manufacturer_code, metadata)
VALUES 
('d2222221-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'SKU-A', 'Prod C2A', 'COD-C2', '{"manufacturer": "Fab1"}'),
('d2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'SKU-B', 'Prod C2B', 'COD-C2', '{"manufacturer": "Fab1"}');

-- Cenário 3: Fabricantes diferentes + mesmo código
INSERT INTO public.products (id, organization_id, name, manufacturer_code, metadata)
VALUES 
('d3333331-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'Prod C3A', '123', '{"manufacturer": "Fab A"}'),
('d3333332-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'Prod C3B', '123', '{"manufacturer": "Fab B"}');

-- Cenário 4: Mesmo nome + códigos diferentes
INSERT INTO public.products (id, organization_id, name, manufacturer_code)
VALUES 
('d4444441-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111', 'Produto Teste C4', 'COD-C4A'),
('d4444442-4444-4444-4444-444444444442', '22222222-2222-2222-2222-222222222222', 'Produto Teste C4', 'COD-C4B');

-- Cenário 5: Somente nome (novo pending_review e não reutiliza por nome)
INSERT INTO public.products (id, organization_id, name)
VALUES 
('d5555551-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', 'Mat Validated'); -- Nome igual a um mat existente para provar que não reutiliza

-- Cenário 6: Código único sem fabricante (reutiliza e6666666...)
INSERT INTO public.products (id, organization_id, name, manufacturer_code)
VALUES ('d6666661-6666-6666-6666-666666666661', '11111111-1111-1111-1111-111111111111', 'Prod C6', 'UNICO1');

-- Cenário 7: Código ambíguo sem fabricante (não reutiliza, cria novo)
INSERT INTO public.products (id, organization_id, name, manufacturer_code)
VALUES ('d7777771-7777-7777-7777-777777777771', '11111111-1111-1111-1111-111111111111', 'Prod C7', 'AMBIG');

-- Cenário 8: Material_id nulo e sem match genérico
INSERT INTO public.products (id, organization_id, name)
VALUES ('d8888881-8888-8888-8888-888888888881', '11111111-1111-1111-1111-111111111111', 'Prod C8 Totalmente Novo');
