import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  canMaintainGlobalMaster,
  requiresLinkedMasterForSave,
} from '../src/modules/products/application/policies/materialSaveIntegrity.ts';

const repositoryPath = join(
  process.cwd(),
  'src/modules/products/infrastructure/repositories/SupabaseProductRepository.ts',
);
const formPath = join(
  process.cwd(),
  'src/modules/products/presentation/pages/ProductFormPage.tsx',
);
const rpcMigrationPath = join(
  process.cwd(),
  'supabase/migrations/20260829170936_b1_r6b_mat1b_atomic_tenant_material_save.sql',
);
const reconciliationMigrationPath = join(
  process.cwd(),
  'supabase/migrations/20260829165211_b1_r6b_mat1_reconcile_master_material_categories.sql',
);

test('TENANT_SAVE_DOES_NOT_UPDATE_MASTER', () => {
  assert.equal(canMaintainGlobalMaster(false, false), false);
  assert.equal(canMaintainGlobalMaster(true, false), false);
  assert.equal(canMaintainGlobalMaster(false, true), false);
  assert.equal(canMaintainGlobalMaster(true, true), true);
  assert.equal(requiresLinkedMasterForSave('Active'), true);
  assert.equal(requiresLinkedMasterForSave('Draft'), false);

  const repository = readFileSync(repositoryPath, 'utf8');
  const atomicMethod = repository.slice(
    repository.indexOf('async saveTenantMaterial'),
    repository.indexOf('async delete'),
  );
  assert.match(atomicMethod, /\.rpc\('save_organization_material_product'/u);
  assert.doesNotMatch(atomicMethod, /\.from\('materials'\)/u);

  const form = readFileSync(formPath, 'utf8');
  assert.match(form, /await repo\.saveTenantMaterial\(/u);
  assert.doesNotMatch(form, /from\('organization_materials'\)\.upsert/u);
  assert.match(form, /if \(canEditGlobalMaterial && materialId\)/u);
});

test('ATOMIC_TENANT_MATERIAL_SAVE', () => {
  const migration = readFileSync(rpcMigrationPath, 'utf8');
  assert.match(migration, /security invoker/u);
  assert.match(migration, /insert into public\.products/u);
  assert.match(migration, /insert into public\.organization_materials/u);
  assert.match(migration, /on conflict \(organization_id, material_id\) do update/u);
  assert.doesNotMatch(migration, /update public\.materials/u);
  assert.doesNotMatch(migration, /insert into public\.materials/u);
  assert.match(migration, /grant execute on function[\s\S]*to authenticated;/u);
});

test('MAT1_GATES_BY_CATEGORY_INVARIANTS_NOT_TENANT_LINK_COUNT', () => {
  const migration = readFileSync(reconciliationMigrationPath, 'utf8');
  assert.match(migration, /v_category_conflict <> 0/u);
  assert.match(migration, /v_no_category_evidence <> 0/u);
  assert.match(migration, /v_safe_single_category <> v_master_category_null/u);
  assert.doesNotMatch(migration, /organization_materials_count/u);
  assert.doesNotMatch(migration, /EXPECTED=69/u);
});
