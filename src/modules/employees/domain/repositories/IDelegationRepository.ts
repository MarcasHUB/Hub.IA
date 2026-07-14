import { Delegation } from '../entities/Delegation';

export interface IDelegationRepository {
  listDelegations(organizationId: string): Promise<Delegation[]>;
  createDelegation(delegation: Omit<Delegation, 'id' | 'created_at'>): Promise<Delegation>;
  cancelDelegation(id: string): Promise<boolean>;
}
