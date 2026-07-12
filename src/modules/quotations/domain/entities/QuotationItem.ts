export class QuotationItem {
    constructor(
        public readonly id: string,
        public readonly quotationId: string,
        public productId: string,
        public quantity: number,
        public uom: string
    ) {}
}