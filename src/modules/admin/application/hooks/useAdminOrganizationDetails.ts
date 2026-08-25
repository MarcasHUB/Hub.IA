import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/infrastructure/supabase/client';

export interface AdminCompanyDetails {
  identificacao: {
    id: string;
    name: string;
    razao_social: string | null;
    nome_fantasia: string | null;
    cnpj: string | null;
    status: string;
    logo_url: string | null;
    profile_completion: number;
  };
  fiscal: {
    inscricao_estadual: string | null;
    inscricao_municipal: string | null;
    situacao_cadastral: string | null;
    data_abertura: string | null;
    natureza_juridica: string | null;
    cnae_principal: string | null;
    atividade_principal: string | null;
    cnaes_secundarios: Array<{ cnae: string; description: string }>;
  };
  contato: {
    email_corporativo: string | null;
    business_email: string | null;
    phone: string | null;
    telefone: string | null;
    whatsapp: string | null;
    website: string | null;
    linkedin_url: string | null;
  };
  endereco: {
    address_zip_code: string | null;
    address_street: string | null;
    address_number: string | null;
    address_complement: string | null;
    address_neighborhood: string | null;
    address_reference: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };
  perfil: {
    tipo_empresa: string | null;
    perfil_comercial: string | null;
    business_model: string | null;
    company_size: string | null;
    geographic_coverage_type: string | null;
    tipo_cobertura: string | null;
    raio_atendimento_km: number | null;
    recebe_oportunidades: boolean | null;
    nivel_interesse: string | null;
  };
  canonicos: {
    segmentos: string[];
    certificacoes: string[];
    estados_atendidos: string[];
  };
  sistema: {
    slug: string | null;
    created_at: string;
    updated_at: string;
    ultima_sincronizacao_receita: string | null;
    nivel_confianca_cadastro: number | null;
  };
}

export function useAdminOrganizationDetails(organizationId: string | null) {
  return useQuery({
    queryKey: ['admin_organization_details', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase.rpc('admin_get_organization_details', {
        p_target_organization_id: organizationId
      });
      if (error) throw error;
      return data as AdminCompanyDetails;
    },
    enabled: !!organizationId,
  });
}
