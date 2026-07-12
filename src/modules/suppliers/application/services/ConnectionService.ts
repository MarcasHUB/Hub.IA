import { OrganizationConnection } from '../../domain/entities/OrganizationConnection';
import { IOrganizationConnectionRepository } from '../../domain/repositories/IOrganizationConnectionRepository';
import { LocalStorageOrganizationConnectionRepository } from '../../infrastructure/repositories/LocalStorageOrganizationConnectionRepository';

export class ConnectionService {
    private repo: IOrganizationConnectionRepository = new LocalStorageOrganizationConnectionRepository();

    async createConnection(buyerId: string, supplierId: string): Promise<OrganizationConnection> {
        const conn = new OrganizationConnection(
            'conn_' + Date.now(),
            buyerId,
            supplierId,
            'Ativo',
            'B2B',
            new Date(),
            'system',
            null,
            new Date()
        );
        await this.repo.save(conn);
        return conn;
    }
}