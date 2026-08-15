import { supabase } from '../../../../infrastructure/supabase/client';
import { IProductSupplierRepository } from '../../domain/repositories/IProductSupplierRepository';
import { getAuthenticatedIdentity } from '@/modules/auth/application/services/getAuthenticatedIdentity';

export class SupabaseProductSupplierRepository implements IProductSupplierRepository {
  private async organizationId(): Promise<string> {
    return (await getAuthenticatedIdentity()).organizationId;
  }

  async linkSuppliers(productId: string, supplierIds: string[]): Promise<void> {
    if (!supplierIds?.length) return;
    const organizationId = await this.organizationId();
    const payload = supplierIds.map(supplierId => ({
      organization_id: organizationId,
      product_id: productId,
      supplier_id: supplierId,
    }));
    const { error } = await supabase.from('product_suppliers')
      .upsert(payload, { onConflict: 'product_id,supplier_id', ignoreDuplicates: true });
    if (error) throw error;
  }

  async unlinkSupplier(productId: string, supplierId: string): Promise<void> {
    const organizationId = await this.organizationId();
    const { error } = await supabase.from('product_suppliers').delete()
      .eq('product_id', productId)
      .eq('supplier_id', supplierId)
      .eq('organization_id', organizationId);
    if (error) throw error;
  }

  async getSuppliersByProduct(productId: string): Promise<string[]> {
    const organizationId = await this.organizationId();
    const { data, error } = await supabase.from('product_suppliers')
      .select('supplier_id')
      .eq('product_id', productId)
      .eq('organization_id', organizationId);
    if (error || !data) return [];
    return data.map(row => row.supplier_id);
  }

  async getSupplierLinksByProduct(productId: string): Promise<any[]> {
    const organizationId = await this.organizationId();
    const { data, error } = await supabase.from('product_suppliers')
      .select('*, suppliers(*)')
      .eq('product_id', productId)
      .eq('organization_id', organizationId);
    if (error || !data) return [];
    return data;
  }

  async updateSupplierLink(productId: string, supplierId: string, payload: any): Promise<void> {
    const organizationId = await this.organizationId();
    const { error } = await supabase.from('product_suppliers').update(payload)
      .eq('product_id', productId)
      .eq('supplier_id', supplierId)
      .eq('organization_id', organizationId);
    if (error) throw error;
  }
}
