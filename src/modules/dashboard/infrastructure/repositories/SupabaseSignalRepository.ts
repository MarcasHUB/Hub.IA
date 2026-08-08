import { supabase } from '@/infrastructure/supabase/client';

export type SignalCriticidade = 'critico' | 'alto' | 'medio' | 'informativo';
export type SignalStatus = 'nao_lido' | 'lido' | 'resolvido' | 'ignorado';
export type SignalCategoria = 'operadores' | 'seguranca' | 'segmentos' | 'fornecedores' | 'cotacoes' | 'saving' | 'governanca';

export interface HubIASignal {
  id: string;
  organization_id: string;
  operator_id?: string;
  segment_id?: string;
  tipo_sinal: string;
  descricao: string;
  dados?: any;
  status: SignalStatus;
  criticidade: SignalCriticidade;
  categoria: SignalCategoria;
  created_at: string;
}

const SEED_SIGNALS: HubIASignal[] = [
  {
    id: 'sig-1',
    organization_id: '00000000-0000-0000-0000-000000000000',
    tipo_sinal: 'excesso_tentativas_login',
    descricao: 'Segurança: Excesso de tentativas falhas de login (5+) detectadas para o e-mail: gestor@empresa.com.',
    status: 'nao_lido',
    criticidade: 'critico',
    categoria: 'seguranca',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sig-2',
    organization_id: '00000000-0000-0000-0000-000000000000',
    tipo_sinal: 'segmento_sem_responsavel',
    descricao: 'Governança: O segmento "EPI" está ativo mas não possui operador responsável definido.',
    status: 'nao_lido',
    criticidade: 'alto',
    categoria: 'segmentos',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sig-3',
    organization_id: '00000000-0000-0000-0000-000000000000',
    tipo_sinal: 'convite_pendente',
    descricao: 'Operações: O convite enviado para maria@empresa.com.br expira em menos de 12 horas.',
    status: 'nao_lido',
    criticidade: 'medio',
    categoria: 'operadores',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sig-4',
    organization_id: '00000000-0000-0000-0000-000000000000',
    tipo_sinal: 'delegacao_proxima_vencimento',
    descricao: 'Governança: A delegação ativa para o operador substituto expira em 2 dias.',
    status: 'nao_lido',
    criticidade: 'informativo',
    categoria: 'governanca',
    created_at: new Date().toISOString(),
  }
];

export class SupabaseSignalRepository {
  private getLocalSignals(): HubIASignal[] {
    try {
      const raw = localStorage.getItem('supplyhub_signals_v2');
      if (raw) return JSON.parse(raw);
    } catch {}
    this.saveLocalSignals(SEED_SIGNALS);
    return SEED_SIGNALS;
  }

  private saveLocalSignals(signals: HubIASignal[]) {
    localStorage.setItem('supplyhub_signals_v2', JSON.stringify(signals));
  }

  /**
   * Lista todos os sinais não resolvidos/ignorados consolidando duplicatas
   */
  async listActiveSignals(organizationId: string): Promise<HubIASignal[]> {
    let list: HubIASignal[] = [];
    try {
      const { data, error } = await supabase
        .from('hubia_signals')
        .select('*')
        .eq('organization_id', organizationId);

      if (!error && data) {
        list = data.map((d: any) => ({
          ...d,
          status: d.lido ? 'lido' : 'nao_lido',
          criticidade: d.criticidade || 'informativo',
          categoria: d.categoria || 'operadores'
        })) as HubIASignal[];
      } else {
        list = this.getLocalSignals().filter(s => s.organization_id === organizationId);
      }
    } catch {
      list = this.getLocalSignals().filter(s => s.organization_id === organizationId);
    }

    // Filtrar apenas em aberto (Não Resolvidos e Não Ignorados)
    const active = list.filter(s => s.status !== 'resolvido' && s.status !== 'ignorado');

    // Consolidar duplicados com base na descrição ou tipo
    const uniqueMap = new Map<string, HubIASignal>();
    active.forEach(item => {
      const key = `${item.tipo_sinal}-${item.categoria}-${item.descricao}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      const priority: Record<SignalCriticidade, number> = { critico: 4, alto: 3, medio: 2, informativo: 1 };
      return priority[b.criticidade] - priority[a.criticidade];
    });
  }

  /**
   * Atualiza o status do sinal para auditoria e histórico
   */
  async updateSignalStatus(id: string, status: SignalStatus): Promise<boolean> {
    // 1. Atualizar persistência local
    const local = this.getLocalSignals();
    const index = local.findIndex(s => s.id === id);
    if (index !== -1) {
      local[index].status = status;
      this.saveLocalSignals(local);
    }

    // 2. Atualizar Supabase Remoto
    try {
      // O banco remoto não possui a coluna 'status', possui a coluna booleana 'lido'.
      // Portanto 'lido', 'resolvido', 'ignorado' podem ser considerados lidos.
      const isLido = status !== 'nao_lido';
      await supabase
        .from('hubia_signals')
        .update({ lido: isLido })
        .eq('id', id);
    } catch {}

    return true;
  }

  /**
   * Obtém os contadores estatísticos dos sinais
   */
  async getCounters(organizationId: string): Promise<{ criticos: number; abertos: number; resolvidos: number }> {
    let list: HubIASignal[] = [];
    try {
      const { data } = await supabase
        .from('hubia_signals')
        .select('*')
        .eq('organization_id', organizationId);
      if (data) {
        list = data.map((d: any) => ({
          ...d,
          status: d.lido ? 'lido' : 'nao_lido',
          criticidade: d.criticidade || 'informativo',
          categoria: d.categoria || 'operadores'
        })) as HubIASignal[];
      } else {
        list = this.getLocalSignals();
      }
    } catch {
      list = this.getLocalSignals();
    }

    return {
      criticos: list.filter(s => s.criticidade === 'critico' && s.status !== 'resolvido' && s.status !== 'ignorado').length,
      abertos: list.filter(s => s.status === 'nao_lido' || s.status === 'lido').length,
      resolvidos: list.filter(s => s.status === 'resolvido').length,
    };
  }
}
