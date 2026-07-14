// ─── Segment Domain Entity ─────────────────────────────────────────────────────

export type SegmentStatus = 'ativo' | 'inativo';

export interface Segment {
  id: string;
  organization_id: string;
  nome: string;
  descricao?: string;
  status: SegmentStatus;
  responsavel_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  // Relacionamentos opcionais (carregados via join)
  responsavel_nome?: string;
  operadores_count?: number;
}

// Segmentos padrão sugeridos para novos tenants
export const DEFAULT_SEGMENTS = [
  'EPI',
  'Uniformes',
  'Ferramentas Elétricas',
  'Ferramentas Manuais',
  'Bombas',
  'Motores',
  'Pneumática',
  'Hidráulica',
  'Rolamentos',
  'Instrumentação',
  'Serviços',
  'Outros',
];
