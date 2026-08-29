import { supabase } from '@/infrastructure/supabase/client';

export type SignalCriticidade = 'critico' | 'alto' | 'medio' | 'informativo';
export type SignalStatus = 'open' | 'read' | 'resolved' | 'ignored';
export type SignalCategoria = 'operadores' | 'seguranca' | 'segmentos' | 'fornecedores' | 'cotacoes' | 'saving' | 'governanca';

export interface HubIASignal {
  id: string;
  organization_id: string;
  operator_id?: string;
  segment_id?: string;
  tipo_sinal: string;
  descricao: string;
  dados?: unknown;
  status: SignalStatus;
  criticidade: SignalCriticidade;
  categoria: SignalCategoria;
  created_at: string;
}

type SignalRow = Omit<HubIASignal, 'status' | 'criticidade' | 'categoria'> & {
  status?: SignalStatus | null;
  lido?: boolean;
};

const mapSignal = (row: SignalRow): HubIASignal => ({
  ...row,
  status: row.status ?? (row.lido ? 'read' : 'open'),
  // The canonical table does not persist severity/category yet. Keep the UI
  // neutral instead of deriving or fabricating business classifications.
  criticidade: 'informativo',
  categoria: 'governanca',
});

export class SupabaseSignalRepository {
  async listActiveSignals(organizationId: string): Promise<HubIASignal[]> {
    const { data, error } = await supabase
      .from('hubia_signals')
      .select('id, organization_id, operator_id, segment_id, tipo_sinal, descricao, dados, status, lido, created_at')
      .eq('organization_id', organizationId)
      .in('status', ['open', 'read'])
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Alertas Hub.IA indisponíveis: ${error.message}`);

    const unique = new Map<string, HubIASignal>();
    for (const row of (data ?? []) as SignalRow[]) {
      const signal = mapSignal(row);
      const key = `${signal.tipo_sinal}-${signal.categoria}-${signal.descricao}`;
      if (!unique.has(key)) unique.set(key, signal);
    }

    const priority: Record<SignalCriticidade, number> = {
      critico: 4,
      alto: 3,
      medio: 2,
      informativo: 1,
    };
    return [...unique.values()].sort((a, b) => priority[b.criticidade] - priority[a.criticidade]);
  }

  async updateSignalStatus(id: string, status: Exclude<SignalStatus, 'open'>): Promise<void> {
    const { error } = await supabase.rpc('set_hubia_signal_status', {
      p_signal_id: id,
      p_status: status,
    });
    if (error) throw new Error(`Não foi possível atualizar o alerta: ${error.message}`);
  }

  async getCounters(organizationId: string): Promise<{ criticos: number; abertos: number; resolvidos: number }> {
    const { data, error } = await supabase
      .from('hubia_signals')
      .select('status')
      .eq('organization_id', organizationId);
    if (error) throw new Error(`Contadores Hub.IA indisponíveis: ${error.message}`);

    const rows = (data ?? []) as Array<{ status: SignalStatus }>;
    return {
      criticos: 0,
      abertos: rows.filter(row => row.status === 'open' || row.status === 'read').length,
      resolvidos: rows.filter(row => row.status === 'resolved').length,
    };
  }
}
