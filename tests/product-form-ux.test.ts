import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  getLegacyAttachments,
  getMissingGlobalIdentificationFields,
  getPrimaryAttachment,
  calculateGlobalEnrichmentPercentage,
  needsManufacturerPairGuidance,
  replacePrimaryAttachment,
  resolveProductImageUrl,
  resolveProductStatusForSave,
  validateBasicProductInput,
  type ProductAttachment,
} from '../src/modules/products/application/policies/productFormUx.ts';

const productFormSource = readFileSync(
  join(process.cwd(), 'src/modules/products/presentation/pages/ProductFormPage.tsx'),
  'utf8',
);
const productRepositorySource = readFileSync(
  join(process.cwd(), 'src/modules/products/infrastructure/repositories/SupabaseProductRepository.ts'),
  'utf8',
);
const adminSectionIndex = productFormSource.indexOf('{canEditGlobalMaterial && (');
const companyFormSource = productFormSource.slice(0, adminSectionIndex);

const legacyAttachments: ProductAttachment[] = [
  { type: 'Catálogo', filename: 'catalogo.pdf', base64: 'data:application/pdf;base64,AAA', uploadedAt: '2026-01-01T00:00:00.000Z', user: 'A' },
  { type: 'Desenho', filename: 'desenho.png', base64: 'data:image/png;base64,BBB', uploadedAt: '2026-01-02T00:00:00.000Z', user: 'B' },
  { type: 'Ficha técnica', filename: 'ficha.pdf', base64: 'data:application/pdf;base64,CCC', uploadedAt: '2026-01-03T00:00:00.000Z', user: 'C' },
];

test('A: incomplete global identification remains a draft', () => {
  assert.deepEqual(validateBasicProductInput({
    name: 'Material genérico',
    categoryId: '',
    unit: 'UN',
  }), []);
  assert.equal(needsManufacturerPairGuidance('', ''), false);
  assert.deepEqual(getMissingGlobalIdentificationFields({
    name: 'Material genérico', categoryId: 'category-id', unit: 'UN', manufacturer: '', manufacturerCode: '',
  }), ['Fabricante/Marca', 'Código do fabricante / SKU do fabricante']);
  assert.equal(resolveProductStatusForSave('Active', 'material-id', false), 'Draft');
  assert.match(productFormSource, /Nome do produto\/material \*/u);
  assert.match(productFormSource, /Categoria \*/u);
  assert.match(productFormSource, /Unidade \*/u);
});

test('B: identified industrial product requires one manufacturer code and supports one primary file', () => {
  const primary: ProductAttachment = {
    type: 'Arquivo principal',
    filename: 'produto.png',
    base64: 'data:image/png;base64,DDD',
    uploadedAt: '2026-01-04T00:00:00.000Z',
    user: 'D',
  };
  const merged = replacePrimaryAttachment(legacyAttachments, primary);

  assert.equal(getPrimaryAttachment(merged)?.filename, 'produto.png');
  assert.equal(getLegacyAttachments(merged).length, 3);
  assert.equal(needsManufacturerPairGuidance('Ironhoof', ''), true);
  assert.equal(needsManufacturerPairGuidance('Ironhoof', 'CYBR037RD'), false);
  assert.match(productFormSource, /Código do fabricante \/ SKU do fabricante \*/u);
  assert.match(productFormSource, /Código interno da empresa/u);
  assert.doesNotMatch(companyFormSource, /SKU interno|Código ERP|Código-pai/u);
  assert.match(productFormSource, /accept="\.pdf,\.jpg,\.jpeg,\.png,application\/pdf,image\/jpeg,image\/png"/u);
});

test('company code is excluded from global enrichment and manufacturer fields define identification', () => {
  const identified = {
    name: 'Chave de impacto', categoryId: 'category-id', unit: 'UN', manufacturer: 'Ironhoof', manufacturerCode: 'CYBR037RD',
  };
  assert.deepEqual(getMissingGlobalIdentificationFields(identified), []);
  assert.equal(calculateGlobalEnrichmentPercentage({ ...identified, description: 'Industrial', hasAttachment: true }), 100);
  assert.equal(calculateGlobalEnrichmentPercentage({ ...identified, description: '', hasAttachment: false }), 71);
  assert.equal(resolveProductStatusForSave('Active', 'material-id', true), 'Active');
  assert.match(productFormSource, /Código usado por esta empresa para identificar o produto em suas operações de compra ou venda\./u);
  assert.doesNotMatch(companyFormSource, /Descrição técnica complementar|part number/iu);
});

test('C: company form hides technical pending status while admin governance keeps it', () => {
  assert.ok(adminSectionIndex > 0);
  assert.doesNotMatch(companyFormSource, /Material Global Pendente/u);
  assert.match(productFormSource.slice(adminSectionIndex), /Material Global Pendente/u);
  assert.match(productFormSource, /Governança do catálogo — Admin Global/u);
  assert.match(productFormSource, /Encontramos produtos semelhantes/u);
  assert.match(productFormSource, /Confirme qual corresponde ao seu produto\./u);
});

test('D: three legacy attachments remain accessible when a primary file is added', () => {
  const nextPrimary: ProductAttachment = {
    type: 'Arquivo principal',
    filename: 'principal.pdf',
    base64: 'data:application/pdf;base64,DDD',
    uploadedAt: '2026-01-04T00:00:00.000Z',
    user: 'D',
  };
  const result = replacePrimaryAttachment(legacyAttachments, nextPrimary);

  assert.deepEqual(getLegacyAttachments(result), legacyAttachments);
  assert.equal(result.length, 4);
  assert.match(productFormSource, /Arquivos anteriores/u);
  assert.doesNotMatch(companyFormSource, /\['Catálogo', 'Desenho', 'Ficha técnica'\]/u);
});

