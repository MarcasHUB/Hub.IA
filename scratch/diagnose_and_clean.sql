-- ====================================================================
-- SCRIPT DE DIAGNÓSTICO E LIMPEZA DE MATERIAIS FICTÍCIOS (AJUSTADO)
-- ====================================================================
-- NOTA: Execute este script no SQL Editor do Painel do Supabase
-- para obter o diagnóstico completo e realizar a inativação ou
-- limpeza com privilégios de superusuário (bypassing RLS).

-- ────────────────────────────────────────────────────────────────────
-- 0. VALIDAÇÃO DE COLUNAS E ENUMS (PASSO PRELIMINAR)
-- ────────────────────────────────────────────────────────────────────
-- Verifica se a coluna 'status' existe na tabela 'products'
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'status';

-- Verifica os valores aceitos pelo ENUM 'product_status'
SELECT enumlabel 
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'product_status';


-- ────────────────────────────────────────────────────────────────────
-- 1. CONSULTA DE TRIAGEM (DIAGNÓSTICO)
-- ────────────────────────────────────────────────────────────────────
-- Busca por registros suspeitos contendo padrões de teste/mock/demo com COALESCE
SELECT 
  p.id AS "ID do Material",
  p.sku AS "SKU",
  p.name AS "Nome do Material",
  p.manufacturer_code AS "Código do Fabricante",
  p.uom AS "Unidade",
  p.price AS "Preço Ref",
  p.status AS "Status",
  p.available_for_purchase AS "Compra Ativa",
  p.created_at AS "Data de Criação",
  (SELECT count(*) FROM public.product_suppliers ps WHERE ps.product_id = p.id) AS "Qtd Fornecedores Vinculados",
  (SELECT count(*) FROM public.quotation_items qi WHERE qi.product_id = p.id) AS "Qtd Vínculos RC/RCD"
FROM public.products p
WHERE 
  lower(coalesce(p.name, '')) LIKE '%teste%' OR
  lower(coalesce(p.name, '')) LIKE '%mock%' OR
  lower(coalesce(p.name, '')) LIKE '%demo%' OR
  lower(coalesce(p.name, '')) LIKE '%exemplo%' OR
  lower(coalesce(p.name, '')) LIKE '%fict%' OR
  lower(coalesce(p.name, '')) LIKE '%sample%' OR
  lower(coalesce(p.sku, '')) LIKE '%test%' OR
  lower(coalesce(p.sku, '')) LIKE '%mock%' OR
  lower(coalesce(p.sku, '')) LIKE '%demo%' OR
  lower(coalesce(p.manufacturer_code, '')) LIKE '%test%' OR
  lower(coalesce(p.manufacturer_code, '')) LIKE '%mock%'
ORDER BY p.created_at DESC;


-- ────────────────────────────────────────────────────────────────────
-- 2. ESTRATÉGIA RECOMENDADA (INATIVAÇÃO SEGURA)
-- ────────────────────────────────────────────────────────────────────
-- Desativa os produtos identificados como fictícios, impedindo novas
-- compras/vendas e visualizações no catálogo, mas mantendo a integridade
-- histórica caso já estejam associados a alguma Cotação/RC antiga.

-- [ATUALIZAÇÃO DE STATUS - SEGURA]
-- Para executar, selecione e execute o bloco abaixo após autorização:
/*
UPDATE public.products
SET 
  available_for_purchase = false,
  available_for_sale = false,
  status = 'Inactive'::product_status -- se a coluna status usar o enum product_status
WHERE 
  lower(coalesce(name, '')) LIKE '%teste%' OR
  lower(coalesce(name, '')) LIKE '%mock%' OR
  lower(coalesce(name, '')) LIKE '%demo%' OR
  lower(coalesce(name, '')) LIKE '%exemplo%' OR
  lower(coalesce(name, '')) LIKE '%fict%' OR
  lower(coalesce(name, '')) LIKE '%sample%' OR
  lower(coalesce(sku, '')) LIKE '%test%' OR
  lower(coalesce(sku, '')) LIKE '%mock%' OR
  lower(coalesce(sku, '')) LIKE '%demo%' OR
  lower(coalesce(manufacturer_code, '')) LIKE '%test%' OR
  lower(coalesce(manufacturer_code, '')) LIKE '%mock%';
*/


-- ────────────────────────────────────────────────────────────────────
-- 3. EXCLUSÃO FÍSICA (SOMENTE SE NÃO HOUVER VÍNCULO COM HISTÓRICO DE COMPRAS)
-- ────────────────────────────────────────────────────────────────────
-- IMPORTANTE: Executar somente para registros que NÃO estejam vinculados a 
-- cotações reais ou itens de cotação antigos (onde count de vínculos = 0).

-- [EXCLUSÃO DE VÍNCULOS COM FORNECEDORES DE PRODUTOS MOCK]
/*
DELETE FROM public.product_suppliers
WHERE product_id IN (
  SELECT id FROM public.products
  WHERE 
    (lower(coalesce(name, '')) LIKE '%teste%' OR
     lower(coalesce(name, '')) LIKE '%mock%' OR
     lower(coalesce(name, '')) LIKE '%demo%' OR
     lower(coalesce(name, '')) LIKE '%exemplo%' OR
     lower(coalesce(name, '')) LIKE '%fict%' OR
     lower(coalesce(name, '')) LIKE '%sample%' OR
     lower(coalesce(sku, '')) LIKE '%test%' OR
     lower(coalesce(sku, '')) LIKE '%mock%' OR
     lower(coalesce(sku, '')) LIKE '%demo%' OR
     lower(coalesce(manufacturer_code, '')) LIKE '%test%' OR
     lower(coalesce(manufacturer_code, '')) LIKE '%mock%')
    AND id NOT IN (SELECT DISTINCT product_id FROM public.quotation_items)
);
*/

-- [EXCLUSÃO FÍSICA DO MATERIAL DO CADASTRO MASTER]
/*
DELETE FROM public.products
WHERE 
  (lower(coalesce(name, '')) LIKE '%teste%' OR
   lower(coalesce(name, '')) LIKE '%mock%' OR
   lower(coalesce(name, '')) LIKE '%demo%' OR
   lower(coalesce(name, '')) LIKE '%exemplo%' OR
   lower(coalesce(name, '')) LIKE '%fict%' OR
   lower(coalesce(name, '')) LIKE '%sample%' OR
   lower(coalesce(sku, '')) LIKE '%test%' OR
   lower(coalesce(sku, '')) LIKE '%mock%' OR
   lower(coalesce(sku, '')) LIKE '%demo%' OR
   lower(coalesce(manufacturer_code, '')) LIKE '%test%' OR
   lower(coalesce(manufacturer_code, '')) LIKE '%mock%')
  AND id NOT IN (SELECT DISTINCT product_id FROM public.quotation_items);
*/
