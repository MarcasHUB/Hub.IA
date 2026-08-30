import { supabase } from '@/infrastructure/supabase/client';

export type QuotationRequestDetails = {
  id: string;
  title: string;
  request_type: 'BID' | 'DIRECT' | null;
  status: string;
  requester_name_snapshot: string | null;
  created_at: string;
  due_date: string | null;
  priority_level: string | null;
  notes: string | null;
};

export type QuotationItemDetails = {
  id: string;
  product_id: string;
  product_name_snapshot: string | null;
  manufacturer_name_snapshot: string | null;
  manufacturer_code_snapshot: string | null;
  internal_sku_snapshot: string | null;
  description_snapshot: string | null;
  quantity: number;
  unit: string;
  unit_snapshot: string | null;
  category_name_snapshot: string | null;
};

export type SupplierQuotationSummary = {
  id: string;
  supplier_id: string;
  supplier_organization_id: string | null;
  supplier_name: string;
  status: string;
  total_amount: number | null;
  submitted_at: string | null;
};

export type QuotationOverview = {
  request: QuotationRequestDetails;
  items: QuotationItemDetails[];
  recipients: SupplierQuotationSummary[];
};

type SupplierRelation = {
  trade_name: string | null;
  legal_name: string;
};

type SupplierQuotationResult = Omit<SupplierQuotationSummary, 'supplier_name'> & {
  suppliers: SupplierRelation | SupplierRelation[] | null;
};

function firstRelation<T>(relation: T | T[] | null): T | undefined {
  return Array.isArray(relation) ? relation[0] : relation ?? undefined;
}

export async function loadQuotationOverview(id: string): Promise<QuotationOverview> {
  const [requestResult, itemsResult, recipientsResult] = await Promise.all([
    supabase
      .from('quotation_requests')
      .select('id, title, request_type, status, requester_name_snapshot, created_at, due_date, priority_level, notes')
      .eq('id', id)
      .single(),
    supabase
      .from('quotation_items')
      .select('id, product_id, product_name_snapshot, manufacturer_name_snapshot, manufacturer_code_snapshot, internal_sku_snapshot, description_snapshot, quantity, unit, unit_snapshot, category_name_snapshot')
      .eq('request_id', id)
      .order('created_at'),
    supabase
      .from('supplier_quotations')
      .select('id, supplier_id, supplier_organization_id, status, total_amount, submitted_at, suppliers(trade_name, legal_name)')
      .eq('request_id', id)
      .order('created_at'),
  ]);

  const error = requestResult.error || itemsResult.error || recipientsResult.error;
  if (error) throw error;

  const recipients = ((recipientsResult.data ?? []) as SupplierQuotationResult[]).map(row => {
    const supplier = firstRelation(row.suppliers);
    return {
      id: row.id,
      supplier_id: row.supplier_id,
      supplier_organization_id: row.supplier_organization_id,
      supplier_name: supplier?.trade_name || supplier?.legal_name || row.supplier_id,
      status: row.status,
      total_amount: row.total_amount,
      submitted_at: row.submitted_at,
    };
  });

  return {
    request: requestResult.data as QuotationRequestDetails,
    items: (itemsResult.data ?? []) as QuotationItemDetails[],
    recipients,
  };
}
