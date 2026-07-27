import { supabase } from '../../../../infrastructure/supabase/client';

import { mapOrganizationProfileToUpdate } from '../../application/mappers/mapOrganizationProfileToUpdate';

export function useSaveOrganizationProfile() {
  const saveProfile = async (organizationId: string, formData: any) => {
    
    const payload = mapOrganizationProfileToUpdate(formData);

    const { error } = await supabase.from('organizations').update(payload).eq('id', organizationId);

    if (error) {
      console.error("Erro ao salvar organizations:", error);
      throw error;
    }

    if (formData.certificacoes !== undefined) {
      await supabase.from('empresa_certificacoes').delete().eq('organization_id', organizationId);
      const certNames = formData.certificacoes.split(',').map((c: string) => c.trim()).filter(Boolean);
      for (const cName of certNames) {
        let { data: certData } = await supabase.from('certifications').select('id').eq('name', cName).single();
        if (!certData) {
          const { data: newCert, error: errC } = await supabase.from('certifications').insert({ name: cName }).select('id').single();
          if (!errC) certData = newCert;
        }
        if (certData) {
          await supabase.from('empresa_certificacoes').insert({ organization_id: organizationId, certification_id: certData.id });
        }
      }
    }

    if (formData.cnaes_secundarios !== undefined) {
      await supabase.from('empresa_cnaes').delete().eq('organization_id', organizationId);
      for (const cnae of formData.cnaes_secundarios) {
        await supabase.from('empresa_cnaes').insert({ organization_id: organizationId, cnae_code: cnae, is_primary: false });
      }
    }

    if (formData.area_cobertura_estados !== undefined) {
      await supabase.from('empresa_estados_atendidos').delete().eq('organization_id', organizationId);
      const states = formData.area_cobertura_estados.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean);
      for (const st of states) {
        await supabase.from('empresa_estados_atendidos').insert({ organization_id: organizationId, state_code: st });
      }
    }

    if (formData.selectedSegments !== undefined) {
      await supabase.from('organization_segments').delete().eq('organization_id', organizationId);
      for (const segName of formData.selectedSegments) {
        let { data: segData } = await supabase.from('segments').select('id').eq('nome', segName).single();
        if (!segData) {
           const { data: newSeg, error: errS } = await supabase.from('segments').insert({ nome: segName }).select('id').single();
           if (!errS) segData = newSeg;
        }
        if (segData) {
          await supabase.from('organization_segments').insert({ organization_id: organizationId, segment_id: segData.id, origem: 'usuario' });
        }
      }
    }
  };

  return { saveProfile };
}
