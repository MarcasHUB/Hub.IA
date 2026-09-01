export enum ProductStatus {
    DRAFT = 'Draft',
    ACTIVE = 'Active',
    INACTIVE = 'Inactive'
}

export class Product {
    constructor(
        public readonly id: string,
        public readonly tenantId: string,
        public supplierId: string,
        public categoryId: string,
        public name: string,
        public description: string,
        public sku: string,
        public uom: string, // Unit of Measure
        public manufacturer: string,
        public price: number, // Reference Price for comparisons
        public status: ProductStatus = ProductStatus.ACTIVE,

        // Espaço preparado para o futuro:
        // public costPrice?: number,
        // public listPrice?: number,
        // public currency: string = 'BRL',
        // public lastPriceUpdate?: Date,

        // Fase 4B: Representa o Material Master Global no qual o produto (catálogo) baseia-se.
        public materialId?: string,

        public readonly createdAt: Date = new Date(),
        public updatedAt: Date = new Date(),
        public readonly categoryName?: string,
        public manufacturerCode?: string,
        public availableForPurchase: boolean = true,
        public availableForSale: boolean = false,
        public imageUrl?: string,
        public technicalDescription?: string,
        public attachments?: any[]
    ) {}

    get isComplete(): boolean {
        return !!(
            this.name?.trim() &&
            this.manufacturer?.trim() &&
            this.categoryId?.trim() &&
            this.manufacturerCode?.trim() &&
            this.uom?.trim()
        );
    }
}
