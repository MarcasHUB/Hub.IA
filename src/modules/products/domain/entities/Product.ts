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
        
        public readonly createdAt: Date = new Date(),
        public updatedAt: Date = new Date(),
        public readonly categoryName?: string,
        public manufacturerCode?: string,
        public availableForPurchase: boolean = true,
        public availableForSale: boolean = false,
        public imageUrl?: string,
        public technicalDescription?: string
    ) {}

    get isComplete(): boolean {
        return !!(
            this.imageUrl?.trim() &&
            this.name?.trim() &&
            this.manufacturer?.trim() &&
            this.categoryId?.trim() &&
            this.manufacturerCode?.trim() &&
            this.technicalDescription?.trim()
        );
    }
}