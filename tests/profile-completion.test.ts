import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateOrganizationProfileCompletion, getOrganizationProfileMissingFields, parseCnaeEntry } from '../src/modules/organizations/application/utils/profileCompletion.ts';

test('perfil canônico completamente preenchido alcança 100%', () => {
  const profile = {
    razaoSocial: 'Empresa Industrial S.A.',
    nomeFantasia: 'Empresa Industrial',
    cnpj: '00.000.000/0001-00',
    emailCorporativo: 'contato@dominio.com.br',
    telefone: '1130000000',
    addressZipCode: '01001000',
    addressStreet: 'Praça da Sé',
    addressNumber: '1',
    addressNeighborhood: 'Sé',
    city: 'São Paulo',
    state: 'SP',
    logoUrl: 'https://example.invalid/logo.png',
    website: 'https://example.invalid',
    tipoEmpresa: 'indústria',
    perfilComercial: 'ambos',
    cnaePrincipal: '2511-0/00 - Fabricação de estruturas metálicas',
    geographicCoverageType: 'nacional',
    segmentIds: ['segment-id'],
  };
  assert.equal(calculateOrganizationProfileCompletion(profile), 100);
  assert.deepEqual(getOrganizationProfileMissingFields(profile), []);
});

test('CNAE é persistido com código e descrição separados', () => {
  assert.deepEqual(parseCnaeEntry('2511-0/00 - Fabricação de estruturas metálicas'), {
    code: '2511-0/00',
    description: 'Fabricação de estruturas metálicas',
  });
});
