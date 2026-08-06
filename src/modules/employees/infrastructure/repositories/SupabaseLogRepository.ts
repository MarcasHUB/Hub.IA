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
  async logAccess(log: Omit<AccessLog, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase.from('access_logs').insert({
      operator_id: log.operator_id || null,
      organization_id: log.organization_id,
      tipo: log.tipo,
      ip: log.ip || null,
      user_agent: log.user_agent || null,
      resultado: log.resultado,
    });

    if (error) {
      throw error;
    }
  }



  /**
   * Grava um log de operação
   */
  async logOperation(log: Omit<OperationLog, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase.from('operation_logs').insert({
      operator_id: log.operator_id || null,
      organization_id: log.organization_id,
      entidade: log.entidade,
      acao: log.acao,
      payload_antes: log.payload_antes || null,
      payload_depois: log.payload_depois || null,
    });

    if (error) {
      throw error;
    }
  }

  /**
   * Retorna a listagem unificada de logs de acesso e operação para a tela de Logs
   */
  async listLogs(organizationId: string): Promise<{ accessLogs: AccessLog[]; operationLogs: OperationLog[] }> {
    const [accResult, opeResult, opsResult] = await Promise.all([
      supabase.from('access_logs').select('*').eq('organization_id', organizationId),
      supabase.from('operation_logs').select('*').eq('organization_id', organizationId),
      supabase.from('operators').select('id, email').eq('organization_id', organizationId)
    ]);

    let accessLogs = (accResult.data as AccessLog[]) || [];
    let operationLogs = (opeResult.data as OperationLog[]) || [];
    const ops = opsResult.data || [];
    
    // Fetch profiles for the operators
    const opIds = ops.map((o: any) => o.id);
    let profilesMap = new Map<string, any>();
    if (opIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('user_id, display_name, full_name, email, contact_email').in('user_id', opIds);
      if (profs) {
        profs.forEach(p => profilesMap.set(p.user_id, p));
      }
    }

    const opMap = new Map<string, string>(ops.map((o: any) => {
      const p = profilesMap.get(o.id);
      const name = p?.display_name || p?.full_name || p?.email || o.email || 'Usuário não identificado';
      return [o.id, name];
    }));

    accessLogs = accessLogs.map(l => ({
      ...l,
      operator_nome: l.operator_id ? opMap.get(l.operator_id) || 'Usuário não identificado' : 'Sistema',
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    operationLogs = operationLogs.map(l => ({
      ...l,
      operator_nome: l.operator_id ? opMap.get(l.operator_id) || 'Usuário não identificado' : 'Sistema',
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { accessLogs, operationLogs };
  }
}
