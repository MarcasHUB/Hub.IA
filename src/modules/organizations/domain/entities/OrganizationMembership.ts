export class OrganizationMembership {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly organizationId: string,
        public role: string, // e.g. Administrador, Comprador
        public title: string, // e.g. Cargo
        public readonly createdAt: Date,
        public updatedAt: Date,
        public deletedAt?: Date
    ) {}
}
