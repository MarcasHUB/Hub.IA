export class User {
    constructor(
        public readonly id: string,
        public readonly authId: string,
        public name: string,
        public email: string,
        public tenantId: string,
        public readonly createdAt: Date,
        public updatedAt: Date,
        public deletedAt?: Date,
        public createdBy?: string,
        public updatedBy?: string,
        public deletedBy?: string,
        public version: number = 1
    ) {}
}