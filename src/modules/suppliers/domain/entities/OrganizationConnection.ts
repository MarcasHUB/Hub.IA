export class OrganizationConnection {
    constructor(
        public readonly id: string,
        public readonly buyerOrganizationId: string,
        public readonly supplierOrganizationId: string,
        public status: 'Ativo' | 'Inativo' | 'Bloqueado',
        public connectionType: string,
        public readonly connectedAt: Date,
        public approvedBy: string, // User ID
        public notes: string | null,
        public readonly createdAt: Date
    ) {}
}
