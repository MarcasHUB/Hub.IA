import { supabase } from '../../../../infrastructure/supabase/client';
import { Supplier } from '../../domain/entities/Supplier';
import { ISupplierRepository } from '../../domain/repositories/ISupplierRepository';

export class SupabaseSupplierRepository implements ISupplierRepository {
    private async resolveTenantId(tenantId: string): Promise<string> {
        if (tenantId !== '00000000-0000-0000-0000-000000000000') return tenantId;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return tenantId;
        const { data } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
        return data?.organization_id || tenantId;
    }

    async findById(id: string, tenantId: string): Promise<Supplier | null> {
        const actualTenant = await this.resolveTenantId(tenantId);
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', actualTenant)
            .single();
            
        if (error || !data) return null;
        
        return this.mapToDomain(data);
    }

    async findAll(tenantId: string): Promise<Supplier[]> {
        const actualTenant = await this.resolveTenantId(tenantId);
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('tenant_id', actualTenant)
            .order('created_at', { ascending: false });
            
        if (error || !data) return [];
        
        return data.map(row => this.mapToDomain(row));
    }

    async save(supplier: Supplier): Promise<void> {
        const actualTenant = await this.resolveTenantId(supplier.tenantId);
        const payload = {
            id: supplier.id,
            tenant_id: actualTenant,
            name: supplier.name,
            document: supplier.document,
            status: supplier.status,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('suppliers')
            .upsert(payload, { onConflict: 'id' });

        if (error) {
            console.error('Supabase save supplier error:', error);
            throw error;
        }
    }
    
    async delete(id: string, tenantId: string): Promise<void> {
        const actualTenant = await this.resolveTenantId(tenantId);
        const { error } = await supabase
            .from('suppliers')
            .delete()
            .eq('id', id)
            .eq('tenant_id', actualTenant);
            
        if (error) {
            console.error('Supabase delete supplier error:', error);
            throw error;
        }
    }

    private mapToDomain(row: any): Supplier {
        return new Supplier(
            row.id,
            row.tenant_id,
            row.name,
            row.document,
            undefined, // categoryId
            row.status === 'Pending' ? 'PENDING' : row.status === 'Approved' ? 'APPROVED' : 'REJECTED',
            new Date(row.created_at),
            new Date(row.updated_at)
        );
    }
}
