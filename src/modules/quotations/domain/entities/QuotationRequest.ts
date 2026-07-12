export enum QuotationStatus {
    DRAFT = 'Draft',
    OPEN = 'Open',
    CLOSED = 'Closed',
    CANCELLED = 'Cancelled'
}

export class QuotationRequest {
    constructor(
        public readonly id: string,
        public readonly tenantId: string,
        public title: string,
        public description: string,
        public readonly requesterId: string,
        public status: QuotationStatus = QuotationStatus.DRAFT,
        public readonly createdAt: Date = new Date(),
        public updatedAt: Date = new Date()
    ) {}
}