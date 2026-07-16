import { supabase } from '../../../../infrastructure/supabase/client';
import { IProductSupplierRepository } from '../../domain/repositories/IProductSupplierRepository';

export class SupabaseProductSupplierRepository implements IProductSupplierRepository {
    async linkSuppliers(productId: string, supplierIds: string[]): Promise<void> {
        if (!supplierIds || supplierIds.length === 0) return;

        // Recuperar o organization_id da sessão logada usando user_roles
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data: roleData } = await supabase.from('user_roles').select('organization_id').eq('user_id', user.id).single();
        if (!roleData) throw new Error("Usuário não vinculado a nenhuma organização");

        const organizationId = roleData.organization_id;

        const payload = supplierIds.map(supplierId => ({
            organization_id: organizationId,
            product_id: productId,
            supplier_id: supplierId
        }));

        // Upsert ignorando conflitos de chave única (evita erro se já existir)
        const { error } = await supabase
            .from('product_suppliers')
            .upsert(payload, { onConflict: 'product_id,supplier_id', ignoreDuplicates: true });

        if (error) {
            console.error('Supabase linkSuppliers error:', error);
            throw error;
        }
    }

    async unlinkSupplier(productId: string, supplierId: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data: roleData } = await supabase.from('user_roles').select('organization_id').eq('user_id', user.id).single();
        if (!roleData) return;

        const organizationId = roleData.organization_id;

        const { error } = await supabase
            .from('product_suppliers')
            .delete()
            .eq('product_id', productId)
            .eq('supplier_id', supplierId)
            .eq('organization_id', organizationId);

        if (error) {
            console.error('Supabase unlinkSupplier error:', error);
            throw error;
        }
    }

    async getSuppliersByProduct(productId: string): Promise<string[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data: roleData } = await supabase.from('user_roles').select('organization_id').eq('user_id', user.id).single();
        if (!roleData) return [];

        const organizationId = roleData.organization_id;

        const { data, error } = await supabase
            .from('product_suppliers')
            .select('supplier_id')
            .eq('product_id', productId)
            .eq('organization_id', organizationId);

        if (error || !data) return [];
        
        return data.map(row => row.supplier_id);
    }

    async getSupplierLinksByProduct(productId: string): Promise<any[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data: roleData } = await supabase.from('user_roles').select('organization_id').eq('user_id', user.id).single();
        if (!roleData) return [];

        const organizationId = roleData.organization_id;

        const { data, error } = await supabase
            .from('product_suppliers')
            .select('*, suppliers(*)')
            .eq('product_id', productId)
            .eq('organization_id', organizationId);

        if (error || !data) return [];
        return data;
    }

    async updateSupplierLink(productId: string, supplierId: string, payload: any): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data: roleData } = await supabase.from('user_roles').select('organization_id').eq('user_id', user.id).single();
        if (!roleData) return;

        const organizationId = roleData.organization_id;

        const { error } = await supabase
            .from('product_suppliers')
            .update(payload)
            .eq('product_id', productId)
            .eq('supplier_id', supplierId)
            .eq('organization_id', organizationId);

        if (error) {
            console.error('Supabase updateSupplierLink error:', error);
            throw error;
        }
    }
}
