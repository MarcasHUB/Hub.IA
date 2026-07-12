export class User {
    constructor(
        public readonly id: string,
        public name: string,
        public email: string,
        public phone: string | null,
        public passwordHash: string,
        public readonly createdAt: Date,
        public updatedAt: Date,
        public deletedAt?: Date
    ) {}
}
