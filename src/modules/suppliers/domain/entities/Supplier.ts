export class Supplier {
    constructor(
        public readonly id: string,
        public readonly tenantId: string,
        public name: string,
        public document: string, // CNPJ/CPF
        public categoryId?: string,
        public status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING',
        public readonly createdAt: Date = new Date(),
        public updatedAt: Date = new Date(),
        public deletedAt?: Date,
        public createdBy?: string,
        public updatedBy?: string,
        public deletedBy?: string,
        public version: number = 1
    ) {}
}