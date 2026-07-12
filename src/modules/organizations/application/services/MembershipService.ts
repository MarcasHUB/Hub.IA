import { OrganizationMembership } from '../../domain/entities/OrganizationMembership';
import { IOrganizationMembershipRepository } from '../../domain/repositories/IOrganizationMembershipRepository';
import { LocalStorageOrganizationMembershipRepository } from '../../infrastructure/repositories/LocalStorageOrganizationMembershipRepository';

export class MembershipService {
    private repo: IOrganizationMembershipRepository = new LocalStorageOrganizationMembershipRepository();

    async addMembership(userId: string, orgId: string, role: string, title: string): Promise<OrganizationMembership> {
        const membership = new OrganizationMembership(
            'memb_' + Date.now(),
            userId,
            orgId,
            role,
            title,
            new Date(),
            new Date()
        );
        await this.repo.save(membership);
        return membership;
    }
}
