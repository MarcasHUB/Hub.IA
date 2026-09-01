import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260831021600_r6_3b_optional_company_codes.sql'),
  'utf8',
);
const repository = readFileSync(
  join(process.cwd(), 'src/modules/products/infrastructure/repositories/SupabaseProductRepository.ts'),
  'utf8',
);
const linkMaterialModal = readFileSync(
  join(process.cwd(), 'src/modules/products/presentation/components/LinkMaterialModal.tsx'),
  'utf8',
);
const baseline = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260728000000_remote_baseline.sql'),
  'utf8',
);
const quotationMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260829181906_b1_r6_quotation_rpc_ambiguity_forward_fix.sql'),
  'utf8',
);
const productInsertPayload = linkMaterialModal.match(
  /\.from\('products'\)\.insert\(\{(?<payload>[\s\S]*?)\n\s*\}\);/u,
)?.groups?.payload || '';

test('new organization link accepts missing company and ERP codes', () => {
  assert.doesNotMatch(migration, /p_category_id is null\s+or nullif\(pg_catalog\.btrim\(p_internal_sku\)/u);
  assert.doesNotMatch(migration, /p_category_id is null\s+or nullif\(pg_catalog\.btrim\(p_erp_code\)/u);
  assert.match(migration, /internal_sku text default null/u);
  assert.match(migration, /erp_code text default null/u);
});

test('omitted codes preserve legacy values while explicit empty values normalize to null', () => {
  assert.match(migration, /p_internal_sku_provided boolean default false/u);
  assert.match(migration, /p_erp_code_provided boolean default false/u);
  assert.match(migration, /else target_organization_material\.internal_sku/u);
  assert.match(migration, /else target_organization_material\.erp_code/u);
  assert.match(migration, /nullif\(pg_catalog\.btrim\(p_internal_sku\), ''\)/u);
  assert.match(migration, /nullif\(pg_catalog\.btrim\(p_erp_code\), ''\)/u);
  assert.doesNotMatch(migration, /update public\.organization_materials|update public\.products/u);
});

test('repository changes only the canonical company code and leaves ERP omitted', () => {
  assert.match(repository, /const internalSkuProvided = organizationMaterial\?\.internalSkuProvided \?\? Boolean\(organizationMaterial\)/u);
  assert.match(repository, /internalSkuProvided\s*\?\s*\{[\s\S]*p_internal_sku: organizationMaterial\?\.internalSku\?\.trim\(\) \|\| null,[\s\S]*p_internal_sku_provided: true,[\s\S]*\}\s*:\s*\{ p_internal_sku_provided: false \}/u);
  assert.match(repository, /\.\.\.organizationCodeParams/u);
  assert.match(repository, /p_erp_code_provided: false/u);
  assert.doesNotMatch(repository, /p_erp_code:/u);
});

test('direct linking accepts an optional company code without fabricating legacy codes', () => {
  assert.match(linkMaterialModal, /internal_sku: internalSku\.trim\(\) \|\| null/u);
  assert.doesNotMatch(linkMaterialModal, /erp_code:/u);
  assert.doesNotMatch(productInsertPayload, /\bsku:/u);
  assert.doesNotMatch(linkMaterialModal, /&& internalSku\.trim\(\)/u);
});

test('different organizations can keep distinct codes for the same material', () => {
  assert.match(baseline, /ADD CONSTRAINT "organization_materials_unique" UNIQUE \("organization_id", "material_id"\)/u);
  assert.doesNotMatch(baseline, /UNIQUE \("internal_sku"\)|UNIQUE \("erp_code"\)/u);
});

test('legacy product codes are preserved rather than consolidated', () => {
  assert.doesNotMatch(migration, /update public\.products|set\s+erp_code|erp_code\s*=\s*internal_sku/iu);
  assert.doesNotMatch(productInsertPayload, /\bsku:|\berp_code:/u);
});

test('tenant isolation and quotation snapshots remain intact', () => {
  assert.match(migration, /current_authenticated_organization_id\(\)/u);
  assert.match(migration, /where target_product\.organization_id = v_organization_id/u);
  assert.match(migration, /on conflict \(organization_id, material_id\)/u);
  assert.match(quotationMigration, /manufacturer_code_snapshot/u);
  assert.match(quotationMigration, /internal_sku_snapshot/u);
  assert.match(quotationMigration, /coalesce\(om\.internal_sku, product\.sku\)/u);
  assert.match(migration, /v_old_fragment constant text := 'coalesce\(om\.internal_sku, product\.sku\)'/u);
  assert.match(migration, /v_new_fragment constant text := 'om\.internal_sku'/u);
  assert.match(migration, /organization_material\.internal_sku,\\n {12}product\.sku/u);
  assert.match(migration, /organization_material\.internal_sku\\n {10}\)'/u);
  assert.match(migration, /quotation internal SKU snapshot definition drifted/u);
  assert.match(migration, /quotation AI internal SKU definition drifted/u);
});
