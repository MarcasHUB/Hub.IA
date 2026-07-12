import { Product } from '../entities/Product';

export interface IProductRepository {
    findById(id: string, tenantId: string): Promise<Product | null>;
    findAll(tenantId: string): Promise<Product[]>;
    save(product: Product): Promise<void>;
}