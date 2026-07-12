$ErrorActionPreference = 'Stop'
$rootDir = "e:\SupplyHUB"

function Create-File ($path, $content) {
    $fullPath = "$rootDir\$path"
    $dir = Split-Path $fullPath
    if (!(Test-Path $dir)) {
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
    }
    New-Item -Path $fullPath -ItemType File -Force -Value $content | Out-Null
}

Write-Host "Criando Cliente Supabase..."
Create-File "src\infrastructure\supabase\client.ts" @"
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);
"@

Write-Host "Criando Kernel Events..."
Create-File "src\kernel\events\DomainEvent.ts" @"
export interface DomainEvent {
    eventName: string;
    occurredOn: Date;
    payload: any;
}
"@

Create-File "src\kernel\events\EventBus.ts" @"
import { DomainEvent } from './DomainEvent';

type EventHandler = (event: DomainEvent) => void | Promise<void>;

export class EventBus {
    private static instance: EventBus;
    private handlers: Map<string, EventHandler[]> = new Map();

    private constructor() {}

    public static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    public subscribe(eventName: string, handler: EventHandler): void {
        const currentHandlers = this.handlers.get(eventName) || [];
        currentHandlers.push(handler);
        this.handlers.set(eventName, currentHandlers);
    }

    public async publish(event: DomainEvent): Promise<void> {
        const handlers = this.handlers.get(event.eventName) || [];
        for (const handler of handlers) {
            await handler(event);
        }
    }
}
"@

Write-Host "Criando Modulo Auth..."
Create-File "src\modules\auth\domain\entities\AuthUser.ts" @"
export class AuthUser {
    constructor(
        public readonly id: string,
        public readonly email: string,
    ) {}
}
"@

Create-File "src\modules\auth\domain\repositories\IAuthRepository.ts" @"
import { AuthUser } from '../entities/AuthUser';

export interface IAuthRepository {
    loginWithEmail(email: string, password: string): Promise<AuthUser>;
    logout(): Promise<void>;
    getCurrentUser(): Promise<AuthUser | null>;
}
"@

Create-File "src\modules\auth\application\dto\AuthDTOs.ts" @"
export interface LoginRequestDTO {
    email: string;
    password: string;
}

export interface AuthResponseDTO {
    user: {
        id: string;
        email: string;
    };
    token?: string;
}
"@

Create-File "src\modules\auth\infrastructure\repositories\SupabaseAuthRepository.ts" @"
import { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import { AuthUser } from '../../domain/entities/AuthUser';
import { supabase } from '../../../../infrastructure/supabase/client';

export class SupabaseAuthRepository implements IAuthRepository {
    async loginWithEmail(email: string, password: string): Promise<AuthUser> {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error || !data.user) {
            throw new Error(error?.message || 'Login failed');
        }

        return new AuthUser(data.user.id, data.user.email!);
    }

    async logout(): Promise<void> {
        await supabase.auth.signOut();
    }

    async getCurrentUser(): Promise<AuthUser | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        return new AuthUser(user.id, user.email!);
    }
}
"@

Create-File "src\modules\auth\application\use-cases\LoginUseCase.ts" @"
import { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import { LoginRequestDTO, AuthResponseDTO } from '../dto/AuthDTOs';

export class LoginUseCase {
    constructor(private readonly authRepository: IAuthRepository) {}

    async execute(request: LoginRequestDTO): Promise<AuthResponseDTO> {
        const user = await this.authRepository.loginWithEmail(request.email, request.password);
        
        return {
            user: {
                id: user.id,
                email: user.email,
            }
        };
    }
}
"@

Write-Host "Criando Modulo Identity..."
Create-File "src\modules\identity\domain\entities\User.ts" @"
export class User {
    constructor(
        public readonly id: string,
        public readonly authId: string,
        public name: string,
        public email: string,
        public tenantId: string,
        public readonly createdAt: Date,
        public updatedAt: Date,
        public deletedAt?: Date,
        public createdBy?: string,
        public updatedBy?: string,
        public deletedBy?: string,
        public version: number = 1
    ) {}
}
"@

Create-File "src\modules\identity\domain\repositories\IUserRepository.ts" @"
import { User } from '../entities/User';

export interface IUserRepository {
    findById(id: string, tenantId: string): Promise<User | null>;
    save(user: User): Promise<void>;
}
"@

Write-Host "Criando Modulo Organizations..."
Create-File "src\modules\organizations\domain\entities\Organization.ts" @"
export class Organization {
    constructor(
        public readonly id: string,
        public readonly tenantId: string,
        public name: string,
        public taxId: string, // CNPJ/CPF
        public readonly createdAt: Date,
        public updatedAt: Date,
        public deletedAt?: Date,
        public createdBy?: string,
        public updatedBy?: string,
        public deletedBy?: string,
        public version: number = 1
    ) {}
}
"@

Create-File "src\modules\organizations\domain\repositories\IOrganizationRepository.ts" @"
import { Organization } from '../entities/Organization';

export interface IOrganizationRepository {
    findById(tenantId: string): Promise<Organization | null>;
    save(organization: Organization): Promise<void>;
}
"@

Write-Host "Criando Modulo Suppliers..."
Create-File "src\modules\suppliers\domain\entities\Supplier.ts" @"
export class Supplier {
    constructor(
        public readonly id: string,
        public readonly tenantId: string,
        public name: string,
        public document: string, // CNPJ/CPF
        public categoryId?: string,
        public status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING',
        public readonly createdAt: Date = new Date(),
        public updatedAt: Date = new Date(),
        public deletedAt?: Date,
        public createdBy?: string,
        public updatedBy?: string,
        public deletedBy?: string,
        public version: number = 1
    ) {}
}
"@

Create-File "src\modules\suppliers\domain\repositories\ISupplierRepository.ts" @"
import { Supplier } from '../entities/Supplier';

export interface ISupplierRepository {
    findById(id: string, tenantId: string): Promise<Supplier | null>;
    findAll(tenantId: string): Promise<Supplier[]>;
    save(supplier: Supplier): Promise<void>;
}
"@

Create-File "src\modules\suppliers\application\dto\SupplierDTOs.ts" @"
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
"@

Create-File "src\modules\suppliers\application\use-cases\CreateSupplierUseCase.ts" @"
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
"@

Write-Host "Scaffolding de Modulos de Negocio concluido."
