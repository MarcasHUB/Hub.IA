import { AuthUser } from '../entities/AuthUser';

export interface IAuthRepository {
    loginWithEmail(email: string, password: string): Promise<AuthUser>;
    logout(): Promise<void>;
    getCurrentUser(): Promise<AuthUser | null>;
}