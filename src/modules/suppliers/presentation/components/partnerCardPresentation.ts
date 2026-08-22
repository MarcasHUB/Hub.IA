import type { PublicOrganizationProfile } from '@/modules/organizations/domain/entities/PublicOrganizationProfile';

export type PartnerCardStatus = 'accepted' | 'pending_sent' | 'pending_received';

export interface PartnerCardSource {
  name: string;
  document: string;
  segment: string | string[];
  city: string;
  state: string;
  status: PartnerCardStatus;
  since?: string;
  phone?: string;
  email?: string;
  website?: string;
  rating: number;
  responseTime: string;
  products: string[];
  perfil_comercial?: string;
  tipo_empresa?: string;
  raio_atendimento_km?: number | null;
  certifications?: string;
}

export interface PartnerCardPresentation {
  isActivePartner: boolean;
  displayName: string;
  corporateName: string | null;
  document: string | null;
  roleLabel: string | null;
  location: string | null;
  segments: string[];
  products: string[];
  certifications: string[];
  serviceRadiusKm: number | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  since: string | null;
  rating: number | null;
  responseTime: string | null;
  logoUrl: string | null;
  profileStatus: string | null;
}

const EMPTY_VALUES = new Set([
  '-',
  'não definido',
  'nao definido',
  'não informado',
  'nao informado',
  'n/a',
  'null',
  'undefined',
]);

export function cleanPartnerValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || EMPTY_VALUES.has(normalized.toLocaleLowerCase('pt-BR'))) return null;
  return normalized;
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const cleaned = cleanPartnerValue(value);
    if (!cleaned) return;
    const key = cleaned.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) return;
    seen.add(key);
    result.push(cleaned);
  });

  return result;
}

export function splitPartnerValues(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return uniqueValues(value);
  const cleaned = cleanPartnerValue(value);
  if (!cleaned) return [];
  return uniqueValues(cleaned.split(',').map((entry) => entry.trim()));
}

export function getPartnerRoleLabel(value: string | null | undefined): string | null {
  const role = cleanPartnerValue(value);
  if (!role) return null;

  const normalized = role.toLocaleLowerCase('pt-BR');
  if (normalized === 'buyer' || normalized === 'comprador') return 'Comprador';
  if (normalized === 'seller' || normalized === 'fornecedor') return 'Fornecedor';
  if (normalized === 'both' || normalized === 'ambos' || normalized === 'comprador e fornecedor') {
    return 'Comprador & Fornecedor';
  }

  return role;
}

export function buildPartnerCardPresentation(
  partner: PartnerCardSource,
  profile?: PublicOrganizationProfile | null,
): PartnerCardPresentation {
  const isActivePartner = partner.status === 'accepted';
  const displayName = cleanPartnerValue(profile?.tradeName) || cleanPartnerValue(partner.name) || 'Empresa';
  const legalName = cleanPartnerValue(profile?.legalName);
  const partnerSegments = splitPartnerValues(partner.segment);
  const publicSegments = profile?.segments?.map((segment) => segment.name) || [];
  const segments = uniqueValues([...publicSegments, ...partnerSegments]);

  const city = cleanPartnerValue(profile?.city) || cleanPartnerValue(partner.city);
  const state = cleanPartnerValue(profile?.state) || cleanPartnerValue(partner.state);
  const location = [city, state].filter(Boolean).join(' / ') || null;

  const role = profile?.commercialProfile
    || profile?.companyType
    || partner.perfil_comercial
    || partner.tipo_empresa;

  const products = isActivePartner
    ? uniqueValues([
        ...(profile?.productsAndServices?.map((product) => product.name) || []),
        ...partner.products,
      ])
    : [];

  const certifications = isActivePartner
    ? uniqueValues([
        ...(profile?.certifications?.map((certification) => certification.name) || []),
        ...splitPartnerValues(partner.certifications),
      ])
    : [];

  const responseTime = isActivePartner ? cleanPartnerValue(partner.responseTime) : null;

  return {
    isActivePartner,
    displayName,
    corporateName: isActivePartner && legalName && legalName !== displayName ? legalName : null,
    document: cleanPartnerValue(partner.document),
    roleLabel: getPartnerRoleLabel(role),
    location,
    segments,
    products,
    certifications,
    serviceRadiusKm: isActivePartner
      ? (profile?.serviceRadiusKm ?? partner.raio_atendimento_km ?? null)
      : null,
    email: isActivePartner ? cleanPartnerValue(profile?.businessEmail || partner.email) : null,
    phone: isActivePartner ? cleanPartnerValue(profile?.phone || partner.phone) : null,
    website: isActivePartner ? cleanPartnerValue(profile?.website || partner.website) : null,
    since: isActivePartner ? cleanPartnerValue(partner.since) : null,
    rating: isActivePartner && Number.isFinite(partner.rating) && partner.rating > 0
      ? partner.rating
      : null,
    responseTime,
    logoUrl: cleanPartnerValue(profile?.logoUrl),
    profileStatus: cleanPartnerValue(profile?.status),
  };
}
