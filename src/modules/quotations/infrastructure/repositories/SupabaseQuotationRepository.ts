import { supabase } from '@/infrastructure/supabase/client';

export type PurchaseMaterial = {
  organizationMaterialId: string;
  productId: string;
  materialId: string;
  displayName: string;
  officialName: string;
  internalSku: string;
  erpCode: string;
  manufacturer: string;
  manufacturerCode: string;
  category: string;
  unit: string;
};

export type EligiblePartner = {
  organizationId: string;
  tradeName: string;
  legalName: string;
};

export type CreateQuotationInput = {
  type: 'BID' | 'DIRECT';
  dueDate: string;
  priority: string;
  notes: string;
  targetOrganizationId?: string;
  items: Array<{ productId: string; quantity: number }>;
};

export type CreatedQuotation = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  organization_id: string;
};

type OrganizationMaterialRow = {
  id: string;
  material_id: string;
  display_name: string | null;
  internal_sku: string | null;
  erp_code: string | null;
};

function firstRelation<T>(relation: T | T[] | null | undefined): T | undefined {
  return Array.isArray(relation) ? relation[0] : relation ?? undefined;
}

export class SupabaseQuotationRepository {
  async searchPurchaseMaterials(organizationId: string, search: string): Promise<PurchaseMaterial[]> {
    const { data: links, error: linksError } = await supabase
      .from('organization_materials')
      .select('id, material_id, display_name, internal_sku, erp_code')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .eq('available_for_purchase', true)
      .order('display_name')
      .limit(100);
    if (linksError) throw linksError;

    const materialIds = (links ?? []).map(link => link.material_id);
    if (materialIds.length === 0) return [];

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, material_id, name, unit, manufacturer_code, categories(name)')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .eq('available_for_purchase', true)
      .in('material_id', materialIds);
    if (productsError) throw productsError;

    const productByMaterial = new Map((products ?? []).map(product => [product.material_id, product]));
    const normalized = search.trim().toLocaleLowerCase('pt-BR');

    return ((links ?? []) as OrganizationMaterialRow[])
      .map(link => {
        const product = productByMaterial.get(link.material_id);
        if (!product) return null;
        return {
          organizationMaterialId: link.id,
          productId: product.id,
          materialId: link.material_id,
          displayName: link.display_name || product.name,
          officialName: product.name,
          internalSku: link.internal_sku || '',
          erpCode: link.erp_code || '',
          manufacturer: '',
          manufacturerCode: product.manufacturer_code || '',
          category: firstRelation(product.categories)?.name || '',
          unit: product.unit || 'UN',
        } satisfies PurchaseMaterial;
      })
      .filter((item): item is PurchaseMaterial => Boolean(item))
      .filter(item => !normalized || [
        item.displayName,
        item.officialName,
        item.internalSku,
        item.erpCode,
        item.manufacturer,
        item.manufacturerCode,
      ].some(value => value.toLocaleLowerCase('pt-BR').includes(normalized)))
      .slice(0, 20);
  }

  async listEligiblePartners(organizationId: string): Promise<EligiblePartner[]> {
    const { data: connections, error: connectionsError } = await supabase
      .from('connection_requests')
      .select('requester_company_id, target_company_id')
      .eq('status', 'accepted')
      .or(`requester_company_id.eq.${organizationId},target_company_id.eq.${organizationId}`);
    if (connectionsError) throw connectionsError;

    const partnerIds = [...new Set((connections ?? []).map(connection =>
      connection.requester_company_id === organizationId
        ? connection.target_company_id
        : connection.requester_company_id,
    ))];
    if (partnerIds.length === 0) return [];

    const { data, error } = await supabase
      .from('organizations')
      .select('id, nome_fantasia, razao_social, name')
      .in('id', partnerIds)
      .in('status', ['ativo', 'active'])
      .order('nome_fantasia');
    if (error) throw error;

    return (data ?? []).map(partner => ({
      organizationId: partner.id,
      tradeName: partner.nome_fantasia || partner.name || partner.razao_social,
      legalName: partner.razao_social || partner.name,
    }));
  }

  async create(input: CreateQuotationInput): Promise<CreatedQuotation> {
    const { data, error } = await supabase.rpc('create_procurement_quotation', {
      p_type: input.type,
      p_due_date: input.dueDate,
      p_priority_level: input.priority,
      p_notes: input.notes || null,
      p_items: input.items.map(item => ({ product_id: item.productId, quantity: item.quantity })),
      p_target_organization_id: input.targetOrganizationId || null,
    });
    if (error) throw error;
    const created = Array.isArray(data) ? data[0] : data;
    if (!created?.id) throw new Error('O backend não retornou a cotação persistida.');
    return created as CreatedQuotation;
  }
}
