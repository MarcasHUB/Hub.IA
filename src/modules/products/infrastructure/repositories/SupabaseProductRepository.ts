import { supabase } from '../../../../infrastructure/supabase/client';
import { Product, ProductStatus } from '../../domain/entities/Product';
import { IProductRepository } from '../../domain/repositories/IProductRepository';

export class SupabaseProductRepository implements IProductRepository {
    private async resolveTenantId(tenantId: string): Promise<string> {
        if (tenantId !== '00000000-0000-0000-0000-000000000000') return tenantId;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return tenantId;
        const { data } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
        return data?.organization_id || tenantId;
    }

    private async resolveSupplierId(actualTenant: string): Promise<string> {
        // Find any existing supplier for this tenant
        const { data } = await supabase.from('suppliers').select('id').eq('tenant_id', actualTenant).limit(1).single();
        if (data) return data.id;
        
        // If none exists, create a default one
        const newSupplierId = crypto.randomUUID();
        await supabase.from('suppliers').insert({
            id: newSupplierId,
            tenant_id: actualTenant,
            name: 'Fornecedor Padrão (Auto)',
            document: '00.000.000/0001-00',
            status: 'Approved'
        });
        return newSupplierId;
    }

    private async resolveCategoryId(actualTenant: string): Promise<string> {
        // Find any existing category
        const { data } = await supabase.from('categories').select('id').eq('tenant_id', actualTenant).limit(1).single();
        if (data) return data.id;

        // Create default category
        const newCategoryId = crypto.randomUUID();
        await supabase.from('categories').insert({
            id: newCategoryId,
            tenant_id: actualTenant,
            name: 'Categoria Geral',
            status: 'Active'
        });
        return newCategoryId;
    }

    async findById(id: string, tenantId: string): Promise<Product | null> {
        const actualTenant = await this.resolveTenantId(tenantId);
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', actualTenant)
            .single();
            
        if (error || !data) return null;
        
        return this.mapToDomain(data);
    }

    async findAll(tenantId: string): Promise<Product[]> {
        const actualTenant = await this.resolveTenantId(tenantId);
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('tenant_id', actualTenant)
            .order('created_at', { ascending: false });
            
        if (error || !data) return [];
        
        return data.map(row => this.mapToDomain(row));
    }

    async save(product: Product): Promise<void> {
        const actualTenant = await this.resolveTenantId(product.tenantId);
        
        // Resolve Mocked FKs
        let finalSupplierId = product.supplierId;
        let finalCategoryId = product.categoryId;
        
        if (!finalSupplierId || finalSupplierId === 'supplier-id' || finalSupplierId === 'mocked-supplier-id') {
            finalSupplierId = await this.resolveSupplierId(actualTenant);
        }
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
            supplier_id: finalSupplierId,
            category_id: finalCategoryId,
            name: product.name,
            description: product.description,
            sku: product.sku,
            uom: product.uom,
            manufacturer: product.manufacturer,
            price: product.price,
            status: product.status,
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
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id)
            .eq('tenant_id', actualTenant);
            
        if (error) {
            console.error('Supabase delete product error:', error);
            throw error;
        }
    }

    private mapToDomain(row: any): Product {
        return new Product(
            row.id,
            row.tenant_id,
            row.supplier_id,
            row.category_id,
            row.name,
            row.description || '',
            row.sku,
            row.uom,
            row.manufacturer || '',
            Number(row.price),
            row.status as ProductStatus,
            new Date(row.created_at),
            new Date(row.updated_at)
        );
    }
}
