import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User } from '../../domain/entities/User';

export class LocalStorageUserRepository implements IUserRepository {
    private readonly KEY = 'supplyhub_users';
    
    private getAll(): User[] {
        const data = localStorage.getItem(this.KEY);
        return data ? JSON.parse(data) : [];
    }
    
    async findById(id: string): Promise<User | null> {
        return this.getAll().find(u => u.id === id) || null;
    }
    
    async findByEmail(email: string): Promise<User | null> {
        return this.getAll().find(u => u.email === email) || null;
    }
    
    async save(user: User): Promise<void> {
        const all = this.getAll();
        const index = all.findIndex(u => u.id === user.id);
        if (index >= 0) all[index] = user;
        else all.push(user);
        localStorage.setItem(this.KEY, JSON.stringify(all));
    }
}