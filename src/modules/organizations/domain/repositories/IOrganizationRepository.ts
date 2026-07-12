import { Organization } from '../entities/Organization';

export interface IOrganizationRepository {
    findById(id: string): Promise<Organization | null>;
    findByCnpj(cnpj: string): Promise<Organization | null>;
    save(organization: Organization): Promise<void>;
    findAll(): Promise<Organization[]>;
}