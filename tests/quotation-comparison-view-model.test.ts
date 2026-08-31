import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildSupplierMatrix } from '../src/modules/quotations/presentation/viewModels/quotationComparisonViewModel.ts';
import {
  pendingProposalFixture,
  quotationItemsFixture,
  quotedItemsFixture,
  refusedItemFixture,
  submittedProposalsFixture,
} from './fixtures/quotation-comparison-fixtures.ts';

const comparisonSource = readFileSync(
  join(process.cwd(), 'src/modules/quotations/presentation/pages/QuotationComparisonPage.tsx'),
  'utf8',
);

test('A: no proposals keeps quotation item rows and produces zero supplier columns', () => {
  const matrix = buildSupplierMatrix(quotationItemsFixture, [], []);

  assert.equal(matrix.rows.length, 2);
  assert.equal(matrix.proposals.length, 0);
  assert.ok(matrix.rows.every(row => row.cells.length === 0));
  assert.match(comparisonSource, /Nenhuma proposta persistida\./u);
  assert.match(comparisonSource, /Aguardando análise real/u);
  assert.doesNotMatch(comparisonSource, /Brasil Cabos|Eletro Tudo|Fixação Ind\.|MOCK_DATA_BY_ID|RC-2026-00001/u);
});

test('B: pending supplier without prices remains a real pending column without invented values', () => {
  const matrix = buildSupplierMatrix(quotationItemsFixture, [pendingProposalFixture], []);

  assert.equal(matrix.proposals[0].supplier_name, 'Fornecedor Persistido Pendente');
  assert.equal(matrix.proposals[0].status, 'pending');
  assert.ok(matrix.rows.every(row => row.cells[0].state === 'pending'));
  assert.ok(matrix.rows.every(row => row.cells[0].label === 'Aguardando cotação'));
  assert.ok(matrix.rows.every(row => row.cells[0].unitPrice === null));
});

test('C: two persisted proposals map to two columns with corresponding prices, lead times and totals', () => {
  const matrix = buildSupplierMatrix(quotationItemsFixture, submittedProposalsFixture, quotedItemsFixture);

  assert.equal(matrix.proposals.length, 2);
  assert.deepEqual(matrix.proposals.map(proposal => proposal.total_amount), [4200, 4350]);
  assert.deepEqual(matrix.rows[0].cells.map(cell => cell.unitPrice), [2100, 2175]);
  assert.deepEqual(matrix.rows[0].cells.map(cell => cell.leadTimeDays), [7, 5]);
  assert.doesNotMatch(comparisonSource, /Ouro|Prata|Bronze/u);
});

test('D: refused and not-quoted states come exclusively from persisted item/proposal state', () => {
  const matrix = buildSupplierMatrix(
    quotationItemsFixture,
    submittedProposalsFixture,
    [refusedItemFixture],
  );

  const refused = matrix.rows[1].cells[0];
  assert.equal(refused.state, 'refused');
  assert.equal(refused.refusalReason, 'Fora da linha comercial');
  assert.equal(refused.refusalNotes, 'Fornecedor não atende este item.');

  const absentAfterSubmission = matrix.rows[1].cells[1];
  assert.equal(absentAfterSubmission.state, 'not_quoted');
  assert.equal(absentAfterSubmission.label, 'Não cotado');
});

test('historical 0fa56b4 composition is preserved without its simulated behavior', () => {
  assert.match(comparisonSource, /space-y-6 max-w-7xl mx-auto relative/u);
  assert.match(comparisonSource, /border-0 shadow-md bg-indigo-900/u);
  assert.match(comparisonSource, /grid grid-cols-1 lg:grid-cols-3 gap-6/u);
  assert.match(comparisonSource, /lg:col-span-2 rounded-2xl border-slate-200 shadow-sm/u);
  assert.match(comparisonSource, /Histórico detalhado ainda não disponível./u);
  assert.match(comparisonSource, /Produto \(Qtd\)/u);
  assert.match(comparisonSource, /Valor Global:/u);
  assert.doesNotMatch(comparisonSource, /Aceitar Proposta|Cancelar Proposta|Emitir PDF/u);
});
