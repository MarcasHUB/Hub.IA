import { supabase } from '@/infrastructure/supabase/client';
import { getAuthenticatedIdentity } from '@/modules/auth/application/services/getAuthenticatedIdentity';

export interface AccessLog {
  id: string;
  operator_id?: string;
  organization_id: string;
  tipo: 'login' | 'logout' | 'tentativa_falha' | 'bloqueio';
  ip?: string;
  user_agent?: string;
  resultado: 'sucesso' | 'falha';
  created_at: string;
  operator_nome?: string;
}

export interface OperationLog {
  id: string;
  operator_id?: string;
  organization_id: string;
  entidade: string;
  acao: string;
  payload_antes?: unknown;
  payload_depois?: unknown;
  created_at: string;
  operator_nome?: string;
}

export class SupabaseLogRepository {
  /**
   * A escrita de logs é restrita a RPCs, triggers e backends confiáveis.
   * O navegador expõe somente a consulta tenant-scoped.
   */
  async listLogs(_untrustedOrganizationId?: string): Promise<{ accessLogs: AccessLog[]; operationLogs: OperationLog[] }> {
    const organizationId = (await getAuthenticatedIdentity()).organizationId;
    const [accResult, opeResult, opsResult] = await Promise.all([
      supabase.from('access_logs').select('*').eq('organization_id', organizationId),
      supabase.from('operation_logs').select('*').eq('organization_id', organizationId),
      supabase.from('operators').select('id, email').eq('organization_id', organizationId),
    ]);

    let accessLogs = (accResult.data as AccessLog[]) || [];
    let operationLogs = (opeResult.data as OperationLog[]) || [];
    const operators = opsResult.data || [];

    const operatorIds = operators.map((operator: { id: string }) => operator.id);
    const profilesMap = new Map<string, Record<string, unknown>>();
    if (operatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, full_name, email, contact_email')
        .in('user_id', operatorIds);
      profiles?.forEach(profile => profilesMap.set(profile.user_id, profile));
    }

    const operatorNames = new Map<string, string>(operators.map((operator: { id: string; email?: string }) => {
      const profile = profilesMap.get(operator.id);
      const name = profile?.display_name
        || profile?.full_name
        || profile?.email
        || operator.email
        || 'Usuário não identificado';
      return [operator.id, String(name)];
    }));

    accessLogs = accessLogs.map(log => ({
      ...log,
      operator_nome: log.operator_id ? operatorNames.get(log.operator_id) || 'Usuário não identificado' : 'Sistema',
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    operationLogs = operationLogs.map(log => ({
      ...log,
      operator_nome: log.operator_id ? operatorNames.get(log.operator_id) || 'Usuário não identificado' : 'Sistema',
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { accessLogs, operationLogs };
  }
}
