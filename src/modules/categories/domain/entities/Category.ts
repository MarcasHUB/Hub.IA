export enum CategoryStatus {
    ACTIVE = 'Active',
    INACTIVE = 'Inactive'
}

export class Category {
    constructor(
        public readonly id: string,
        public readonly tenantId: string,
        public name: string,
        public description: string,
        public parentId?: string,
        public status: CategoryStatus = CategoryStatus.ACTIVE,
        public readonly createdAt: Date = new Date(),
        public updatedAt: Date = new Date()
    ) {}
}