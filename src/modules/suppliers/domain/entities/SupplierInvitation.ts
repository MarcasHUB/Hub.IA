export type SupplierInvitationStatus = 'pendente' | 'aceito' | 'cancelado' | 'expirado';

export interface SupplierInvitation {
    id: string;
    organizationId: string;
    companyName: string;
    document: string;
    email: string;
    status: SupplierInvitationStatus;
    tokenHash?: string;
    createdAt: string;
    updatedAt: string;
    expiresAt?: string;
    city?: string;
    state?: string;
    contactName?: string;
    message?: string;
    segments?: string[];
    invitedById?: string;
}

