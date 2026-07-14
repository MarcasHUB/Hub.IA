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
  private getLocalAccessLogs(): AccessLog[] {
    try {
      const raw = localStorage.getItem('supplyhub_access_logs_v2');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalAccessLogs(logs: AccessLog[]) {
    localStorage.setItem('supplyhub_access_logs_v2', JSON.stringify(logs));
  }

  private getLocalOperationLogs(): OperationLog[] {
    try {
      const raw = localStorage.getItem('supplyhub_operation_logs_v2');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalOperationLogs(logs: OperationLog[]) {
    localStorage.setItem('supplyhub_operation_logs_v2', JSON.stringify(logs));
  }

  /**
   * Grava um log de acesso (IP, User-Agent, Data/Hora)
   */
  async logAccess(log: Omit<AccessLog, 'id' | 'created_at'>): Promise<AccessLog> {
    const newLog: AccessLog = {
      ...log,
      id: `acc-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    const local = this.getLocalAccessLogs();
    local.push(newLog);
    this.saveLocalAccessLogs(local);

    try {
      await supabase.from('access_logs').insert({
        operator_id: log.operator_id || null,
        organization_id: log.organization_id,
        tipo: log.tipo,
        ip: log.ip || null,
        user_agent: log.user_agent || null,
        resultado: log.resultado,
      });
    } catch {}

    return newLog;
  }

  /**
   * Grava um log de operação
   */
  async logOperation(log: Omit<OperationLog, 'id' | 'created_at'>): Promise<OperationLog> {
    const newLog: OperationLog = {
      ...log,
      id: `ope-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    const local = this.getLocalOperationLogs();
    local.push(newLog);
    this.saveLocalOperationLogs(local);

    try {
      await supabase.from('operation_logs').insert({
        operator_id: log.operator_id || null,
        organization_id: log.organization_id,
        entidade: log.entidade,
        acao: log.acao,
        payload_antes: log.payload_antes || null,
        payload_depois: log.payload_depois || null,
      });
    } catch {}

    return newLog;
  }

  /**
   * Retorna a listagem unificada de logs de acesso e operação para a tela de Logs
   */
  async listLogs(organizationId: string): Promise<{ accessLogs: AccessLog[]; operationLogs: OperationLog[] }> {
    let accessLogs = this.getLocalAccessLogs().filter(l => l.organization_id === organizationId);
    let operationLogs = this.getLocalOperationLogs().filter(l => l.organization_id === organizationId);

    try {
      const { data: accData } = await supabase
        .from('access_logs')
        .select('*')
        .eq('organization_id', organizationId);
      
      const { data: opeData } = await supabase
        .from('operation_logs')
        .select('*')
        .eq('organization_id', organizationId);

      if (accData) accessLogs = accData as AccessLog[];
      if (opeData) operationLogs = opeData as OperationLog[];
    } catch {}

    // Injetar nomes aproximados de operadores para exibição offline
    const rawOps = localStorage.getItem('supplyhub_operators_v2') || '[]';
    const ops = JSON.parse(rawOps);
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
