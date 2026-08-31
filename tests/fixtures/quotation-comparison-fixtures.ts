import type {
  MatrixSupplierQuotationItem,
} from '../../src/modules/quotations/presentation/viewModels/quotationComparisonViewModel.ts';

export const quotationItemsFixture = [
  { id: 'item-impact-wrench', name: 'Chave Impacto 1200nm' },
  { id: 'item-gloves', name: 'Luva de proteção' },
];

export const pendingProposalFixture = {
  id: 'proposal-pending',
  status: 'pending',
  supplier_name: 'Fornecedor Persistido Pendente',
  total_amount: null,
};

export const submittedProposalsFixture = [
  {
    id: 'proposal-alpha',
    status: 'submitted',
    supplier_name: 'Fornecedor Persistido Alpha',
    total_amount: 4200,
  },
  {
    id: 'proposal-beta',
    status: 'submitted',
    supplier_name: 'Fornecedor Persistido Beta',
    total_amount: 4350,
  },
];

export const quotedItemsFixture: MatrixSupplierQuotationItem[] = [
  { supplier_quotation_id: 'proposal-alpha', quotation_item_id: 'item-impact-wrench', unit_price: 2100, lead_time_days: 7, status: 'quoted', refusal_reason: null, refusal_notes: null },
  { supplier_quotation_id: 'proposal-alpha', quotation_item_id: 'item-gloves', unit_price: 20, lead_time_days: 3, status: 'quoted', refusal_reason: null, refusal_notes: null },
  { supplier_quotation_id: 'proposal-beta', quotation_item_id: 'item-impact-wrench', unit_price: 2175, lead_time_days: 5, status: 'quoted', refusal_reason: null, refusal_notes: null },
  { supplier_quotation_id: 'proposal-beta', quotation_item_id: 'item-gloves', unit_price: 18, lead_time_days: 4, status: 'quoted', refusal_reason: null, refusal_notes: null },
];

export const refusedItemFixture: MatrixSupplierQuotationItem = {
  supplier_quotation_id: 'proposal-alpha',
  quotation_item_id: 'item-gloves',
  unit_price: null,
  lead_time_days: null,
  status: 'refused',
  refusal_reason: 'Fora da linha comercial',
  refusal_notes: 'Fornecedor não atende este item.',
};
