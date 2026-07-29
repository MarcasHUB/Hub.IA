-- Migration: YYYYMMDDHHMMSS_refactor_material_master_and_supplier_base.sql
-- Descrição: Adiciona os campos B2B nas tabelas `products` e `product_suppliers` mantendo a retrocompatibilidade (RC e RCD).

-- 1. Modificando tabela 'products'
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS manufacturer_code text,
ADD COLUMN IF NOT EXISTS available_for_purchase boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS available_for_sale boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS image_url text;

-- Atualizar registros existentes para não quebrar UI com NULLs no booleano se por acaso o Supabase for estrito:
UPDATE public.products SET available_for_purchase = true WHERE available_for_purchase IS NULL;
UPDATE public.products SET available_for_sale = false WHERE available_for_sale IS NULL;

-- 2. Modificando tabela 'product_suppliers' (vínculo Produto x Fornecedor)
ALTER TABLE public.product_suppliers
ADD COLUMN IF NOT EXISTS supplier_code text,
ADD COLUMN IF NOT EXISTS supplier_product_name text,
ADD COLUMN IF NOT EXISTS purchase_unit text,
ADD COLUMN IF NOT EXISTS moq numeric,
ADD COLUMN IF NOT EXISTS lead_time_days integer,
ADD COLUMN IF NOT EXISTS has_contract boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_preferred_supplier boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_negotiated_price numeric,
ADD COLUMN IF NOT EXISTS last_purchase_date date,
ADD COLUMN IF NOT EXISTS notes text;

-- 3. Ajuste de Constraints se necessário
-- Evitando que a query quebre por falta de colunas, os selects devem contemplar esses campos (o backend já usa "select *", então vai ler normal).

-- FIM DA MIGRATION
