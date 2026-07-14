import { supabase } from '@/infrastructure/supabase/client';
import { Delegation } from '../../domain/entities/Delegation';

export class SupabaseDelegationRepository {
  private getLocalDelegations(): Delegation[] {
    try {
      const raw = localStorage.getItem('supplyhub_delegations_v2');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalDelegations(delegations: Delegation[]) {
    localStorage.setItem('supplyhub_delegations_v2', JSON.stringify(delegations));
  }

  /**
   * Salva uma nova delegação
   */
  async createDelegation(delegation: Omit<Delegation, 'id' | 'created_at'>): Promise<Delegation> {
    const newDelegation: Delegation = {
      ...delegation,
      id: `del-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    // 1. Persistência Local (Homologação)
    const local = this.getLocalDelegations();
    local.push(newDelegation);
    this.saveLocalDelegations(local);

    // 2. Registro de log de operação localmente
    const logsRaw = localStorage.getItem('supplyhub_operation_logs_v2') || '[]';
    const logs = JSON.parse(logsRaw);
    logs.push({
      id: `log-${Date.now()}`,
      operator_id: delegation.operador_origem_id,
      organization_id: delegation.organization_id,
      entidade: 'delegacao',
      acao: 'criou',
      payload_depois: newDelegation,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem('supplyhub_operation_logs_v2', JSON.stringify(logs));

    // 3. Alimentação do sinal Hub.IA
    const signalsRaw = localStorage.getItem('supplyhub_signals_v2') || '[]';
    const signals = JSON.parse(signalsRaw);
    signals.push({
      id: `sig-${Date.now()}`,
      organization_id: delegation.organization_id,
      tipo_sinal: 'oportunidade_saving', // Tipo mapeado no banco
      descricao: `Delegação de funções ativa de ${delegation.operador_origem_id} para ${delegation.operador_substituto_id}.`,
      dados: { delegation_id: newDelegation.id, tipo: 'delegacao_ativa' },
      lido: false,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem('supplyhub_signals_v2', JSON.stringify(signals));

    // 4. Integração Supabase Real
    try {
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

      if (!error && data) {
        return data as Delegation;
      }
    } catch (e) {
      console.warn('Falha ao persistir no Supabase remoto. Operando em modo offline.');
    }

    return newDelegation;
  }

  /**
   * Cancela uma delegação ativa
   */
  async cancelDelegation(id: string): Promise<boolean> {
    const local = this.getLocalDelegations();
    const index = local.findIndex(d => d.id === id);
    if (index !== -1) {
      local[index].status = 'cancelada';
      this.saveLocalDelegations(local);

      // Log Operacional
      const logsRaw = localStorage.getItem('supplyhub_operation_logs_v2') || '[]';
      const logs = JSON.parse(logsRaw);
      logs.push({
        id: `log-${Date.now()}`,
        organization_id: local[index].organization_id,
        entidade: 'delegacao',
        acao: 'cancelou',
        payload_depois: { id, status: 'cancelada' },
        created_at: new Date().toISOString(),
      });
      localStorage.setItem('supplyhub_operation_logs_v2', JSON.stringify(logs));
    }

    try {
      await supabase
        .from('delegations')
        .update({ status: 'cancelada' })
        .eq('id', id);
    } catch {}

    return true;
  }

  /**
   * Lista todas as delegações
   */
  async listDelegations(organizationId: string): Promise<Delegation[]> {
    try {
      const { data, error } = await supabase
        .from('delegations')
        .select('*')
        .eq('organization_id', organizationId);
      
      if (!error && data) {
        return data as Delegation[];
      }
    } catch {}

    return this.getLocalDelegations().filter(d => d.organization_id === organizationId);
  }
}
