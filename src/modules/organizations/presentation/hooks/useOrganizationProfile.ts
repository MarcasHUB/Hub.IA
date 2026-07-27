import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../infrastructure/supabase/client';
import { GeographicCoverageType } from '../../domain/types/GeographicCoverageType';

export interface OrganizationProfileData {
  id: string;
  name: string;
  trade_name: string;
  document: string;
  commercial_email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  logo_url?: string;
  address_zip_code?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  latitude?: number;
  longitude?: number;
  tipo_empresa?: string;
  geographic_coverage_type?: GeographicCoverageType | null;
  raio_atendimento_km?: number | null;
  cnae_principal?: string;
  business_model?: string;
  profile_completion?: number;
}
export const organizationProfileKeys = {
  detail: (organizationId: string) => ['organization-profile', organizationId] as const,
};

export function useOrganizationProfile(organizationId: string | null) {
  // 1. Dados principais da empresa
  const mainQuery = useQuery({
    queryKey: organizationProfileKeys.detail(organizationId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select(`
          *,
          empresa_certificacoes(certifications(name)),
          empresa_cnaes(cnae_code, is_primary),
          empresa_estados_atendidos(state_code),
          organization_segments(segments(nome))
        `)
        .eq('id', organizationId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: Boolean(organizationId),
  });

  // 2. Catálogo (Pode falhar sem quebrar o resto)
  const catalogQuery = useQuery({
    queryKey: ['organization-catalog', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresa_catalogo')
        .select('*')
        .eq('organization_id', organizationId!);

      if (error) throw error;
      return data;
    },
    enabled: Boolean(organizationId),
    retry: false, // Don't block or retry excessively if catalog is unavailable or RLS blocks it
  });

  // Process data safely with null fallbacks for fields
  const data = mainQuery.data;
  
  const organization: OrganizationProfileData | null = data ? {
    id: data.id,
    name: data.name || data.razao_social || '',
    trade_name: data.trade_name || data.nome_fantasia || '',
    document: data.document || data.cnpj || '',
    commercial_email: data.commercial_email || data.email_corporativo || '',
    phone: data.phone || data.telefone || '',
    whatsapp: data.whatsapp || '',
    website: data.website || '',
    logo_url: data.logo_url || '',
    address_zip_code: data.address_zip_code || '',
    address_street: data.address_street || '',
    address_number: data.address_number || '',
    address_complement: data.address_complement || '',
    address_neighborhood: data.address_neighborhood || '',
    address_city: data.address_city || data.city || '',
    address_state: data.address_state || data.state || '',
    latitude: data.latitude,
    longitude: data.longitude,
    tipo_empresa: data.tipo_empresa || '',
    geographic_coverage_type: data.geographic_coverage_type as GeographicCoverageType | null,
    raio_atendimento_km: data.raio_atendimento_km,
    cnae_principal: data.cnae_principal || '',
    business_model: data.business_model || data.perfil_comercial || '',
    profile_completion: data.profile_completion || 50,
  } : null;

  const cnaes = data?.empresa_cnaes 
    ? data.empresa_cnaes.map((c: any) => c.cnae_code).filter(Boolean) 
    : [];
    
  const secondaryCnaes = data?.empresa_cnaes 
    ? data.empresa_cnaes.filter((c: any) => c.is_primary === false).map((c: any) => c.cnae_code).filter(Boolean) 
    : [];

  const segments = data?.organization_segments 
    ? data.organization_segments.map((s: any) => s.segments?.nome).filter(Boolean) 
    : [];

  const certifications = data?.empresa_certificacoes 
    ? data.empresa_certificacoes.map((c: any) => c.certifications?.name).filter(Boolean) 
    : [];

  const coverageStates = data?.empresa_estados_atendidos 
    ? data.empresa_estados_atendidos.map((e: any) => e.state_code).filter(Boolean) 
    : [];

  return {
    organization,
    cnaes,
    secondaryCnaes,
    segments,
    certifications,
    coverageStates,
    catalog: catalogQuery.data || [],
    isLoading: mainQuery.isLoading,
    isFetching: mainQuery.isFetching || catalogQuery.isFetching,
    isError: mainQuery.isError,
    error: mainQuery.error,
    refetch: () => {
      mainQuery.refetch();
      catalogQuery.refetch();
    },
  };
}
