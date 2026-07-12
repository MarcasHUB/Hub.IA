import { SupplierInvitation } from '../../domain/entities/SupplierInvitation';
import { ISupplierInvitationRepository } from '../../domain/repositories/ISupplierInvitationRepository';
import { LocalStorageSupplierInvitationRepository } from '../../infrastructure/repositories/LocalStorageSupplierInvitationRepository';

export class InvitationService {
    private repo: ISupplierInvitationRepository = new LocalStorageSupplierInvitationRepository();

    async createInvitation(orgId: string, cnpj: string, email: string): Promise<SupplierInvitation> {
        const exp = new Date();
        exp.setDate(exp.getDate() + 7); // expires in 7 days
        const inv = new SupplierInvitation(
            'inv_' + Date.now(),
            orgId,
            cnpj,
            email,
            'tok_' + Math.random().toString(36).substring(2),
            'Convite enviado',
            new Date(),
            exp,
            undefined,
            'user_1',
            0,
            new Date()
        );
        await this.repo.save(inv);
        return inv;
    }

    async getInvitationByToken(token: string) {
        return this.repo.findByToken(token);
    }

    async completeInvitation(id: string) {
        const inv = await this.repo.findById(id);
        if (inv) {
            inv.status = 'Cadastro concluído';
            inv.acceptedAt = new Date();
            await this.repo.save(inv);
        }
    }
}