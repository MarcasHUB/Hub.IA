import { OrganizationConnection } from '../entities/OrganizationConnection';

export interface IOrganizationConnectionRepository {
    save(connection: OrganizationConnection): Promise<void>;
    findByOrganization(orgId: string): Promise<OrganizationConnection[]>;
}