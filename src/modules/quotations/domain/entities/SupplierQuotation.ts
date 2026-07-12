export enum SupplierQuotationStatus {
    PENDING = 'Pending',
    SENT = 'Sent',
    REJECTED = 'Rejected'
}

export class SupplierQuotation {
    constructor(
        public readonly id: string,
        public readonly quotationId: string,
        public readonly supplierId: string,
        public price: number,
        public deliveryDays: number,
        public comments: string,
        public status: SupplierQuotationStatus = SupplierQuotationStatus.PENDING,
        public readonly createdAt: Date = new Date()
    ) {}
}