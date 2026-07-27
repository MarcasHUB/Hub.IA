import { GeographicCoverageType } from '../../domain/types/GeographicCoverageType';

export interface OrganizationProfileFormData {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  email_corporativo: string;
  telefone: string;
  whatsapp: string;
  site: string;
  logo_url: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  latitude: string;
  longitude: string;
  tipo_empresa: string;
  business_model: string;
  geographicCoverageType: GeographicCoverageType | null;
  area_cobertura_raio: string;
  cnae_principal: string;
}

export interface OrganizationUpdatePayload {
  name: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  email_corporativo: string;
  phone: string;
  telefone: string;
  whatsapp: string;
  website: string;
  logo_url: string;
  address_zip_code: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  city: string;
  state: string;
  profile_completion: number;
  latitude: number | null;
  longitude: number | null;
  tipo_empresa: string;
  perfil_comercial: string;
  geographic_coverage_type: GeographicCoverageType | null;
  raio_atendimento_km: number | null;
  cnae_principal: string;
}

/**
 * Normaliza o valor de raio de atendimento.
 * Exige um número estritamente válido em string sem caracteres numéricos misturados (como '10km' ou decimais tipo '10.5').
 * Retorna o inteiro, ou null caso o formato seja inválido, negativo, ou vazio.
 */
export function normalizeCoverageRadius(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  
  const normalized = String(value).trim();
  
  // Vazio ou espaços em branco
  if (!normalized) return null;

  // Aceita apenas dígitos puros (evita "10.5", "10km", "abc", "-1", "1e2")
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  // Retorna somente se for um inteiro seguro >= 0
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Mapeia os dados brutos do formulário para o payload tipado que será enviado ao banco de dados (Supabase).
 * É uma função pura e não injeta efeitos colaterais.
 */
export function mapOrganizationProfileToUpdate(formData: OrganizationProfileFormData): OrganizationUpdatePayload {
  let comp = 50;
  if (formData.logo_url) comp += 20;
  if (formData.site) comp += 10;
  if (formData.whatsapp) comp += 10;
  if (formData.endereco) comp += 10;

  return {
    name: formData.razao_social,
    razao_social: formData.razao_social,
    nome_fantasia: formData.nome_fantasia,
    cnpj: formData.cnpj,
    email_corporativo: formData.email_corporativo,
    phone: formData.telefone,
    telefone: formData.telefone,
    whatsapp: formData.whatsapp,
    website: formData.site,
    logo_url: formData.logo_url,
    address_zip_code: formData.cep,
    address_street: formData.endereco,
    address_number: formData.numero,
    address_complement: formData.complemento,
    address_neighborhood: formData.bairro,
    city: formData.cidade,
    state: formData.uf,
    profile_completion: comp,
    latitude: formData.latitude ? parseFloat(formData.latitude) : null,
    longitude: formData.longitude ? parseFloat(formData.longitude) : null,
    tipo_empresa: formData.tipo_empresa,
    perfil_comercial: formData.business_model,
    geographic_coverage_type: formData.geographicCoverageType !== undefined ? formData.geographicCoverageType : null,
    raio_atendimento_km: normalizeCoverageRadius(formData.area_cobertura_raio),
    cnae_principal: formData.cnae_principal,
  };
}
