import { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import { AuthUser } from '../../domain/entities/AuthUser';
import { supabase } from '../../../../infrastructure/supabase/client';

export class SupabaseAuthRepository implements IAuthRepository {
    async loginWithEmail(email: string, password: string): Promise<AuthUser> {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error || !data.user) {
            throw new Error(error?.message || 'Login failed');
        }

        return new AuthUser(data.user.id, data.user.email!);
    }

    async logout(): Promise<void> {
        await supabase.auth.signOut();
    }

    async getCurrentUser(): Promise<AuthUser | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        return new AuthUser(user.id, user.email!);
    }
}