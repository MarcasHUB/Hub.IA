import { SupplierInvitation } from '../entities/SupplierInvitation';

export interface ISupplierInvitationRepository {
    findById(id: string): Promise<SupplierInvitation | null>;
    findByOrganizationId(orgId: string): Promise<SupplierInvitation[]>;
    save(invitation: Omit<SupplierInvitation, 'id' | 'createdAt' | 'updatedAt'>): Promise<SupplierInvitation>;
    update(id: string, data: Partial<SupplierInvitation>): Promise<SupplierInvitation>;
}

