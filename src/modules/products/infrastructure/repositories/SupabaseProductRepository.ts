import { supabase } from '../../../../infrastructure/supabase/client';
import { Product, ProductStatus } from '../../domain/entities/Product';
import { IProductRepository } from '../../domain/repositories/IProductRepository';

export type GlobalCatalogMaterial = {
    id: string;
    officialName: string;
    description: string;
    unit: string;
    manufacturerCode: string;
    manufacturer: string;
    category: string;
    categoryId: string | null;
    validationStatus: string;
    linked: boolean;
};

export type OrganizationMaterialSaveInput = {
    internalSku: string;
    erpCode: string;
    displayName: string;
    isActive: boolean;
    commercialConfig: Record<string, unknown>;
    logisticsConfig: Record<string, unknown>;
    relationshipType: 'fabricante' | 'distribuidor' | 'revendedor' | 'fornecedor' | 'comprador';
};

export class SupabaseProductRepository implements IProductRepository {
    private resolveTenantId(authenticatedOrganizationId: string): string {
        if (!authenticatedOrganizationId) {
            throw new Error('A identidade autenticada não possui organização ativa.');
        }
        return authenticatedOrganizationId;
    }

    async findById(id: string, tenantId: string): Promise<Product | null> {
        const actualTenant = this.resolveTenantId(tenantId);
        const { data, error } = await supabase
            .from('products')
            .select('id, organization_id, category_id, material_id, sku, name, description, unit, manufacturer_code, available_for_purchase, available_for_sale, image_url, metadata, created_at, updated_at, categories(name)')
            .eq('id', id)
            .eq('organization_id', actualTenant)
            .limit(1).maybeSingle();
            
        if (error || !data) return null;
        
        return this.mapToDomain(data);
    }

    async findAll(tenantId: string): Promise<Product[]> {
        const actualTenant = this.resolveTenantId(tenantId);
        const { data, error } = await supabase
            .from('products')
            .select('id, organization_id, category_id, material_id, sku, name, description, unit, manufacturer_code, available_for_purchase, available_for_sale, image_url, metadata, created_at, updated_at, categories(name)')
            .eq('organization_id', actualTenant)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        if (!data) return [];
        
        return data.map(row => this.mapToDomain(row));
    }

    async findGlobalMaterials(tenantId: string, page: number, search = '', pageSize = 24): Promise<{ rows: GlobalCatalogMaterial[]; hasMore: boolean }> {
        const actualTenant = this.resolveTenantId(tenantId);
        const from = page * pageSize;
        let query = supabase
            .from('materials')
            .select('id, official_name, description, unit, manufacturer_code, category_id, validation_status, manufacturers(name), categories(name)')
            .eq('is_active', true)
            .is('merged_into_material_id', null)
            .order('official_name')
            .range(from, from + pageSize - 1);
        const normalized = search.trim();
        if (normalized) query = query.or(`official_name.ilike.%${normalized.replace(/[%_,]/g, '')}%,manufacturer_code.ilike.%${normalized.replace(/[%_,]/g, '')}%`);

        const { data, error } = await query;
        if (error) throw error;
        const materialRows = data || [];
        const ids = materialRows.map(row => row.id);
        const { data: links, error: linksError } = ids.length
            ? await supabase.from('organization_materials').select('material_id').eq('organization_id', actualTenant).in('material_id', ids)
            : { data: [], error: null };
        if (linksError) throw linksError;
        const linkedIds = new Set((links || []).map(link => link.material_id));

        return {
            rows: materialRows.map((row: any) => ({
                id: row.id,
                officialName: row.official_name,
                description: row.description || '',
                unit: row.unit || 'UN',
                manufacturerCode: row.manufacturer_code || '',
                manufacturer: Array.isArray(row.manufacturers)
                    ? row.manufacturers[0]?.name || ''
                    : row.manufacturers?.name || '',
                category: Array.isArray(row.categories)
                    ? row.categories[0]?.name || ''
                    : row.categories?.name || '',
                categoryId: row.category_id,
                validationStatus: row.validation_status,
                linked: linkedIds.has(row.id),
            })),
            hasMore: materialRows.length === pageSize,
        };
    }

    async save(product: Product): Promise<void> {
        const actualTenant = this.resolveTenantId(product.tenantId);
        
        const finalCategoryId = product.categoryId;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(finalCategoryId)) {
            throw new Error('Selecione uma categoria canônica válida para o material.');
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
            manufacturer_code: product.manufacturerCode || null,
            available_for_purchase: product.availableForPurchase,
            available_for_sale: product.availableForSale,
            image_url: product.imageUrl || null,
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

    async saveTenantMaterial(
        product: Product,
        organizationMaterial?: OrganizationMaterialSaveInput,
    ): Promise<void> {
        this.resolveTenantId(product.tenantId);
        const hasMaterial = Boolean(product.materialId);

        if (hasMaterial !== Boolean(organizationMaterial)) {
            throw new Error('Dados do vínculo organizacional devem acompanhar o material master.');
        }

        const categoryId = product.categoryId || null;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (categoryId && !uuidRegex.test(categoryId)) {
            throw new Error('Selecione uma categoria interna válida para o material.');
        }

        const { error } = await supabase.rpc('save_organization_material_product', {
            p_product_id: product.id,
            p_material_id: product.materialId || null,
            p_category_id: categoryId,
            p_name: product.name,
            p_description: product.description,
            p_unit: product.uom,
            p_sku: product.sku || null,
            p_manufacturer_code: product.manufacturerCode || null,
            p_available_for_purchase: product.availableForPurchase,
            p_available_for_sale: product.availableForSale,
            p_image_url: product.imageUrl || null,
            p_metadata: {
                manufacturer_code: product.manufacturerCode,
                technical_description: product.technicalDescription,
                image_url: product.imageUrl,
                manufacturer: product.manufacturer,
                price: product.price,
                available_for_purchase: product.availableForPurchase,
                available_for_sale: product.availableForSale,
                status: product.status,
                attachments: product.attachments || [],
            },
            p_internal_sku: organizationMaterial?.internalSku || null,
            p_erp_code: organizationMaterial?.erpCode || null,
            p_display_name: organizationMaterial?.displayName || null,
            p_is_active: organizationMaterial?.isActive ?? true,
            p_commercial_config: organizationMaterial?.commercialConfig || {},
            p_logistics_config: organizationMaterial?.logisticsConfig || {},
            p_relationship_type: organizationMaterial?.relationshipType || null,
        });

        if (error) {
            console.error('Supabase atomic tenant material save error:', error);
            throw error;
        }

        // The organization is derived again inside the RPC from the authenticated
        // identity, so tenantId is never treated as an authority-bearing field.
    }
    
    async delete(id: string, tenantId: string): Promise<void> {
        const actualTenant = this.resolveTenantId(tenantId);
        
        const { count, error: countErr } = await supabase
            .from('quotation_items')
            .select('id', { count: 'exact', head: true })
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
            Array.isArray(row.categories) ? row.categories[0]?.name : row.categories?.name,
            row.manufacturer_code || meta.manufacturer_code || '',
            row.available_for_purchase ?? false,
            row.available_for_sale ?? false,
            row.image_url || meta.image_url || '',
            meta.technical_description || '',
            meta.attachments || []
        );
    }
}
