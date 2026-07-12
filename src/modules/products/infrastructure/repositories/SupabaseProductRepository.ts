import { supabase } from '../../../../infrastructure/supabase/client';
import { Product, ProductStatus } from '../../domain/entities/Product';
import { IProductRepository } from '../../domain/repositories/IProductRepository';

export class SupabaseProductRepository implements IProductRepository {
    async findById(id: string, tenantId: string): Promise<Product | null> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .single();
            
        if (error || !data) return null;
        
        return this.mapToDomain(data);
    }

    async findAll(tenantId: string): Promise<Product[]> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });
            
        if (error || !data) return [];
        
        return data.map(row => this.mapToDomain(row));
    }

    async save(product: Product): Promise<void> {
        const payload = {
            id: product.id,
            tenant_id: product.tenantId,
            supplier_id: product.supplierId,
            category_id: product.categoryId,
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
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenantId);
            
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
