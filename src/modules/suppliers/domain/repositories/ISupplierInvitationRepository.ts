import { SupplierInvitation } from '../entities/SupplierInvitation';

export interface ISupplierInvitationRepository {
    findById(id: string): Promise<SupplierInvitation | null>;
    findByToken(token: string): Promise<SupplierInvitation | null>;
    save(invitation: SupplierInvitation): Promise<void>;
    findByOrganizationId(orgId: string): Promise<SupplierInvitation[]>;
}