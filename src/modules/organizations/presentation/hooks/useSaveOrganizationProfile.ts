import { supabase } from '../../../../infrastructure/supabase/client';
import { mapOrganizationProfileToUpdate } from '../../application/mappers/mapOrganizationProfileToUpdate';

export function useSaveOrganizationProfile() {
  const saveProfile = async (organizationId: string, formData: any) => {
    const payload = mapOrganizationProfileToUpdate(formData);

    const { error: orgError } = await supabase.from('organizations').update(payload).eq('id', organizationId);
    if (orgError) {
      console.error("Falha ao salvar organizations:", orgError);
      throw new Error(`Falha ao salvar dados principais: ${orgError.message}`);
    }

    if (formData.certificacoes !== undefined) {
      const { error: delCertError } = await supabase.from('empresa_certificacoes').delete().eq('organization_id', organizationId);
      if (delCertError) throw new Error(`Falha ao limpar certificações: ${delCertError.message}`);
      
      const certNames = formData.certificacoes.split(',').map((c: string) => c.trim()).filter(Boolean);
      for (const cName of Array.from(new Set(certNames))) {
        let { data: certData } = await supabase.from('certifications').select('id').eq('name', cName).single();
        if (!certData) {
          const { data: newCert, error: errC } = await supabase.from('certifications').insert({ name: cName as string }).select('id').single();
          if (errC) throw new Error(`Falha ao criar certificação ${cName}: ${errC.message}`);
          certData = newCert;
        }
        if (certData) {
          const { error: insCertError } = await supabase.from('empresa_certificacoes').insert({ organization_id: organizationId, certification_id: certData.id });
          if (insCertError) throw new Error(`Falha ao vincular certificação ${cName}: ${insCertError.message}`);
        }
      }
    }

    if (formData.cnaes_secundarios !== undefined) {
      const { error: delCnaeError } = await supabase.from('empresa_cnaes').delete().eq('organization_id', organizationId);
      if (delCnaeError) throw new Error(`Falha ao limpar CNAEs: ${delCnaeError.message}`);

      const cnaes = Array.from(new Set(formData.cnaes_secundarios));
      for (const cnae of cnaes) {
        const { error: insCnaeError } = await supabase.from('empresa_cnaes').insert({ organization_id: organizationId, cnae_code: cnae, is_primary: false });
        if (insCnaeError) throw new Error(`Falha ao vincular CNAE ${cnae}: ${insCnaeError.message}`);
      }
    }

    if (formData.area_cobertura_estados !== undefined) {
      const { error: delStatesError } = await supabase.from('empresa_estados_atendidos').delete().eq('organization_id', organizationId);
      if (delStatesError) throw new Error(`Falha ao limpar estados: ${delStatesError.message}`);

      const states = Array.from(new Set(formData.area_cobertura_estados.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean)));
      for (const st of states) {
        const { error: insStateError } = await supabase.from('empresa_estados_atendidos').insert({ organization_id: organizationId, state_code: st });
        if (insStateError) throw new Error(`Falha ao vincular estado ${st}: ${insStateError.message}`);
      }
    }

    if (formData.selectedSegments !== undefined) {
      const { error: delSegError } = await supabase.from('organization_segments').delete().eq('organization_id', organizationId);
      if (delSegError) throw new Error(`Falha ao limpar segmentos: ${delSegError.message}`);

      const segments = Array.from(new Set(formData.selectedSegments));
      for (const segName of segments) {
        // Tentamos "nome" ou "name" no select pois o banco pode variar. A tabela usa "nome".
        let { data: segData } = await supabase.from('segments').select('id').eq('nome', segName).single();
        if (!segData) {
           const { data: newSeg, error: errS } = await supabase.from('segments').insert({ nome: segName }).select('id').single();
           if (errS) {
               // RLS muitas vezes impede a criação de novos segmentos, lançar o erro limpo.
               throw new Error(`Sem permissão ou falha ao criar segmento "${segName}": ${errS.message}`);
           }
           segData = newSeg;
        }
        if (segData) {
          const { error: insSegError } = await supabase.from('organization_segments').insert({ organization_id: organizationId, segment_id: segData.id, origem: 'usuario' });
          if (insSegError) throw new Error(`Falha ao vincular segmento ${segName}: ${insSegError.message}`);
        }
      }
    }
  };

  return { saveProfile };
}
