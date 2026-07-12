import { ProductStatus } from '../../domain/entities/Product';

export interface CreateProductRequestDTO {
    supplierId: string;
    categoryId: string;
    name: string;
    description: string;
    sku: string;
    uom: string;
    manufacturer: string;
    price: number;
}

export interface ProductResponseDTO {
    id: string;
    name: string;
    sku: string;
    uom: string;
    manufacturer: string;
    price: number;
    status: ProductStatus;
    updatedAt: Date;
}