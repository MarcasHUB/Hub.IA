import { supabase } from '../../../../infrastructure/supabase/client';
import { OrganizationConnection } from '../../domain/entities/OrganizationConnection';
import { IOrganizationConnectionRepository } from '../../domain/repositories/IOrganizationConnectionRepository';

export class SupabaseOrganizationConnectionRepository implements IOrganizationConnectionRepository {
    
    async save(connection: OrganizationConnection): Promise<void> {
        let mappedStatus = 'pending';
        if (connection.status === 'Ativo') mappedStatus = 'accepted';
        else if (connection.status === 'Inativo' || connection.status === 'Bloqueado') mappedStatus = 'rejected';

        const payload = {
            id: connection.id,
            requester_org_id: connection.buyerOrganizationId,
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
        const { data, error } = await supabase
            .from('connection_requests')
            .select('*')
            .or(`requester_org_id.eq.${orgId},target_org_id.eq.${orgId}`);
            
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
