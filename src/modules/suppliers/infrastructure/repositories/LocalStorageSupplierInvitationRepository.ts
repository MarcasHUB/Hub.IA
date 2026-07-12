import { ISupplierInvitationRepository } from '../../domain/repositories/ISupplierInvitationRepository';
import { SupplierInvitation } from '../../domain/entities/SupplierInvitation';

export class LocalStorageSupplierInvitationRepository implements ISupplierInvitationRepository {
    private readonly KEY = 'supplyhub_invitations';
    
    private getAll(): SupplierInvitation[] {
        const data = localStorage.getItem(this.KEY);
        return data ? JSON.parse(data) : [];
    }
    
    async findById(id: string): Promise<SupplierInvitation | null> {
        return this.getAll().find(i => i.id === id) || null;
    }
    
    async findByToken(token: string): Promise<SupplierInvitation | null> {
        return this.getAll().find(i => i.token === token) || null;
    }
    
    async findByOrganizationId(orgId: string): Promise<SupplierInvitation[]> {
        return this.getAll().filter(i => i.organizationId === orgId);
    }
    
    async save(invitation: SupplierInvitation): Promise<void> {
        const all = this.getAll();
        const index = all.findIndex(i => i.id === invitation.id);
        if (index >= 0) all[index] = invitation;
        else all.push(invitation);
        localStorage.setItem(this.KEY, JSON.stringify(all));
    }
}