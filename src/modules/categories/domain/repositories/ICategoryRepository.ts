import { Category } from '../entities/Category';

export interface ICategoryRepository {
    findById(id: string, tenantId: string): Promise<Category | null>;
    findAll(tenantId: string): Promise<Category[]>;
    save(category: Category): Promise<void>;
}