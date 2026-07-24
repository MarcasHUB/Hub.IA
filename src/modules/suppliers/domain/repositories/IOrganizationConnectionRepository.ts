import { OrganizationConnection } from '../entities/OrganizationConnection';

export interface IOrganizationConnectionRepository {
    save(connection: OrganizationConnection): Promise<void>;
    findByOrganization(orgId: string): Promise<OrganizationConnection[]>;
    acceptInvite(id: string): Promise<void>;
    rejectInvite(id: string): Promise<void>;
    cancelInvite(id: string): Promise<void>;
    createConnection(data: any): Promise<void>;
}