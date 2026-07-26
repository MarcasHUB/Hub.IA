export class Organization {
    constructor(
        public readonly id: string,
        public readonly tenantId: string,
        public name: string,
        public taxId: string, // CNPJ/CPF
        public tradeName: string,
        public address: string,
        public city: string,
        public state: string,
        public profiles: string[], // e.g. "Fabrica", "Distribui"
        public segments: string[],
        public logoUrl: string | null,
        public latitude?: number,
        public longitude?: number,
        public companyType?: string,
        public coverageRadius?: number,
        public coverageStates?: string[],
        public certifications?: string,
        public cnaeMain?: string,
        public cnaeSecondary?: string[],
        public readonly createdAt?: Date,
        public updatedAt?: Date,
        public deletedAt?: Date,
        public createdBy?: string,
        public updatedBy?: string,
        public deletedBy?: string,
        public version: number = 1
    ) {}
}