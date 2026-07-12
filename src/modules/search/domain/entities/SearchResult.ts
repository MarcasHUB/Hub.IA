export class SearchResult {
    constructor(
        public readonly productId: string,
        public readonly productName: string,
        public readonly sku: string,
        public readonly manufacturer: string,
        public readonly categoryName: string,
        public readonly supplierId: string,
        public readonly supplierName: string,
        public readonly priceReference: number,
        public readonly status: string,
        public readonly lastUpdatedAt: Date
    ) {}

    /* 
     * Estrutura preparada para futuras sprints (Inteligência e Cotações):
     *
     * priceHistory: { date: Date, price: number }[]
     * supplierRanking: number (0 - 5 stars or score)
     * productScore: number
     * quotationComparison: boolean (is currently being quoted?)
     */
}