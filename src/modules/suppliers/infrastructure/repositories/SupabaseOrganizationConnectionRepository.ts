import { supabase } from '../../../../infrastructure/supabase/client';
import { OrganizationConnection } from '../../domain/entities/OrganizationConnection';
import { IOrganizationConnectionRepository } from '../../domain/repositories/IOrganizationConnectionRepository';

export class SupabaseOrganizationConnectionRepository implements IOrganizationConnectionRepository {
    
    private async resolveTenantId(tenantId: string): Promise<string> {
        if (tenantId !== '00000000-0000-0000-0000-000000000000') return tenantId;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return tenantId;
        const { data } = await supabase.from('user_roles').select('organization_id').eq('user_id', user.id).single();
        return data?.organization_id || tenantId;
    }

    async save(connection: OrganizationConnection): Promise<void> {
        const actualRequester = await this.resolveTenantId(connection.buyerOrganizationId);
        
        let mappedStatus = 'pending';
        if (connection.status === 'Ativo') mappedStatus = 'accepted';
        else if (connection.status === 'Inativo' || connection.status === 'Bloqueado') mappedStatus = 'rejected';

        const payload = {
            id: connection.id,
            requester_org_id: actualRequester,
            target_org_id: connection.supplierOrganizationId,
            status: mappedStatus,
            message: connection.notes || '',
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('connection_requests')
            .upsert(payload, { onConflict: 'id' });

        if (error) {
            console.error('Supabase save connection error:', error);
            throw error;
        }
    }

    async findByOrganization(orgId: string): Promise<OrganizationConnection[]> {
        const actualOrgId = await this.resolveTenantId(orgId);
        const { data, error } = await supabase
            .from('connection_requests')
            .select('*')
            .or(`requester_org_id.eq.${actualOrgId},target_org_id.eq.${actualOrgId}`);
            
        if (error || !data) return [];

        return data.map(row => {
            let mappedStatus: 'Ativo' | 'Inativo' | 'Bloqueado' = 'Inativo';
            if (row.status === 'accepted') mappedStatus = 'Ativo';
            
            return new OrganizationConnection(
                row.id,
                row.requester_org_id,
                row.target_org_id,
                mappedStatus,
                'network',
                new Date(row.updated_at),
                '', // approvedBy mocked for now
                row.message,
                new Date(row.created_at)
            );
        });
    }
}
