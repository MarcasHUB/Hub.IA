export class ProductSupplier {
    constructor(
        public readonly productId: string,
        public readonly supplierId: string,
        public readonly organizationId: string,
        public readonly createdAt?: Date
    ) {}
}
