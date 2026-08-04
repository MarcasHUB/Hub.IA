import { describe, it, expect } from 'vitest';
import { calculateOrganizationProfileCompletion, OrganizationProfileCompletionInput } from './profileCompletion';

describe('profileCompletion', () => {
  const emptyProfile: OrganizationProfileCompletionInput = {};

  const completeProfileWithoutCnae: OrganizationProfileCompletionInput = {
    razaoSocial: 'Chaparia Ferro',
    nomeFantasia: 'Chaparia',
    cnpj: '12.345.678/0001-99',
    emailCorporativo: 'contato@chaparia.com',
    telefone: '11999999999',
    addressZipCode: '01000-000',
    addressStreet: 'Rua A',
    addressNumber: '123',
    addressNeighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    logoUrl: 'https://logo.com',
    website: 'https://site.com',
    tipoEmpresa: 'Indústria',
    perfilComercial: 'Fornecedor',
    geographicCoverageType: 'regional',
    raioAtendimentoKm: 250,
    segmentIds: ['123', '456']
  };

  const completeProfile: OrganizationProfileCompletionInput = {
    ...completeProfileWithoutCnae,
    cnaePrincipal: '2599-3/99'
  };

  it('calculates 0 for empty profile', () => {
    expect(calculateOrganizationProfileCompletion(emptyProfile)).toBe(0);
  });

  it('calculates 90 for complete profile missing CNAE', () => {
    expect(calculateOrganizationProfileCompletion(completeProfileWithoutCnae)).toBe(90);
  });

  it('calculates 100 for fully complete profile', () => {
    expect(calculateOrganizationProfileCompletion(completeProfile)).toBe(100);
  });

  it('ignores placeholder CNAE', () => {
    const profileWithPlaceholder: OrganizationProfileCompletionInput = {
      ...completeProfileWithoutCnae,
      cnaePrincipal: 'Preenchido via CNPJ'
    };
    expect(calculateOrganizationProfileCompletion(profileWithPlaceholder)).toBe(90);
  });

  it('gives full contact points if only whatsapp is provided', () => {
    const p = { ...completeProfile, telefone: null, whatsapp: '11999999999' };
    expect(calculateOrganizationProfileCompletion(p)).toBe(100);
  });

  it('gives full contact points if only telefone is provided', () => {
    const p = { ...completeProfile, telefone: '11999999999', whatsapp: null };
    expect(calculateOrganizationProfileCompletion(p)).toBe(100);
  });

  it('does not duplicate points if both telefone and whatsapp are provided', () => {
    const p = { ...completeProfile, telefone: '11999999999', whatsapp: '11999999999' };
    expect(calculateOrganizationProfileCompletion(p)).toBe(100);
  });

  it('calculates coverage regional without radius and states as incomplete', () => {
    const p = { ...completeProfile, geographicCoverageType: 'regional', raioAtendimentoKm: null, estadosAtendidos: [] };
    // Loses 11 points from coverage
    expect(calculateOrganizationProfileCompletion(p)).toBe(89);
  });

  it('calculates coverage regional with states as complete', () => {
    const p = { ...completeProfile, geographicCoverageType: 'regional', raioAtendimentoKm: null, estadosAtendidos: ['SP'] };
    expect(calculateOrganizationProfileCompletion(p)).toBe(100);
  });

  it('calculates coverage nacional without states as complete', () => {
    const p = { ...completeProfile, geographicCoverageType: 'nacional', raioAtendimentoKm: null, estadosAtendidos: [] };
    expect(calculateOrganizationProfileCompletion(p)).toBe(100);
  });

  it('calculates address partially', () => {
    const p = { ...completeProfile, addressNeighborhood: null, addressNumber: null };
    // Loses 2 fields out of 6 (4/6 = 0.666 * 10 = 7)
    // 100 - 10 + 7 = 97
    expect(calculateOrganizationProfileCompletion(p)).toBe(97);
  });

  it('calculates segments empty as incomplete', () => {
    const p = { ...completeProfile, segmentIds: [] };
    expect(calculateOrganizationProfileCompletion(p)).toBe(88); // 100 - 12
  });

  it('calculates whitespace only as incomplete', () => {
    const p = { ...completeProfile, razaoSocial: '   ' };
    expect(calculateOrganizationProfileCompletion(p)).toBe(92); // 100 - 8
  });
});
