import { SupplierInvitation, SupplierInvitationStatus } from '../../domain/entities/SupplierInvitation';
import { ISupplierInvitationRepository } from '../../domain/repositories/ISupplierInvitationRepository';
import { SupabaseSupplierInvitationRepository } from '../../infrastructure/repositories/SupabaseSupplierInvitationRepository';
import { hashToken, generateRawToken } from '@/shared/utils/tokenUtils';

export class InvitationService {
    private repo: ISupplierInvitationRepository = new SupabaseSupplierInvitationRepository();

    async createExternalInvitation(payload: {
        organizationId: string;
        companyName: string;
        document: string;
        email: string;
        city?: string;
        state?: string;
        contactName?: string;
        message?: string;
        segments?: string[];
        invitedById?: string;
    }): Promise<SupplierInvitation & { _rawToken: string }> {
        const rawToken = generateRawToken();
        const tokenHash = await hashToken(rawToken);
        const exp = new Date();
        exp.setDate(exp.getDate() + 7); // expires in 7 days

        const inv = await this.repo.save({
            ...payload,
            status: 'pendente',
            tokenHash,
            expiresAt: exp.toISOString(),
        });
        return { ...inv, _rawToken: rawToken };
    }

    async listPendingByOrganization(orgId: string): Promise<SupplierInvitation[]> {
        const list = await this.repo.findByOrganizationId(orgId);
        return list.filter(i => i.status === 'pendente');
    }

    async cancelInvitation(id: string): Promise<void> {
        await this.repo.update(id, { status: 'cancelado' });
    }

    async updateInvitation(id: string, updates: Partial<SupplierInvitation>): Promise<SupplierInvitation> {
        return this.repo.update(id, updates);
    }
}

