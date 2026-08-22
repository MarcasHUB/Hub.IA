import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPartnerCardPresentation,
  cleanPartnerValue,
} from '../src/modules/suppliers/presentation/components/partnerCardPresentation.ts';

const activePartner = {
  name: 'Empresa Parceira',
  document: '12.345.678/0001-90',
  segment: 'Metalurgia, Construção',
  city: 'São Paulo',
  state: 'SP',
  status: 'accepted' as const,
  since: '21/08/2026',
  phone: '(11) 3333-4444',
  email: 'comercial@parceira.test',
  website: 'parceira.test',
  rating: 0,
  responseTime: '',
  products: [],
  perfil_comercial: 'seller',
  raio_atendimento_km: 250,
  certifications: 'ISO 9001',
};

const publicProfile = {
  id: '20000000-0000-0000-0000-000000000002',
  legalName: 'Empresa Parceira Industrial S.A.',
  tradeName: 'Parceira Industrial',
  document: '',
  logoPath: null,
  logoUrl: 'https://example.test/logo.png',
  city: 'Campinas',
  state: 'SP',
  website: 'parceira.test',
  businessEmail: null,
  phone: null,
  companyType: 'fornecedor',
  commercialProfile: 'seller',
  companySize: '51-200',
  geographicCoverageType: 'regional',
  serviceRadiusKm: 300,
  servedStates: ['SP', 'MG'],
  segments: [
    { id: '1', name: 'Metalurgia' },
    { id: '2', name: 'Construção' },
  ],
  certifications: [{ id: '1', name: 'ISO 9001' }],
  productsAndServices: [
    { id: '1', name: 'Chapas de aço' },
    { id: '2', name: 'Corte industrial' },
  ],
  profileCompletion: 100,
  status: 'ativo',
};

test('parceiro ativo combina contrato da conexão e perfil público canônico', () => {
  const view = buildPartnerCardPresentation(activePartner, publicProfile);

  assert.equal(view.isActivePartner, true);
  assert.equal(view.displayName, 'Parceira Industrial');
  assert.equal(view.corporateName, 'Empresa Parceira Industrial S.A.');
  assert.equal(view.document, '12.345.678/0001-90');
  assert.equal(view.location, 'Campinas / SP');
  assert.equal(view.roleLabel, 'Fornecedor');
  assert.equal(view.serviceRadiusKm, 300);
  assert.deepEqual(view.segments, ['Metalurgia', 'Construção']);
  assert.deepEqual(view.products, ['Chapas de aço', 'Corte industrial']);
  assert.deepEqual(view.certifications, ['ISO 9001']);
  assert.equal(view.email, 'comercial@parceira.test');
  assert.equal(view.phone, '(11) 3333-4444');
  assert.equal(view.since, '21/08/2026');
});

test('convite pendente recebe somente o resumo e não expõe dados enriquecidos', () => {
  const view = buildPartnerCardPresentation(
    { ...activePartner, status: 'pending_received' as const },
    publicProfile,
  );

  assert.equal(view.isActivePartner, false);
  assert.equal(view.email, null);
  assert.equal(view.phone, null);
  assert.equal(view.website, null);
  assert.equal(view.serviceRadiusKm, null);
  assert.equal(view.since, null);
  assert.deepEqual(view.products, []);
  assert.deepEqual(view.certifications, []);
  assert.deepEqual(view.segments, ['Metalurgia', 'Construção']);
});

test('placeholders antigos são omitidos em vez de exibidos como dados', () => {
  const view = buildPartnerCardPresentation({
    ...activePartner,
    document: '-',
    segment: 'Não definido',
    city: 'Não informado',
    state: '-',
    email: 'Não definido',
    phone: '-',
    website: '',
    responseTime: '-',
    certifications: 'Não definido',
  });

  assert.equal(view.document, null);
  assert.equal(view.location, null);
  assert.equal(view.email, null);
  assert.equal(view.phone, null);
  assert.equal(view.responseTime, null);
  assert.deepEqual(view.segments, []);
  assert.deepEqual(view.certifications, []);
});

test('métricas só aparecem quando possuem valor real', () => {
  const withoutMetrics = buildPartnerCardPresentation(activePartner);
  assert.equal(withoutMetrics.rating, null);
  assert.equal(withoutMetrics.responseTime, null);

  const withMetrics = buildPartnerCardPresentation({
    ...activePartner,
    rating: 4.7,
    responseTime: '2 horas',
  });
  assert.equal(withMetrics.rating, 4.7);
  assert.equal(withMetrics.responseTime, '2 horas');
});

test('textos longos são preservados para truncamento visual com title', () => {
  const longName = 'Empresa Parceira com Razão Social Muito Longa para Validar Responsividade';
  const view = buildPartnerCardPresentation({ ...activePartner, name: longName });
  assert.equal(view.displayName, longName);
});

test('normalização trata valores ausentes de forma consistente', () => {
  assert.equal(cleanPartnerValue('  Não definido  '), null);
  assert.equal(cleanPartnerValue('conteúdo real'), 'conteúdo real');
  assert.equal(cleanPartnerValue(null), null);
});
