import { supabase } from '@/infrastructure/supabase/client';
import { SupplierInvitation } from '../../domain/entities/SupplierInvitation';
import { ISupplierInvitationRepository } from '../../domain/repositories/ISupplierInvitationRepository';

export class SupabaseSupplierInvitationRepository implements ISupplierInvitationRepository {
    private mapToEntity(record: any): SupplierInvitation {
        return {
            id: record.id,
            organizationId: record.organization_id,
            companyName: record.company || record.name,
            document: record.document,
            email: record.email,
            status: record.status as any,
            tokenHash: record.token_hash,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
            expiresAt: record.expires_at,
            city: record.city,
            state: record.state,
            contactName: record.contact_name,
            message: record.message,
            segments: record.segments,
            invitedById: record.invited_by_id,
        };
    }

    async findById(id: string): Promise<SupplierInvitation | null> {
        const { data, error } = await supabase.from('invitations').select('*').eq('id', id).single();
        if (error || !data) return null;
        return this.mapToEntity(data);
    }

    async findByOrganizationId(orgId: string): Promise<SupplierInvitation[]> {
        const { data, error } = await supabase.from('invitations').select('*').eq('organization_id', orgId).order('created_at', { ascending: false });
        if (error || !data) return [];
        return data.map(this.mapToEntity);
    }

    async save(invitation: Omit<SupplierInvitation, 'id' | 'createdAt' | 'updatedAt'>): Promise<SupplierInvitation> {
        const payload = {
            organization_id: invitation.organizationId,
            name: invitation.companyName,
            company: invitation.companyName,
            document: invitation.document,
            email: invitation.email,
            status: invitation.status,
            token_hash: invitation.tokenHash,
            expires_at: invitation.expiresAt,
            city: invitation.city,
            state: invitation.state,
            contact_name: invitation.contactName,
            message: invitation.message,
            segments: invitation.segments,
            invited_by_id: invitation.invitedById,
        };
        const { data, error } = await supabase.from('invitations').insert(payload).select().single();
        if (error) throw error;
        return this.mapToEntity(data);
    }

    async update(id: string, updates: Partial<SupplierInvitation>): Promise<SupplierInvitation> {
        const payload: any = {};
        if (updates.companyName) { payload.name = updates.companyName; payload.company = updates.companyName; }
        if (updates.document) payload.document = updates.document;
        if (updates.email) payload.email = updates.email;
        if (updates.status) payload.status = updates.status;
        if (updates.city !== undefined) payload.city = updates.city;
        if (updates.state !== undefined) payload.state = updates.state;
        if (updates.contactName !== undefined) payload.contact_name = updates.contactName;
        if (updates.message !== undefined) payload.message = updates.message;
        if (updates.segments !== undefined) payload.segments = updates.segments;

        const { data, error } = await supabase.from('invitations').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return this.mapToEntity(data);
    }
}

