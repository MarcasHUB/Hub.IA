import { Supplier } from '../entities/Supplier';

export interface ISupplierRepository {
    findById(id: string, tenantId: string): Promise<Supplier | null>;
    findAll(tenantId: string): Promise<Supplier[]>;
    save(supplier: Supplier): Promise<void>;
}