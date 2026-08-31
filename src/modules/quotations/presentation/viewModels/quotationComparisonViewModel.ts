export type MatrixQuotationItem = {
  id: string;
};

export type MatrixSupplierQuotation = {
  id: string;
  status: string;
};

export type MatrixSupplierQuotationItem = {
  supplier_quotation_id: string;
  quotation_item_id: string;
  unit_price: number | null;
  lead_time_days: number | null;
  status: string | null;
  refusal_reason: string | null;
  refusal_notes: string | null;
};

export type SupplierMatrixCellState =
  | 'quoted'
  | 'pending'
  | 'refused'
  | 'not_quoted'
  | 'unpriced'
  | 'missing';

export type SupplierMatrixCell = {
  supplierQuotationId: string;
  quotationItemId: string;
  state: SupplierMatrixCellState;
  status: string | null;
  unitPrice: number | null;
  leadTimeDays: number | null;
  refusalReason: string | null;
  refusalNotes: string | null;
  label: string;
};

export type SupplierMatrixRow<TItem extends MatrixQuotationItem> = {
  item: TItem;
  cells: SupplierMatrixCell[];
};

export type SupplierMatrixViewModel<
  TItem extends MatrixQuotationItem,
  TProposal extends MatrixSupplierQuotation,
> = {
  proposals: TProposal[];
  rows: Array<SupplierMatrixRow<TItem>>;
};

function cellFromRecord(
  proposal: MatrixSupplierQuotation,
  item: MatrixQuotationItem,
  record: MatrixSupplierQuotationItem | undefined,
): SupplierMatrixCell {
  const base = {
    supplierQuotationId: proposal.id,
    quotationItemId: item.id,
    status: record?.status ?? null,
    unitPrice: record?.unit_price ?? null,
    leadTimeDays: record?.lead_time_days ?? null,
    refusalReason: record?.refusal_reason ?? null,
    refusalNotes: record?.refusal_notes ?? null,
  };

  if (record?.status === 'refused') {
    return { ...base, state: 'refused', label: 'Item recusado' };
  }

  if (record?.status === 'pending') {
    return { ...base, state: 'pending', label: 'Pendente' };
  }

  if (record?.status === 'quoted') {
    return record.unit_price == null
      ? { ...base, state: 'unpriced', label: 'Preço não informado' }
      : { ...base, state: 'quoted', label: 'Cotado' };
  }

  if (record) {
    return record.unit_price == null
      ? { ...base, state: 'unpriced', label: record.status || 'Preço não informado' }
      : { ...base, state: 'quoted', label: record.status || 'Cotado' };
  }

  if (proposal.status === 'pending') {
    return { ...base, state: 'pending', label: 'Aguardando cotação' };
  }

  if (proposal.status === 'declined') {
    return { ...base, state: 'refused', label: 'Proposta recusada' };
  }

  if (proposal.status === 'submitted') {
    return { ...base, state: 'not_quoted', label: 'Não cotado' };
  }

  return { ...base, state: 'missing', label: 'Sem registro persistido' };
}

export function buildSupplierMatrix<
  TItem extends MatrixQuotationItem,
  TProposal extends MatrixSupplierQuotation,
>(
  items: TItem[],
  proposals: TProposal[],
  records: MatrixSupplierQuotationItem[],
): SupplierMatrixViewModel<TItem, TProposal> {
  const recordsByKey = new Map(
    records.map(record => [
      `${record.supplier_quotation_id}:${record.quotation_item_id}`,
      record,
    ]),
  );

  return {
    proposals,
    rows: items.map(item => ({
      item,
      cells: proposals.map(proposal => cellFromRecord(
        proposal,
        item,
        recordsByKey.get(`${proposal.id}:${item.id}`),
      )),
    })),
  };
}
