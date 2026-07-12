import { IOrganizationRepository } from '../../domain/repositories/IOrganizationRepository';
import { Organization } from '../../domain/entities/Organization';

export class LocalStorageOrganizationRepository implements IOrganizationRepository {
    private readonly KEY = 'supplyhub_organizations_v2';
    
    private getAll(): Organization[] {
        const data = localStorage.getItem(this.KEY);
        return data ? JSON.parse(data) : [];
    }
    
    async findById(id: string): Promise<Organization | null> {
        return this.getAll().find(o => o.id === id) || null;
    }
    
    async findByCnpj(cnpj: string): Promise<Organization | null> {
        return this.getAll().find(o => o.taxId === cnpj) || null;
    }
    
    async findAll(): Promise<Organization[]> {
        return this.getAll();
    }
    
    async save(organization: Organization): Promise<void> {
        const all = this.getAll();
        const index = all.findIndex(o => o.id === organization.id);
        if (index >= 0) all[index] = organization;
        else all.push(organization);
        localStorage.setItem(this.KEY, JSON.stringify(all));
    }
}