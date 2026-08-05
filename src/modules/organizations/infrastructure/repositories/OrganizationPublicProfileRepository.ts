import { supabase } from '../../../../infrastructure/supabase/client';
import { PublicOrganizationProfile } from '../../domain/entities/PublicOrganizationProfile';
import { resolveOrganizationLogoUrl } from '../../application/utils/logoUtils';

export class OrganizationPublicProfileRepository {
  async getPublicProfile(organizationId: string): Promise<PublicOrganizationProfile | null> {
    try {
      // 1. Fetch organization base data
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          nome_fantasia,
          cnpj,
          logo_url,
          city,
          state,
          website,
          business_email,
          phone,
          company_type,
          commercial_profile,
          company_size,
          geographic_coverage_type,
          raio_atendimento_km,
          status
        `)
        .eq('id', organizationId)
        .maybeSingle();

      if (orgError) throw orgError;
      if (!orgData) return null;
      
      if (orgData.status !== 'active') {
         // Se for inativa, podemos retornar null ou retornar os dados com flag inativa
         // A regra diz "Empresa inativa pode permanecer em Meus Parceiros como histórico"
      }

      // 2. Resolve Logo
      let logoUrl = null;
      if (orgData.logo_url) {
        logoUrl = resolveOrganizationLogoUrl(orgData.logo_url);
        if (logoUrl) {
          logoUrl = `${logoUrl}?v=${Date.now()}`;
        }
      }

      // 3. Fetch Segments
      const { data: segData } = await supabase
        .from('organization_segments')
        .select(`
          segments (
            id,
            name
          )
        `)
        .eq('organization_id', organizationId);

      const segments = (segData || [])
        .map((s: any) => s.segments)
        .filter(Boolean)
        .map((s: any) => ({
          id: s.id,
          name: s.name
        }));

      // Remover duplicidades
      const uniqueSegments = Array.from(new Map(segments.map(s => [s.id, s])).values());

      // 4. Fetch Certifications
      const { data: certData } = await supabase
        .from('empresa_certificacoes')
        .select(`
          certifications (
            id,
            name
          )
        `)
        .eq('organization_id', organizationId);

      const certifications = (certData || [])
        .map((c: any) => c.certifications)
        .filter(Boolean)
        .map((c: any) => ({
          id: c.id,
          name: c.name
        }));
      const uniqueCertifications = Array.from(new Map(certifications.map(c => [c.id, c])).values());

      // 5. Fetch Geographic Coverage States
      const { data: stateData } = await supabase
        .from('empresa_estados_atendidos')
        .select('estado')
        .eq('organization_id', organizationId);

      const servedStates = (stateData || []).map((s: any) => s.estado).filter(Boolean);

      // 6. Fetch Public Products & Services (Venda)
      // Baseado na estrutura: products table, com tipo venda se existir oferta
      const { data: productData } = await supabase
        .from('products')
        .select('id, name')
        .eq('organization_id', organizationId)
        .limit(20); 
      // TODO: Ajustar para offer_type='venda' quando a tabela offer_type estiver clara

      const productsAndServices = (productData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        imageUrl: null
      }));

      // Build profile object
      const profile: PublicOrganizationProfile = {
        id: orgData.id,
        legalName: orgData.name || '',
        tradeName: orgData.nome_fantasia || orgData.name || '',
        document: orgData.cnpj || '',
        logoPath: orgData.logo_url || null,
        logoUrl: logoUrl,
        city: orgData.city || null,
        state: orgData.state || null,
        website: orgData.website || null,
        businessEmail: orgData.business_email || null,
        phone: orgData.phone || null,
        companyType: orgData.company_type || null,
        commercialProfile: orgData.commercial_profile || null,
        companySize: orgData.company_size || null,
        geographicCoverageType: orgData.geographic_coverage_type || null,
        serviceRadiusKm: orgData.raio_atendimento_km || null,
        servedStates: servedStates,
        segments: uniqueSegments,
        certifications: uniqueCertifications,
        productsAndServices: productsAndServices,
        profileCompletion: 100, // Not strictly public
        status: orgData.status || 'active'
      };

      return profile;

    } catch (err) {
      console.error('Error fetching public profile:', err);
      return null;
    }
  }
}
