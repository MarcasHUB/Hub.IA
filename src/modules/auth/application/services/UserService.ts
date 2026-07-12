import { User } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { LocalStorageUserRepository } from '../../infrastructure/repositories/LocalStorageUserRepository';

export class UserService {
    private repo: IUserRepository = new LocalStorageUserRepository();

    async createUser(userData: Partial<User>): Promise<User> {
        const user = new User(
            'usr_' + Date.now(),
            userData.name || '',
            userData.email || '',
            userData.phone || null,
            userData.passwordHash || '',
            new Date(),
            new Date()
        );
        await this.repo.save(user);
        return user;
    }
}