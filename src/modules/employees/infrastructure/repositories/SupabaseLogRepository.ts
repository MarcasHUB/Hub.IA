import { supabase } from '@/infrastructure/supabase/client';

export interface AccessLog {
  id: string;
  operator_id?: string;
  organization_id: string;
  tipo: 'login' | 'logout' | 'tentativa_falha' | 'bloqueio';
  ip?: string;
  user_agent?: string;
  resultado: 'sucesso' | 'falha';
  created_at: string;
  operator_nome?: string; // join local/remoto
}

export interface OperationLog {
  id: string;
  operator_id?: string;
  organization_id: string;
  entidade: string;
  acao: string;
  payload_antes?: any;
  payload_depois?: any;
  created_at: string;
  operator_nome?: string; // join local/remoto
}

export class SupabaseLogRepository {
  /**
   * Grava um log de acesso (IP, User-Agent, Data/Hora)
   */
  async logAccess(log: Omit<AccessLog, 'id' | 'created_at'>): Promise<AccessLog> {
    const { data, error } = await supabase.from('access_logs').insert({
      operator_id: log.operator_id || null,
      organization_id: log.organization_id,
      tipo: log.tipo,
      ip: log.ip || null,
      user_agent: log.user_agent || null,
      resultado: log.resultado,
    }).select().single();

    if (error) {
      throw error;
    }

    return data as AccessLog;
  }



  /**
   * Grava um log de operação
   */
  async logOperation(log: Omit<OperationLog, 'id' | 'created_at'>): Promise<OperationLog> {
    const { data, error } = await supabase.from('operation_logs').insert({
      operator_id: log.operator_id || null,
      organization_id: log.organization_id,
      entidade: log.entidade,
      acao: log.acao,
      payload_antes: log.payload_antes || null,
      payload_depois: log.payload_depois || null,
    }).select().single();

    if (error) {
      throw error;
    }

    return data as OperationLog;
  }

  /**
   * Retorna a listagem unificada de logs de acesso e operação para a tela de Logs
   */
  async listLogs(organizationId: string): Promise<{ accessLogs: AccessLog[]; operationLogs: OperationLog[] }> {
    const [accResult, opeResult, opsResult] = await Promise.all([
      supabase.from('access_logs').select('*').eq('organization_id', organizationId),
      supabase.from('operation_logs').select('*').eq('organization_id', organizationId),
      supabase.from('operators').select('id, nome, sobrenome').eq('organization_id', organizationId)
    ]);

    let accessLogs = (accResult.data as AccessLog[]) || [];
    let operationLogs = (opeResult.data as OperationLog[]) || [];
    const ops = opsResult.data || [];

    const opMap = new Map<string, string>(ops.map((o: any) => [o.id, `${o.nome} ${o.sobrenome}`]));

    accessLogs = accessLogs.map(l => ({
      ...l,
      operator_nome: l.operator_id ? opMap.get(l.operator_id) || 'Operador Central' : 'Sistema',
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    operationLogs = operationLogs.map(l => ({
      ...l,
      operator_nome: l.operator_id ? opMap.get(l.operator_id) || 'Operador Central' : 'Sistema',
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { accessLogs, operationLogs };
  }
}
