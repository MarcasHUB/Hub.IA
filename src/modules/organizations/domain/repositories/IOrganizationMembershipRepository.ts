import { OrganizationMembership } from '../entities/OrganizationMembership';

export interface IOrganizationMembershipRepository {
    save(membership: OrganizationMembership): Promise<void>;
    findByUserId(userId: string): Promise<OrganizationMembership[]>;
    findByOrganizationId(organizationId: string): Promise<OrganizationMembership[]>;
}
