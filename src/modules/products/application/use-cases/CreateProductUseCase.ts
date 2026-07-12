import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { Product, ProductStatus } from '../../domain/entities/Product';
import { CreateProductRequestDTO, ProductResponseDTO } from '../dto/ProductDTOs';
import { EventBus } from '../../../../kernel/events/EventBus';

export class CreateProductUseCase {
    constructor(
        private readonly productRepository: IProductRepository,
        private readonly eventBus: EventBus
    ) {}

    async execute(request: CreateProductRequestDTO, tenantId: string): Promise<ProductResponseDTO> {
        const product = new Product(
            crypto.randomUUID(),
            tenantId,
            request.supplierId,
            request.categoryId,
            request.name,
            request.description,
            request.sku,
            request.uom,
            request.manufacturer,
            request.price,
            ProductStatus.ACTIVE
        );

        await this.productRepository.save(product);

        await this.eventBus.publish({
            eventName: 'ProductCreated',
            occurredOn: new Date(),
            payload: { productId: product.id, tenantId }
        });

        return {
            id: product.id,
            name: product.name,
            sku: product.sku,
            uom: product.uom,
            manufacturer: product.manufacturer,
            price: product.price,
            status: product.status,
            updatedAt: product.updatedAt
        };
    }
}