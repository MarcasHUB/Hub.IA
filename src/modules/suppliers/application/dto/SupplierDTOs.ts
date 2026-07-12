export interface CreateSupplierRequestDTO {
    name: string;
    document: string;
    categoryId?: string;
}

export interface SupplierResponseDTO {
    id: string;
    name: string;
    document: string;
    status: string;
    createdAt: Date;
}