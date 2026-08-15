import { getAuthenticatedIdentity } from '@/modules/auth/application/services/getAuthenticatedIdentity';
import { OrganizationConnection } from '../../domain/entities/OrganizationConnection';
import { IOrganizationConnectionRepository } from '../../domain/repositories/IOrganizationConnectionRepository';
import { SupabasePartnerConnectionRepository } from './SupabasePartnerConnectionRepository';

export class SupabaseOrganizationConnectionRepository implements IOrganizationConnectionRepository {
  private readonly partners = new SupabasePartnerConnectionRepository();

  async save(connection: OrganizationConnection): Promise<void> {
    if (connection.status !== 'Inativo') {
      throw new Error('CONNECTION_STATUS_MUST_CHANGE_THROUGH_APPROVAL_RPC');
    }

    const identity = await getAuthenticatedIdentity();
    const targetId = connection.buyerOrganizationId === identity.organizationId
      ? connection.supplierOrganizationId
      : connection.buyerOrganizationId;
    await this.partners.request(targetId, connection.notes || undefined);
  }

  async findByOrganization(_organizationId: string): Promise<OrganizationConnection[]> {
    const identity = await getAuthenticatedIdentity();
    const rows = await this.partners.list();

    return rows.map((row) => {
      const buyerId = row.direction === 'sent' ? identity.organizationId : row.partner_organization_id;
      const supplierId = row.direction === 'sent' ? row.partner_organization_id : identity.organizationId;
      return new OrganizationConnection(
        row.connection_id,
        buyerId,
        supplierId,
        row.connection_status === 'accepted' ? 'Ativo' : 'Inativo',
        'network',
        new Date(row.connected_at),
        '',
        row.message,
        new Date(row.connected_at),
      );
    });
  }

  async createConnection(data: { targetOrganizationId: string; message?: string }): Promise<void> {
    await this.partners.request(data.targetOrganizationId, data.message);
  }
}
