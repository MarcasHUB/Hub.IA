import { supabase } from '../../../../infrastructure/supabase/client';
import { Product, ProductStatus } from '../../domain/entities/Product';
import { IProductRepository } from '../../domain/repositories/IProductRepository';

export class SupabaseProductRepository implements IProductRepository {
    private async resolveTenantId(tenantId: string): Promise<string> {
        if (tenantId !== '00000000-0000-0000-0000-000000000000') return tenantId;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return tenantId;
        const { data } = await supabase.from('user_roles').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle();
        return data?.organization_id || tenantId;
    }

    private async resolveCategoryId(actualTenant: string): Promise<string> {
        const { data, error } = await supabase.from('categories').select('id').eq('organization_id', actualTenant).limit(1).limit(1).maybeSingle();
        if (data) return data.id;

        const newCategoryId = crypto.randomUUID();
        const { error: insertError } = await supabase.from('categories').insert({ 
            id: newCategoryId, 
            organization_id: actualTenant, 
            name: 'Categoria Geral', 
            is_active: true
        });

        if (insertError) {
             console.error('Failed to create default category:', insertError);
             throw insertError;
        }
        return newCategoryId;
    }

    async findById(id: string, tenantId: string): Promise<Product | null> {
        const actualTenant = await this.resolveTenantId(tenantId);
        const { data, error } = await supabase
            .from('products')
            .select(`*, categories(name)`)
            .eq('id', id)
            .eq('organization_id', actualTenant)
            .limit(1).maybeSingle();
            
        if (error || !data) return null;
        
        return this.mapToDomain(data);
    }

    async findAll(tenantId: string): Promise<Product[]> {
        const actualTenant = await this.resolveTenantId(tenantId);
        const { data, error } = await supabase
            .from('products')
            .select(`*, categories(name)`)
            .eq('organization_id', actualTenant)
            .order('created_at', { ascending: false });
            
        if (error || !data) return [];
        
        return data.map(row => this.mapToDomain(row));
    }

    async save(product: Product): Promise<void> {
        const actualTenant = await this.resolveTenantId(product.tenantId);
        
        let finalCategoryId = product.categoryId;
        if (!finalCategoryId || finalCategoryId === 'mocked-category-id') {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(finalCategoryId)) {
                 finalCategoryId = await this.resolveCategoryId(actualTenant);
            }
        }

        const payload = {
            id: product.id,
            organization_id: actualTenant,
            category_id: finalCategoryId,
            material_id: product.materialId || null,
            sku: product.sku || null,
            name: product.name,
            description: product.description,
            unit: product.uom,
            metadata: {
                manufacturer_code: product.manufacturerCode,
                technical_description: product.technicalDescription,
                image_url: product.imageUrl,
                manufacturer: product.manufacturer,
                price: product.price,
                available_for_purchase: product.availableForPurchase,
                available_for_sale: product.availableForSale,
                status: product.status,
                attachments: product.attachments || []
            },
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
        
        const { count, error: countErr } = await supabase
            .from('quotation_items')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', id);

        if (countErr) throw countErr;

        if (count && count > 0) {
            throw new Error("Este material possui histórico ou vínculo com cotações e não pode ser excluído fisicamente.");
        }

        const product = await this.findById(id, actualTenant);
        if (product) {
            product.status = ProductStatus.INACTIVE;
            await this.save(product);
        } else {
            throw new Error("Produto não encontrado.");
        }
    }

    private mapToDomain(row: any): Product {
        const meta = row.metadata || {};
        return new Product(
            row.id,
            row.organization_id,
            '', 
            row.category_id,
            row.name,
            row.description || '',
            row.sku || '',
            row.unit || 'UN',
            meta.manufacturer || '',
            meta.price || 0,
            meta.status || ProductStatus.ACTIVE,
            row.material_id || undefined,
            new Date(row.created_at),
            new Date(row.updated_at),
            row.categories?.name,
            meta.manufacturer_code || '',
            meta.available_for_purchase ?? true,
            meta.available_for_sale ?? false,
            meta.image_url || '',
            meta.technical_description || '',
            meta.attachments || []
        );
    }
}
