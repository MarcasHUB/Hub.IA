import { User } from '../entities/User';

export interface IUserRepository {
    findById(id: string, tenantId: string): Promise<User | null>;
    save(user: User): Promise<void>;
}