export class SupplierInvitation {
    constructor(
        public readonly id: string,
        public readonly organizationId: string, // the org sending the invite
        public supplierCnpj: string,
        public supplierEmail: string,
        public token: string,
        public status: 'Convidado' | 'Convite enviado' | 'Cadastro iniciado' | 'Cadastro concluído' | 'Aguardando aprovação' | 'Conectado',
        public readonly createdAt: Date,
        public expiresAt: Date,
        public acceptedAt?: Date,
        public createdBy?: string, // user id who sent it
        public resentCount: number = 0,
        public lastSentAt?: Date
    ) {}
}
