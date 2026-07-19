// ─── Operator Domain Entity ────────────────────────────────────────────────────

export type OperatorPerfil = 'administrador' | 'gestor' | 'comprador' | 'consulta';

export type OperatorStatus =
  | 'pendente'
  | 'ativo'
  | 'inativo'
  | 'bloqueado'
  | 'ferias'
  | 'substituido'
  | 'cancelado';

export interface Operator {
  id: string;
  organization_id: string;
  nome: string;
  sobrenome: string;
  email: string;
  telefone?: string;
  cargo?: string;
  perfil: OperatorPerfil;
  status: OperatorStatus;
  gestor_id?: string;
  invited_at?: string;
  accepted_at?: string;
  last_login_at?: string;
  last_activity_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  // Relacionamentos opcionais (carregados via join)
  segments?: string[]; // IDs dos segmentos autorizados
  todos_segmentos?: boolean;
}

export function operatorFullName(op: Operator): string {
  return `${op.nome} ${op.sobrenome}`.trim();
}

export function operatorStatusLabel(status: OperatorStatus): string {
  const map: Record<OperatorStatus, string> = {
    pendente: 'Pendente',
    ativo: 'Ativo',
    inativo: 'Inativo',
    bloqueado: 'Bloqueado',
    ferias: 'Férias',
    substituido: 'Substituído',
    cancelado: 'Cancelado',
  };
  return map[status];
}

export function operatorPerfilLabel(perfil: OperatorPerfil): string {
  const map: Record<OperatorPerfil, string> = {
    administrador: 'Administrador',
    gestor: 'Gestor',
    comprador: 'Comprador',
    consulta: 'Consulta',
  };
  return map[perfil];
}
