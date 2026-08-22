import { isValidCNPJ, normalizeCNPJ } from '../../utils/formatters.ts';

export interface CnpjEconomicActivity {
  code: string;
  description: string;
}

export interface CnpjPublicAddress {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
}

export interface CnpjEnrichmentProvenance {
  origin: 'external';
  source: 'BrasilAPI';
  sourceUrl: string;
  retrievedAt: string;
}

export interface CnpjEnrichment {
  cnpj: string;
  legalName: string | null;
  tradeName: string | null;
  registrationStatus: string | null;
  openedAt: string | null;
  primaryActivity: CnpjEconomicActivity | null;
  secondaryActivities: CnpjEconomicActivity[];
  legalNature: string | null;
  branchType: string | null;
  address: CnpjPublicAddress;
  provenance: CnpjEnrichmentProvenance;
}

export interface CnpjEnrichmentProvider {
  lookup(normalizedCnpj: string, signal?: AbortSignal): Promise<CnpjEnrichment>;
}

interface BrasilApiCnpjResponse {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  cnae_fiscal?: number | string;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: Array<{ codigo?: number | string; descricao?: string }>;
  natureza_juridica?: string;
  descricao_identificador_matriz_filial?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  municipio?: string;
  uf?: string;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

export class BrasilApiCnpjProvider implements CnpjEnrichmentProvider {
  private readonly fetcher: typeof fetch;

  constructor(fetcher: typeof fetch = fetch) {
    this.fetcher = fetcher;
  }

  async lookup(normalizedCnpj: string, signal?: AbortSignal): Promise<CnpjEnrichment> {
    const sourceUrl = `https://brasilapi.com.br/api/cnpj/v1/${normalizedCnpj}`;
    const response = await this.fetcher(sourceUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });

    if (!response.ok) {
      throw new Error(response.status === 404 ? 'CNPJ_NOT_FOUND' : 'CNPJ_PROVIDER_UNAVAILABLE');
    }

    const data = await response.json() as BrasilApiCnpjResponse;
    const primaryCode = data.cnae_fiscal == null ? null : String(data.cnae_fiscal);
    const primaryDescription = cleanText(data.cnae_fiscal_descricao);

    return {
      cnpj: normalizeCNPJ(data.cnpj) || normalizedCnpj,
      legalName: cleanText(data.razao_social),
      tradeName: cleanText(data.nome_fantasia),
      registrationStatus: cleanText(data.descricao_situacao_cadastral),
      openedAt: cleanText(data.data_inicio_atividade),
      primaryActivity: primaryCode || primaryDescription
        ? { code: primaryCode || '', description: primaryDescription || '' }
        : null,
      secondaryActivities: (data.cnaes_secundarios || [])
        .map((activity) => ({
          code: activity.codigo == null ? '' : String(activity.codigo),
          description: cleanText(activity.descricao) || '',
        }))
        .filter((activity) => activity.code || activity.description),
      legalNature: cleanText(data.natureza_juridica),
      branchType: cleanText(data.descricao_identificador_matriz_filial),
      address: {
        street: cleanText(data.logradouro),
        number: cleanText(data.numero),
        complement: cleanText(data.complemento),
        neighborhood: cleanText(data.bairro),
        postalCode: cleanText(data.cep),
        city: cleanText(data.municipio),
        state: cleanText(data.uf),
      },
      provenance: {
        origin: 'external',
        source: 'BrasilAPI',
        sourceUrl,
        retrievedAt: new Date().toISOString(),
      },
    };
  }
}

export class CnpjEnrichmentService {
  private readonly provider: CnpjEnrichmentProvider;

  constructor(provider: CnpjEnrichmentProvider = new BrasilApiCnpjProvider()) {
    this.provider = provider;
  }

  async lookup(cnpj: string, signal?: AbortSignal): Promise<CnpjEnrichment> {
    const normalizedCnpj = normalizeCNPJ(cnpj);
    if (!isValidCNPJ(normalizedCnpj)) throw new Error('INVALID_CNPJ');
    return this.provider.lookup(normalizedCnpj, signal);
  }
}

export const cnpjEnrichmentService = new CnpjEnrichmentService();
