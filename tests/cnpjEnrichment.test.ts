import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BrasilApiCnpjProvider,
  CnpjEnrichmentService,
  type CnpjEnrichmentProvider,
} from '../src/shared/services/cnpj/CnpjEnrichmentService.ts';
import { isValidCNPJ, normalizeCNPJ } from '../src/shared/utils/formatters.ts';

test('normaliza e valida CNPJ usando o utilitário canônico', () => {
  assert.equal(normalizeCNPJ('19.131.243/0001-97'), '19131243000197');
  assert.equal(isValidCNPJ('19.131.243/0001-97'), true);
  assert.equal(isValidCNPJ('11.111.111/1111-11'), false);
  assert.equal(isValidCNPJ('123'), false);
});

test('serviço envia apenas CNPJ normalizado ao provider', async () => {
  let received = '';
  const provider: CnpjEnrichmentProvider = {
    async lookup(normalizedCnpj) {
      received = normalizedCnpj;
      return {
        cnpj: normalizedCnpj,
        legalName: 'Empresa Pública',
        tradeName: null,
        registrationStatus: 'ATIVA',
        openedAt: null,
        primaryActivity: null,
        secondaryActivities: [],
        legalNature: null,
        branchType: 'MATRIZ',
        address: {
          street: null,
          number: null,
          complement: null,
          neighborhood: null,
          postalCode: null,
          city: null,
          state: null,
        },
        provenance: {
          origin: 'external',
          source: 'BrasilAPI',
          sourceUrl: 'https://brasilapi.com.br',
          retrievedAt: '2026-08-22T00:00:00.000Z',
        },
      };
    },
  };

  const result = await new CnpjEnrichmentService(provider).lookup('19.131.243/0001-97');
  assert.equal(received, '19131243000197');
  assert.equal(result.provenance.origin, 'external');
  assert.equal(result.provenance.source, 'BrasilAPI');
});

test('provider mapeia dados públicos e mantém proveniência separada', async () => {
  const fetcher = (async () => new Response(JSON.stringify({
    cnpj: '19131243000197',
    razao_social: 'Empresa Pública S.A.',
    nome_fantasia: 'Empresa Pública',
    descricao_situacao_cadastral: 'ATIVA',
    data_inicio_atividade: '2014-01-01',
    cnae_fiscal: 6201501,
    cnae_fiscal_descricao: 'Desenvolvimento de programas',
    cnaes_secundarios: [{ codigo: 6202300, descricao: 'Serviços de tecnologia' }],
    natureza_juridica: 'Sociedade Anônima',
    descricao_identificador_matriz_filial: 'MATRIZ',
    logradouro: 'Rua Pública',
    numero: '100',
    municipio: 'São Paulo',
    uf: 'SP',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

  const result = await new BrasilApiCnpjProvider(fetcher).lookup('19131243000197');
  assert.equal(result.legalName, 'Empresa Pública S.A.');
  assert.deepEqual(result.primaryActivity, {
    code: '6201501',
    description: 'Desenvolvimento de programas',
  });
  assert.equal(result.address.city, 'São Paulo');
  assert.equal(result.provenance.origin, 'external');
  assert.match(result.provenance.retrievedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('CNPJ inválido falha antes de consultar provider', async () => {
  let called = false;
  const provider: CnpjEnrichmentProvider = {
    async lookup() {
      called = true;
      throw new Error('unexpected');
    },
  };

  await assert.rejects(() => new CnpjEnrichmentService(provider).lookup('123'), /INVALID_CNPJ/);
  assert.equal(called, false);
});
