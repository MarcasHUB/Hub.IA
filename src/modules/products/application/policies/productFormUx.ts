export type ProductAttachment = {
  type: string;
  filename: string;
  base64: string;
  uploadedAt: string;
  user: string;
};

export type BasicProductInput = {
  name: string;
  categoryId: string;
  unit: string;
};

export type GlobalProductIdentificationInput = BasicProductInput & {
  manufacturer: string;
  manufacturerCode: string;
};

export type GlobalProductEnrichmentInput = GlobalProductIdentificationInput & {
  description: string;
  hasAttachment: boolean;
};

export function validateBasicProductInput(input: BasicProductInput): string[] {
  const missing: string[] = [];
  if (!input.name.trim()) missing.push('Nome do produto/material');
  if (!input.unit.trim()) missing.push('Unidade');
  return missing;
}

export function getMissingGlobalIdentificationFields(
  input: GlobalProductIdentificationInput,
): string[] {
  return [
    ...validateBasicProductInput(input),
    ...(!input.categoryId.trim() ? ['Categoria'] : []),
    ...(!input.manufacturer.trim() ? ['Fabricante/Marca'] : []),
    ...(!input.manufacturerCode.trim() ? ['Código do fabricante / SKU do fabricante'] : []),
  ];
}

export function calculateGlobalEnrichmentPercentage(
  input: GlobalProductEnrichmentInput,
): number {
  const completed = [
    input.name,
    input.categoryId,
    input.unit,
    input.manufacturer,
    input.manufacturerCode,
    input.description,
  ].filter(value => value.trim()).length + Number(input.hasAttachment);
  return Math.round((completed / 7) * 100);
}

export function resolveProductStatusForSave(
  requestedStatus: string,
  materialId: string,
  hasCompleteGlobalIdentification = true,
): 'Active' | 'Draft' {
  if (!materialId || !hasCompleteGlobalIdentification) return 'Draft';
  return requestedStatus === 'Draft' ? 'Draft' : 'Active';
}

export function replacePrimaryAttachment(
  existing: ProductAttachment[],
  next: ProductAttachment,
): ProductAttachment[] {
  return [
    ...existing.filter(attachment => attachment.type !== 'Arquivo principal'),
    next,
  ];
}

export function getPrimaryAttachment(
  attachments: ProductAttachment[],
): ProductAttachment | undefined {
  return attachments.find(attachment => attachment.type === 'Arquivo principal');
}

export function getLegacyAttachments(
  attachments: ProductAttachment[],
): ProductAttachment[] {
  return attachments.filter(attachment => attachment.type !== 'Arquivo principal');
}

export function needsManufacturerPairGuidance(
  manufacturer: string,
  manufacturerCode: string,
): boolean {
  return Boolean(manufacturer.trim()) !== Boolean(manufacturerCode.trim());
}

export function resolveProductImageUrl(
  currentImageUrl: string,
  persistedImageUrl: string,
  imageChanged: boolean,
): string {
  return imageChanged ? currentImageUrl : currentImageUrl || persistedImageUrl;
}
