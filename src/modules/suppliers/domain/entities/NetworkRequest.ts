export class NetworkRequest {
    constructor(
        public readonly id: string,
        public readonly requesterOrganizationId: string, // Empresa A
        public readonly targetOrganizationId: string, // Empresa B
        public status: 'Pendente' | 'Aceita' | 'Recusada',
        public source: 'Busca' | 'Convite' | 'Marketplace' | 'QRCode' | 'API' | 'Cadastro espontâneo',
        public readonly createdAt: Date,
        public answeredAt?: Date,
        public answeredBy?: string, // user ID
        public message?: string
    ) {}
}
