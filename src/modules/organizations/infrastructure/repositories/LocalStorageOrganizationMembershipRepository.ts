import { IOrganizationMembershipRepository } from '../../domain/repositories/IOrganizationMembershipRepository';
import { OrganizationMembership } from '../../domain/entities/OrganizationMembership';

export class LocalStorageOrganizationMembershipRepository implements IOrganizationMembershipRepository {
    private readonly KEY = 'supplyhub_memberships';
    
    private getAll(): OrganizationMembership[] {
        const data = localStorage.getItem(this.KEY);
        return data ? JSON.parse(data) : [];
    }
    
    async save(membership: OrganizationMembership): Promise<void> {
        const all = this.getAll();
        const index = all.findIndex(m => m.id === membership.id);
        if (index >= 0) all[index] = membership;
        else all.push(membership);
        localStorage.setItem(this.KEY, JSON.stringify(all));
    }
    
    async findByUserId(userId: string): Promise<OrganizationMembership[]> {
        return this.getAll().filter(m => m.userId === userId);
    }
    
    async findByOrganizationId(organizationId: string): Promise<OrganizationMembership[]> {
        return this.getAll().filter(m => m.organizationId === organizationId);
    }
}