test('E: simplified product form does not mutate quotation snapshots', () => {
  assert.doesNotMatch(productFormSource, /\.from\('quotation_items'\).*(?:update|upsert|delete)/su);
  assert.doesNotMatch(productFormSource, /material_id_snapshot|organization_material_id_snapshot/u);
});

test('original screen and seven tabs are preserved while fields are simplified inside them', () => {
  assert.match(productFormSource, /const \[activeTab, setActiveTab\] = useState\('basic'\)/u);
  for (const label of [
    'Informações Básicas',
    'Classificação',
    'Comercial',
    'Logística',
    'Base de Abastecimento do Material',
    'Documentos',
    'Histórico',
  ]) assert.match(productFormSource, new RegExp(label, 'u'));
  assert.match(productFormSource, /max-w-\[1600px\]/u);
  assert.match(productFormSource, /activeTab === 'documents'.*Selecionar arquivo principal/su);
  assert.doesNotMatch(productFormSource, /Mais detalhes — opcional/u);
});

test('editing preserves organization material configuration hidden behind optional details', () => {
  assert.match(productFormSource, /\.from\('organization_materials'\)/u);
  assert.match(productFormSource, /commercialConfig: \{ \.\.\.persistedCommercialConfig, \.\.\.commercial \}/u);
  assert.match(productFormSource, /logisticsConfig: \{ \.\.\.persistedLogisticsConfig, \.\.\.logistics \}/u);
  assert.match(productFormSource, /persistedRelationshipType \|\|/u);
  assert.match(productFormSource, /setPersistedCompanyInternalCode\(organizationMaterial\.internal_sku \|\| ''\)/u);
  assert.match(productFormSource, /basicInfo\.companyInternalCode\.trim\(\) !== persistedCompanyInternalCode\.trim\(\)/u);
});

test('identified new product creates or reuses a governed material before the tenant link', () => {
  assert.match(productFormSource, /if \(!materialId && missingGlobalIdentificationFields\.length === 0\)/u);
  assert.match(productFormSource, /validation_status: 'pending_review'/u);
  assert.match(productFormSource, /master_owner_organization_id: tenantId/u);
  assert.match(productFormSource, /created_by: authData\.user\.id/u);
  assert.match(productFormSource, /repo\.saveTenantMaterial\(product/u);
});

test('documents upload separates primary and auxiliary text and translates download action', () => {
  assert.match(productFormSource, /flex w-full flex-col items-center justify-center gap-2/u);
  assert.match(productFormSource, />PDF, JPG, JPEG ou PNG</u);
  assert.match(productFormSource, />Baixar<\/a>/u);
  assert.doesNotMatch(productFormSource, />Download<\/a>|Lead Time/u);
});

test('product list reads the company code from the organization link without legacy product SKU fallback', () => {
  const productsListSource = readFileSync(
    join(process.cwd(), 'src/modules/products/presentation/pages/ProductsListPage.tsx'),
    'utf8',
  );
  assert.match(productsListSource, /\.from\('organization_materials'\)/u);
  assert.match(productsListSource, /internal_sku/u);
  assert.match(productsListSource, /Cód\. interno/u);
  assert.match(productsListSource, /Não informado/u);
  assert.doesNotMatch(productsListSource, /SKU Forn\.|internalCodeByMaterial\.get\(p\.materialId\)[^\n]*p\.sku/u);
});

test('PRODUCT_IMAGE_UPLOAD_VISIBLE: historical image selector and preview remain available', () => {
  assert.match(productFormSource, /Foto do Produto \(Local\)/u);
  assert.match(productFormSource, /onClick=\{\(\) => imageFileInputRef\.current\?\.click\(\)\}/u);
  assert.match(productFormSource, /accept="image\/\*"/u);
  assert.match(productFormSource, /onChange=\{handleImageUpload\}/u);
  assert.match(productFormSource, /src=\{basicInfo\.imageUrl\} alt="Preview da imagem do produto"/u);
  assert.match(productFormSource, /URL da imagem \(Opcional\)/u);
});

test('EXISTING_IMAGE_PRESERVED_ON_UNRELATED_EDIT: loaded image flows unchanged into save', () => {
  assert.match(productFormSource, /imageUrl: product\.imageUrl \|\| ''/u);
  assert.match(productFormSource, /setPersistedImageUrl\(product\.imageUrl \|\| ''\)/u);
  assert.match(productFormSource, /resolveProductImageUrl\(basicInfo\.imageUrl, persistedImageUrl, imageUrlChanged\)/u);
  assert.match(productRepositorySource, /row\.image_url \|\| meta\.image_url \|\| ''/u);
});

test('IMAGE_URL_NOT_CLEARED_WHEN_OMITTED: repository persists the form image value', () => {
  assert.equal(resolveProductImageUrl('', 'https://example.com/existing.png', false), 'https://example.com/existing.png');
  assert.equal(resolveProductImageUrl('', 'https://example.com/existing.png', true), '');
  assert.equal(resolveProductImageUrl('data:image/png;base64,NEW', 'https://example.com/existing.png', true), 'data:image/png;base64,NEW');
  assert.match(productRepositorySource, /p_image_url: product\.imageUrl \|\| null/u);
  assert.match(productRepositorySource, /image_url: product\.imageUrl/u);
  assert.match(productFormSource, /setImageUrlChanged\(true\)/u);
});
