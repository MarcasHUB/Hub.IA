import { ISupplierRepository } from '../../domain/repositories/ISupplierRepository';
import { Supplier } from '../../domain/entities/Supplier';
import { CreateSupplierRequestDTO, SupplierResponseDTO } from '../dto/SupplierDTOs';
import { EventBus } from '../../../../kernel/events/EventBus';

export class CreateSupplierUseCase {
    constructor(
        private readonly supplierRepository: ISupplierRepository,
        private readonly eventBus: EventBus
    ) {}

    async execute(request: CreateSupplierRequestDTO, tenantId: string, createdBy: string): Promise<SupplierResponseDTO> {
        // Validation logic can be placed here or handled in the Presentation layer via Zod.
        const supplier = new Supplier(
            crypto.randomUUID(),
            tenantId,
            request.name,
            request.document,
            request.categoryId,
            'PENDING',
            new Date(),
            new Date(),
            undefined,
            createdBy
        );

        await this.supplierRepository.save(supplier);

        // Audit Event
        await this.eventBus.publish({
            eventName: 'SupplierCreated',
            occurredOn: new Date(),
            payload: { supplierId: supplier.id, tenantId }
        });

        return {
            id: supplier.id,
            name: supplier.name,
            document: supplier.document,
            status: supplier.status,
            createdAt: supplier.createdAt
        };
    }
}