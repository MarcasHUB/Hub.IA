import { IOrganizationConnectionRepository } from '../../domain/repositories/IOrganizationConnectionRepository';
import { OrganizationConnection } from '../../domain/entities/OrganizationConnection';

export class LocalStorageOrganizationConnectionRepository implements IOrganizationConnectionRepository {
    private readonly KEY = 'supplyhub_connections';
    
    private getAll(): OrganizationConnection[] {
        const data = localStorage.getItem(this.KEY);
        return data ? JSON.parse(data) : [];
    }
    
    async findByOrganization(orgId: string): Promise<OrganizationConnection[]> {
        return this.getAll().filter(c => c.buyerOrganizationId === orgId || c.supplierOrganizationId === orgId);
    }
    
    async save(connection: OrganizationConnection): Promise<void> {
        const all = this.getAll();
        const index = all.findIndex(c => c.id === connection.id);
        if (index >= 0) all[index] = connection;
        else all.push(connection);
        localStorage.setItem(this.KEY, JSON.stringify(all));
    }

    async createConnection(_data: { targetOrganizationId: string; message?: string }): Promise<void> {
        // Mock
    }
}
