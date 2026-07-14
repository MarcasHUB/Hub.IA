import { supabase } from '@/infrastructure/supabase/client';
import { Delegation } from '../../domain/entities/Delegation';
import { IDelegationRepository } from '../../domain/repositories/IDelegationRepository';

export class SupabaseDelegationRepository implements IDelegationRepository {
  /**
   * Salva uma nova delegação remotamente
   */
  async createDelegation(delegation: Omit<Delegation, 'id' | 'created_at'>): Promise<Delegation> {
    const { data, error } = await supabase
      .from('delegations')
      .insert({
        organization_id: delegation.organization_id,
        operador_origem_id: delegation.operador_origem_id,
        operador_substituto_id: delegation.operador_substituto_id,
        data_inicio: delegation.data_inicio,
        data_fim: delegation.data_fim,
        motivo: delegation.motivo,
        status: delegation.status,
        segmentos_espelhados: delegation.segmentos_espelhados,
        permissoes_espelhadas: delegation.permissoes_espelhadas,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // O trigger/sinal pode ser configurado remotamente ou no edge function, omitimos o local storage

    return data as Delegation;
  }

  /**
   * Cancela uma delegação ativa
   */
  async cancelDelegation(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('delegations')
      .update({ status: 'cancelada' })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return true;
  }

  /**
   * Lista todas as delegações da organização
   */
  async listDelegations(organizationId: string): Promise<Delegation[]> {
    const { data, error } = await supabase
      .from('delegations')
      .select('*')
      .eq('organization_id', organizationId);
    
    if (error) {
      throw error;
    }

    return data as Delegation[];
  }
}

