import { supabase } from '../../../../infrastructure/supabase/client';
import { mapOrganizationProfileToUpdate, normalizeCoverageRadius } from '../../application/mappers/mapOrganizationProfileToUpdate';
import { calculateOrganizationProfileCompletion, OrganizationProfileCompletionInput } from '../../application/utils/profileCompletion';

export function normalizeCatalogValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .trim();
}

export function useSaveOrganizationProfile() {
  const saveProfile = async (organizationId: string, formData: any) => {
    // Validação de raio de atendimento
    if (formData.coverageRadius !== undefined && String(formData.coverageRadius).trim() !== '') {
      const normalized = normalizeCoverageRadius(formData.coverageRadius);
      if (normalized === null) {
        throw new Error('Informe o raio de atendimento utilizando apenas quilômetros inteiros.');
      }
    }

    // 1. CARREGAR E VALIDAR TUDO (Catálogos) ANTES DE APAGAR QUALQUER COISA
    const validationErrors: string[] = [];
    
    const rawCerts = formData.certificacoes ? String(formData.certificacoes).split(',').map(c => c.trim()).filter(Boolean) : [];
    const uniqueCerts = Array.from(new Set(rawCerts));
    const resolvedCertifications: any[] = [];
    
    if (uniqueCerts.length > 0) {
      const { data: catalogCerts, error: certsErr } = await supabase.from('certifications').select('id, name');
      if (certsErr) throw new Error('Falha ao carregar catálogo de certificações');
      
      const certificationsByNormalizedName = new Map(
        catalogCerts?.map(item => [normalizeCatalogValue(item.name), item]) || []
      );

      for (const cName of uniqueCerts) {
        const norm = normalizeCatalogValue(cName);
        const match = certificationsByNormalizedName.get(norm);
        if (match) {
          resolvedCertifications.push(match);
        } else {
          validationErrors.push(`A certificação "${cName}" não existe no catálogo da Hub.IA. Selecione uma certificação cadastrada.`);
        }
      }
    }

    const rawSegments = formData.selectedSegments ? Array.from(new Set(formData.selectedSegments as string[])) : [];
    const resolvedSegments: any[] = [];
    
    if (rawSegments.length > 0) {
      const { data: catalogSegs, error: segsErr } = await supabase.from('segments').select('id, nome').eq('status', 'ativo').or(`organization_id.is.null,organization_id.eq.${organizationId}`);
      if (segsErr) throw new Error('Falha ao carregar catálogo de segmentos');
      
      const segmentsByNormalizedName = new Map(
        catalogSegs?.map(item => [normalizeCatalogValue(item.nome), item]) || []
      );

      for (const segName of rawSegments) {
        const norm = normalizeCatalogValue(segName);
        const match = segmentsByNormalizedName.get(norm);
        if (match) {
          resolvedSegments.push(match);
        } else {
          validationErrors.push(`O segmento "${segName}" não existe no catálogo disponível.`);
        }
      }
    }

    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('\n'));
    }

    // 2. SALVAR ORGANIZATIONS (Dados principais)
    const payload = mapOrganizationProfileToUpdate(formData);
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .update(payload)
      .eq('id', organizationId)
      .select('id, geographic_coverage_type, raio_atendimento_km')
      .maybeSingle();

    if (orgError) {
      console.error("Falha ao salvar organizations:", orgError);
      throw new Error(`Falha ao salvar dados principais: ${orgError.message}`);
    }
    if (!orgData) {
      throw new Error('Nenhuma organização foi atualizada. Verifique se o ID existe.');
    }

    // 3. PERSISTIR VÍNCULOS E AGREGAR ERROS PARCIAIS
    const partialErrors: string[] = [];

    // Certificações
    if (formData.certificacoes !== undefined) {
      const { error: delCertError } = await supabase.from('empresa_certificacoes').delete().eq('organization_id', organizationId);
      if (delCertError) {
        partialErrors.push('Não foi possível limpar certificações antigas.');
      } else {
        const certificationRows = resolvedCertifications.map(certification => ({
          organization_id: organizationId,
          certification_id: certification.id,
        }));
        if (certificationRows.length > 0) {
          const { error: insCertError } = await supabase.from('empresa_certificacoes').insert(certificationRows);
          if (insCertError) partialErrors.push('Não foi possível salvar as novas certificações.');
        }
      }
    }

    // CNAEs
    if (formData.cnaes_secundarios !== undefined) {
      const { error: delCnaeError } = await supabase.from('empresa_cnaes').delete().eq('organization_id', organizationId);
      if (delCnaeError) {
        partialErrors.push('Não foi possível limpar CNAEs secundários antigos.');
      } else {
        const cnaes = Array.from(new Set(formData.cnaes_secundarios as string[]));
        const cnaeRows = cnaes.map(cnae => ({ organization_id: organizationId, cnae_code: cnae, is_primary: false }));
        if (cnaeRows.length > 0) {
          const { error: insCnaeError } = await supabase.from('empresa_cnaes').insert(cnaeRows);
          if (insCnaeError) partialErrors.push('Não foi possível salvar os CNAEs secundários.');
        }
      }
    }

    // Estados Atendidos
    if (formData.area_cobertura_estados !== undefined) {
      const { error: delStatesError } = await supabase.from('empresa_estados_atendidos').delete().eq('organization_id', organizationId);
      if (delStatesError) {
        partialErrors.push('Não foi possível limpar estados atendidos antigos.');
      } else {
        const states = Array.from(new Set(String(formData.area_cobertura_estados).split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean)));
        const stateRows = states.map(st => ({ organization_id: organizationId, state_code: st }));
        if (stateRows.length > 0) {
          const { error: insStateError } = await supabase.from('empresa_estados_atendidos').insert(stateRows);
          if (insStateError) partialErrors.push('Não foi possível salvar a área de cobertura (estados).');
        }
      }
    }

    // Segmentos
    if (formData.selectedSegments !== undefined) {
      const { error: delSegError } = await supabase.from('organization_segments').delete().eq('organization_id', organizationId);
      if (delSegError) {
        partialErrors.push('Não foi possível limpar segmentos antigos.');
      } else {
        const segmentRows = resolvedSegments.map(segment => ({
          organization_id: organizationId,
          segment_id: segment.id,
          origem: 'usuario',
        }));
        if (segmentRows.length > 0) {
          const { error: insSegError } = await supabase.from('organization_segments').insert(segmentRows);
          if (insSegError) partialErrors.push('Não foi possível salvar os novos segmentos.');
        }
      }
    }

    if (partialErrors.length > 0) {
      throw new Error(`Dados principais salvos, porém: ${partialErrors.join(' ')}`);
    }

    // 4. CALCULAR E ATUALIZAR PERCENTUAL DE COMPLETUDE
    const completionInput: OrganizationProfileCompletionInput = {
      razaoSocial: formData.razao_social,
      nomeFantasia: formData.nome_fantasia,
      cnpj: formData.cnpj,
      emailCorporativo: formData.email_corporativo,
      telefone: formData.telefone,
      whatsapp: formData.whatsapp,
      addressZipCode: formData.cep,
      addressStreet: formData.endereco,
      addressNumber: formData.numero,
      addressNeighborhood: formData.bairro,
      city: formData.cidade,
      state: formData.uf,
      logoUrl: formData.logo_url,
      website: formData.site,
      tipoEmpresa: formData.tipo_empresa,
      perfilComercial: formData.commercialProfile,
      cnaePrincipal: formData.cnae_principal,
      geographicCoverageType: formData.geographicCoverageType,
      raioAtendimentoKm: formData.coverageRadius,
      estadosAtendidos: formData.area_cobertura_estados ? String(formData.area_cobertura_estados).split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean) : [],
      segmentIds: resolvedSegments.map(s => s.id)
    };

    const completionScore = calculateOrganizationProfileCompletion(completionInput);

    const { error: compError } = await supabase
      .from('organizations')
      .update({ profile_completion: completionScore })
      .eq('id', organizationId);

    if (compError) {
      console.warn('Falha ao atualizar percentual de completude:', compError);
    }
  };

  return { saveProfile };
}
