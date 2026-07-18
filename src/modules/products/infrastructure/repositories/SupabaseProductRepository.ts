import { supabase } from '../../../../infrastructure/supabase/client';
import { Product, ProductStatus } from '../../domain/entities/Product';
import { IProductRepository } from '../../domain/repositories/IProductRepository';

export class SupabaseProductRepository implements IProductRepository {
    private async resolveTenantId(tenantId: string): Promise<string> {
        if (tenantId !== '00000000-0000-0000-0000-000000000000') return tenantId;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return tenantId;
        const { data } = await supabase.from('user_roles').select('organization_id').eq('user_id', user.id).single();
        return data?.organization_id || tenantId;
    }

    private async resolveCategoryId(actualTenant: string): Promise<string> {
        // Try with organization_id (assuming schema refactor)
        let res = await supabase.from('categories').select('id').eq('organization_id', actualTenant).limit(1).single();
        if (res.data) return res.data.id;

        // If organization_id column does not exist, try tenant_id
        if (res.error && res.error.code === 'PGRST204') {
            res = await supabase.from('categories').select('id').eq('tenant_id', actualTenant).limit(1).single();
            if (res.data) return res.data.id;
        }

        // If no category exists, create a default one using organization_id (if preferred) or fallback to tenant_id
        const newCategoryId = crypto.randomUUID();
        const usesOrganizationId = !(res.error && res.error.code === 'PGRST204');
        
        let insertError;
        
        if (usesOrganizationId) {
            const { error } = await supabase.from('categories').insert({ 
                id: newCategoryId, 
                organization_id: actualTenant, 
                name: 'Categoria Geral', 
                status: 'Active' 
            });
            insertError = error;
        } else {
            const { error } = await supabase.from('categories').insert({ 
                id: newCategoryId, 
                tenant_id: actualTenant, 
                name: 'Categoria Geral', 
                status: 'Active' 
            });
            insertError = error;
        }

        if (insertError) {
             console.error('Failed to create default category:', insertError);
             // If creation fails, we must throw because we cannot proceed with an invalid FK
             throw insertError;
        }
        return newCategoryId;
    }

    async findById(id: string, tenantId: string): Promise<Product | null> {
        const actualTenant = await this.resolveTenantId(tenantId);
        const { data, error } = await supabase
            .from('products')
            .select(`*`)
            .eq('id', id)
            .eq('tenant_id', actualTenant)
            .is('deleted_at', null)
            .single();
            
        if (error || !data) return null;
        
        return this.mapToDomain(data);
    }

    async findAll(tenantId: string): Promise<Product[]> {
        const actualTenant = await this.resolveTenantId(tenantId);
        const { data, error } = await supabase
            .from('products')
            .select(`*`)
            .eq('tenant_id', actualTenant)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
            
        if (error || !data) return [];
        
        return data.map(row => this.mapToDomain(row));
    }

    async save(product: Product): Promise<void> {
        const actualTenant = await this.resolveTenantId(product.tenantId);
        
        // Resolve Mocked FKs
        let finalCategoryId = product.categoryId;
        
        if (!finalCategoryId || finalCategoryId === 'mocked-category-id') {
            // Check if it's a valid UUID, otherwise it's probably the category name from UI
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(finalCategoryId)) {
                 finalCategoryId = await this.resolveCategoryId(actualTenant);
            }
        }

        const payload = {
            id: product.id,
            tenant_id: actualTenant,
            category_id: finalCategoryId,
            sku: product.sku,
            name: product.name,
            description: product.description,
            unit: product.uom,
            manufacturer_code: product.manufacturerCode,
            available_for_purchase: product.availableForPurchase,
            available_for_sale: product.availableForSale,
            image_url: product.imageUrl,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('products')
            .upsert(payload, { onConflict: 'id' });

        if (error) {
            console.error('Supabase save product error:', error);
            throw error;
        }
    }
    
    async delete(id: string, tenantId: string): Promise<void> {
        const actualTenant = await this.resolveTenantId(tenantId);
        
        // Verifica histórico
        const { count, error: countErr } = await supabase
            .from('quotation_items')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', id);

        if (countErr) throw countErr;

        if (count && count > 0) {
            // Regra exigida: Se tiver vínculo, bloqueia ou avisa (neste caso lançamos o erro para a UI tratar)
            throw new Error("Este material possui histórico ou vínculo com cotações e não pode ser excluído fisicamente. Ele será inativado para preservar o histórico.");
        }

        const { error } = await supabase
            .from('products')
            .update({ status: 'Inactive', deleted_at: new Date().toISOString() })
            .eq('id', id)
            .eq('tenant_id', actualTenant);
            
        if (error) {
            console.error('Supabase delete product error:', error);
            throw error;
        }
    }

    private mapToDomain(row: any): Product {
        // categoryName não é resolvido automaticamente sem join
        let categoryName: string | undefined = undefined;

        return new Product(
            row.id,
            row.tenant_id || row.organization_id, // fallback for legacy
            '', // supplier_id omitido
            row.category_id,
            row.name,
            row.description || '',
            row.sku,
            row.unit,
            '', // manufacturer omitido
            0, // price omitido
            ProductStatus.ACTIVE, // status padrão
            new Date(row.created_at),
            new Date(row.updated_at),
            categoryName,
            row.manufacturer_code,
            row.available_for_purchase ?? true,
            row.available_for_sale ?? false,
            row.image_url
        );
    }
}
