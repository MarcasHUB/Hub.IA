import { supabase } from '../../../../infrastructure/supabase/client';
import { Category, CategoryStatus } from '../../domain/entities/Category';
import { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';

export class CategoryAlreadyExistsError extends Error {
  constructor(message: string = 'Já existe uma categoria com esse nome nesta empresa.') {
    super(message);
    this.name = 'CategoryAlreadyExistsError';
  }
}

export class SupabaseCategoryRepository implements ICategoryRepository {
    private async resolveTenantId(tenantId: string): Promise<string> {
        if (tenantId !== '00000000-0000-0000-0000-000000000000') return tenantId;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return tenantId;
        const { data } = await supabase.from('user_roles').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle();
        return data?.organization_id || tenantId;
    }

    async findById(id: string, tenantId: string): Promise<Category | null> {
        const actualTenant = await this.resolveTenantId(tenantId);
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('id', id)
            .or(`organization_id.eq.${actualTenant},organization_id.is.null`)
            .limit(1).maybeSingle();

        if (error || !data) return null;
        return this.mapToDomain(data);
    }

    async findAll(tenantId: string): Promise<Category[]> {
        const actualTenant = await this.resolveTenantId(tenantId);
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .or(`organization_id.eq.${actualTenant},organization_id.is.null`)
            .order('name', { ascending: true });

        if (error || !data) return [];
        
        const uniqueMap = new Map();
        for (const row of data) {
           const normalizedName = (row.name || '').toLowerCase().trim();
           const key = normalizedName;
           
           if (!uniqueMap.has(key)) {
               uniqueMap.set(key, row);
           } else {
               // Se já existe, preferir a local sobre a global
               const existing = uniqueMap.get(key);
               if (!existing.organization_id && row.organization_id) {
                   uniqueMap.set(key, row);
               }
           }
        }

        return Array.from(uniqueMap.values()).map(row => this.mapToDomain(row));
    }

    async save(category: Category): Promise<void> {
        let actualTenant: string | null = null;
        if (category.tenantId !== 'GLOBAL') {
            actualTenant = await this.resolveTenantId(category.tenantId);
        }

        const payload = {
            id: category.id,
            organization_id: actualTenant,
            name: category.name,
            description: category.description,
            is_active: category.status === CategoryStatus.ACTIVE,
            parent_id: category.parentId || null,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('categories')
            .upsert(payload, { onConflict: 'id' });

        if (error) {
            console.error('Supabase save category error:', error);
            if (error.code === '23505') {
                throw new CategoryAlreadyExistsError();
            }
            throw error;
        }
    }

    async delete(id: string, tenantId: string): Promise<void> {
        const actualTenant = await this.resolveTenantId(tenantId);
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id)
            .eq('organization_id', actualTenant);

        if (error) {
            console.error('Supabase delete category error:', error);
            throw error;
        }
    }

    private mapToDomain(row: any): Category {
        return new Category(
            row.id,
            row.organization_id || 'GLOBAL',
            row.name,
            row.description || '',
            row.parent_id,
            row.is_active !== false ? CategoryStatus.ACTIVE : CategoryStatus.INACTIVE,
            new Date(row.created_at),
            new Date(row.updated_at)
        );
    }
}
