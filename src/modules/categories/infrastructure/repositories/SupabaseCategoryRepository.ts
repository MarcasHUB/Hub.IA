import { supabase } from '../../../../infrastructure/supabase/client';
import { Category, CategoryStatus } from '../../domain/entities/Category';
import { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import { getAuthenticatedIdentity } from '@/modules/auth/application/services/getAuthenticatedIdentity';

export class CategoryAlreadyExistsError extends Error {
  constructor(message: string = 'Já existe uma categoria com esse nome no catálogo.') {
    super(message);
    this.name = 'CategoryAlreadyExistsError';
  }
}

export class SupabaseCategoryRepository implements ICategoryRepository {
    private async resolveTenantId(_untrustedTenantId: string): Promise<string> {
        return (await getAuthenticatedIdentity()).organizationId;
    }

    async findById(id: string, tenantId: string): Promise<Category | null> {
        let query = supabase
            .from('categories')
            .select('*')
            .eq('id', id);

        if (tenantId === 'GLOBAL') query = query.is('organization_id', null);

        const { data, error } = await query.limit(1).maybeSingle();

        if (error || !data) return null;
        return this.mapToDomain(data);
    }

    async findAll(tenantId: string): Promise<Category[]> {
        let query = supabase
            .from('categories')
            .select('*')
            .order('name', { ascending: true });

        if (tenantId === 'GLOBAL') query = query.is('organization_id', null);

        const { data, error } = await query;

        if (error || !data) return [];
        
        const uniqueMap = new Map();
        for (const row of data) {
           const normalizedName = (row.name || '').toLowerCase().trim();
           const key = normalizedName;
           
           if (!uniqueMap.has(key)) {
               uniqueMap.set(key, row);
           } else {
               // Shared catalog: keep the first canonical row returned by name.
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
        let query = supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (tenantId === 'GLOBAL') {
            query = query.is('organization_id', null);
        } else {
            query = query.eq('organization_id', await this.resolveTenantId(tenantId));
        }

        const { error } = await query;

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
