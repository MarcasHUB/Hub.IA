import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const router = readFileSync(join(root, 'src/kernel/router/index.tsx'), 'utf8');
const list = readFileSync(join(root, 'src/modules/quotations/presentation/pages/QuotationsListPage.tsx'), 'utf8');
const details = readFileSync(join(root, 'src/modules/quotations/presentation/pages/QuotationDetailsPage.tsx'), 'utf8');
const comparison = readFileSync(join(root, 'src/modules/quotations/presentation/pages/QuotationComparisonPage.tsx'), 'utf8');
const reader = readFileSync(join(root, 'src/modules/quotations/infrastructure/repositories/SupabaseQuotationReadRepository.ts'), 'utf8');

test('quotation details route and list actions remain separate from comparison', () => {
  assert.match(router, /path: '\/quotations\/:id'/u);
  assert.match(router, /<QuotationDetailsPage/u);
  assert.match(router, /path: '\/quotations\/:id\/compare'/u);
  assert.match(list, /navigate\(`\/quotations\/\$\{row\.id\}`\)/u);
  assert.match(list, />Ver detalhes</u);
  assert.match(list, /navigate\(`\/quotations\/\$\{row\.id\}\/compare`\)/u);
  assert.match(list, />Comparar propostas</u);
});

test('details renders persisted snapshots and an independent recipient empty state', () => {
  for (const field of [
    'product_name_snapshot',
    'manufacturer_name_snapshot',
    'manufacturer_code_snapshot',
    'internal_sku_snapshot',
    'description_snapshot',
    'category_name_snapshot',
    'quantity',
    'unit_snapshot',
  ]) assert.match(details, new RegExp(field, 'u'));
  assert.match(details, /Nenhum destinatário foi registrado para esta cotação\./u);
  assert.doesNotMatch(details, /MOCK_DATA|localStorage/u);
});

test('items render before and independently from the proposal empty state', () => {
  const itemsSection = comparison.indexOf('Itens da cotação');
  const proposalCondition = comparison.indexOf('proposals.length === 0');
  assert.ok(itemsSection >= 0);
  assert.ok(proposalCondition > itemsSection);
  assert.match(comparison, /Nenhuma proposta persistida\./u);
  assert.doesNotMatch(comparison, /MOCK_DATA|localStorage/u);
});

test('shared quotation reader is read-only and uses persisted canonical tables', () => {
  assert.match(reader, /\.from\('quotation_requests'\)/u);
  assert.match(reader, /\.from\('quotation_items'\)/u);
  assert.match(reader, /\.from\('supplier_quotations'\)/u);
  assert.doesNotMatch(reader, /\.(insert|update|upsert|delete|rpc)\(/u);
});
