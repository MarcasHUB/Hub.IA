export interface OrganizationProfileCompletionInput {
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  emailCorporativo?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;

  addressZipCode?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressNeighborhood?: string | null;
  city?: string | null;
  state?: string | null;

  logoUrl?: string | null;
  website?: string | null;

  tipoEmpresa?: string | null;
  perfilComercial?: string | null;
  cnaePrincipal?: string | null;

  geographicCoverageType?: string | null;
  raioAtendimentoKm?: number | string | null;
  estadosAtendidos?: string[];

  segmentIds?: string[];
}

export function hasMeaningfulValue(value?: string | null): boolean {
  return value !== undefined && value !== null && value.trim().length > 0;
}

export function hasValidCnae(value?: string | null): boolean {
  if (!value) return false;

  const normalized = value.trim().toLowerCase();

  if (
    normalized === 'preenchido via cnpj' ||
    normalized === 'não informado' ||
    normalized === 'nao informado'
  ) {
    return false;
  }

  // Se tiver pelo menos um dígito
  return /\d/.test(normalized);
}

export function calculateAddressScore(
  zipCode?: string | null,
  street?: string | null,
  number?: string | null,
  neighborhood?: string | null,
  city?: string | null,
  state?: string | null
): number {
  const addressFields = [
    zipCode,
    street,
    number,
    neighborhood,
    city,
    state,
  ];

  const validAddressFields = addressFields.filter(hasMeaningfulValue).length;
  // Regra definida: Proporcional de 10%
  const addressScore = Math.round((validAddressFields / addressFields.length) * 10);
  return addressScore;
}

export function calculateCoverageScore(
  coverageType?: string | null,
  radius?: number | string | null,
  states?: string[]
): number {
  if (!hasMeaningfulValue(coverageType)) return 0;
  
  const typeStr = coverageType!.trim().toLowerCase();
  
  const hasRadius = radius !== undefined && radius !== null && Number(radius) > 0;
  const hasState = Array.isArray(states) && states.length > 0;

  let isComplete = false;

  if (typeStr === 'local') {
    isComplete = true; // Basta o tipo
  } else if (typeStr === 'regional') {
    isComplete = hasRadius || hasState;
  } else if (typeStr === 'estadual') {
    isComplete = hasState;
  } else if (typeStr === 'nacional') {
    isComplete = true; // Não exige listar todos os estados
  }

  // Se completou a regra da cobertura e informou o tipo, ganha os 11%
  return isComplete ? 11 : 0;
}

export function calculateOrganizationProfileCompletion(data: OrganizationProfileCompletionInput): number {
  let score = 0;

  // DADOS GERAIS (Total máximo: 55%)
  if (hasMeaningfulValue(data.razaoSocial)) score += 8;
  if (hasMeaningfulValue(data.nomeFantasia)) score += 4;
  if (hasMeaningfulValue(data.cnpj)) score += 8;
  if (hasMeaningfulValue(data.emailCorporativo)) score += 5;
  if (hasMeaningfulValue(data.telefone) || hasMeaningfulValue(data.whatsapp)) score += 5;
  if (hasMeaningfulValue(data.logoUrl)) score += 8;
  if (hasMeaningfulValue(data.website)) score += 7;
  
  score += calculateAddressScore(
    data.addressZipCode,
    data.addressStreet,
    data.addressNumber,
    data.addressNeighborhood,
    data.city,
    data.state
  );

  // INFORMAÇÕES COMERCIAIS (Total máximo: 45%)
  if (hasMeaningfulValue(data.tipoEmpresa)) score += 6;
  if (hasMeaningfulValue(data.perfilComercial)) score += 6;
  
  if (hasValidCnae(data.cnaePrincipal)) score += 10;
  
  score += calculateCoverageScore(
    data.geographicCoverageType,
    data.raioAtendimentoKm,
    data.estadosAtendidos
  );

  const hasSegments = Array.isArray(data.segmentIds) && data.segmentIds.length > 0;
  if (hasSegments) score += 12;

  return Math.max(0, Math.min(100, Math.round(score)));
}
