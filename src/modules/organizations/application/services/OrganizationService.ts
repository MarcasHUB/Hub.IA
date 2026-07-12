import { Organization } from '../../domain/entities/Organization';
import { IOrganizationRepository } from '../../domain/repositories/IOrganizationRepository';
import { LocalStorageOrganizationRepository } from '../../infrastructure/repositories/LocalStorageOrganizationRepository';

export class OrganizationService {
    private repo: IOrganizationRepository = new LocalStorageOrganizationRepository();

    async getOrganization(id: string) {
        return this.repo.findById(id);
    }

    async createOrganization(orgData: Partial<Organization>): Promise<Organization> {
        const org = new Organization(
            'org_' + Date.now(),
            'tenant_1',
            orgData.name || '',
            orgData.taxId || '',
            orgData.tradeName || '',
            orgData.address || '',
            orgData.city || '',
            orgData.state || '',
            orgData.profiles || [],
            orgData.segments || [],
            orgData.logoUrl || null,
            new Date(),
            new Date()
        );
        await this.repo.save(org);
        return org;
    }
}