// ─── Delegation Domain Entity ──────────────────────────────────────────────────

export type DelegationStatus = 'ativa' | 'encerrada' | 'cancelada';

export interface Delegation {
  id: string;
  organization_id: string;
  operador_origem_id: string;
  operador_substituto_id: string;
  data_inicio: string; // ISO date
  data_fim: string;    // ISO date
  motivo: string;
  status: DelegationStatus;
  segmentos_espelhados: boolean;
  permissoes_espelhadas: boolean;
  created_at: string;

  // Relacionamentos opcionais
  operador_origem_nome?: string;
  operador_substituto_nome?: string;
}
