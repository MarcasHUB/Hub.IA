import { supabase } from '../../../../infrastructure/supabase/client';
import { PublicOrganizationProfile } from '../../domain/entities/PublicOrganizationProfile';
import { resolveOrganizationLogoUrl } from '../../application/utils/logoUtils';

interface PublicProfileProjection {
  id: string;
  name?: string;
  trade_name?: string;
  logo_url?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  profile_type?: string | null;
  tipo_empresa?: string | null;
  perfil_comercial?: string | null;
  company_size?: string | null;
  geographic_coverage_type?: string | null;
  raio_atendimento_km?: number | null;
  coverage_states?: string[];
  segments?: Array<{ id: string; name: string }>;
  certifications?: Array<{ id: string; name: string }>;
  catalog?: Array<{ id: string; description?: string | null; image_url?: string | null }>;
}

export class OrganizationPublicProfileRepository {
  async getPublicProfile(targetOrganizationId: string): Promise<PublicOrganizationProfile | null> {
    const { data, error } = await supabase.rpc('get_public_organization_profile', {
      p_target_organization_id: targetOrganizationId,
    });

    if (error) throw error;
    if (!data || typeof data !== 'object') return null;

    const projection = data as PublicProfileProjection;
    const logoUrl = projection.logo_url
      ? resolveOrganizationLogoUrl(projection.logo_url)
      : null;

    return {
      id: projection.id,
      legalName: projection.name || '',
      tradeName: projection.trade_name || projection.name || '',
      document: '',
      logoPath: projection.logo_url || null,
      logoUrl,
      city: projection.city || null,
      state: projection.state || null,
      website: projection.website || null,
      businessEmail: null,
      phone: null,
      companyType: projection.tipo_empresa || projection.profile_type || null,
      commercialProfile: projection.perfil_comercial || null,
      companySize: projection.company_size || null,
      geographicCoverageType: projection.geographic_coverage_type || null,
      serviceRadiusKm: projection.raio_atendimento_km || null,
      servedStates: projection.coverage_states || [],
      segments: projection.segments || [],
      certifications: projection.certifications || [],
      productsAndServices: (projection.catalog || []).map(item => ({
        id: item.id,
        name: item.description || 'Item do catálogo',
        imageUrl: item.image_url || null,
      })),
      profileCompletion: 100,
      status: 'ativo',
    };
  }
}
