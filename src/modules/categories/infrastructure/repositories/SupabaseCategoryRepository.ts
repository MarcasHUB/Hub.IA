import { supabase } from '../../../../infrastructure/supabase/client';
import { Category, CategoryStatus } from '../../domain/entities/Category';
import { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';

export class SupabaseCategoryRepository implements ICategoryRepository {
    private async resolveTenantId(tenantId: string): Promise<string> {
        if (tenantId !== '00000000-0000-0000-0000-000000000000') return tenantId;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return tenantId;
        const { data } = await supabase.from('user_roles').select('organization_id').eq('user_id', user.id).single();
        return data?.organization_id || tenantId;
    }

    async findById(id: string, tenantId: string): Promise<Category | null> {
        const actualTenant = await this.resolveTenantId(tenantId);
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('id', id)
            .or(`organization_id.eq.${actualTenant},organization_id.is.null`)
            .single();

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
        return data.map(row => this.mapToDomain(row));
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
