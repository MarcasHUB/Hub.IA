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
  categories?: string[]; // IDs das categorias autorizadas
  todas_categorias?: boolean;
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

export type MacroProfile = 'Solicitante' | 'Comprador' | 'Gestor' | 'Administrador' | 'Auditor';

export const MACRO_PROFILES: Record<MacroProfile, { perfil: OperatorPerfil; cargo: string; mobile: boolean; desktop: boolean; perms: string[]; rests: string[] }> = {
  Solicitante: {
    perfil: 'consulta',
    cargo: '[APP] Solicitante',
    mobile: true,
    desktop: false,
    perms: ['Criar solicitações.', 'Consultar andamento das solicitações.', 'Acompanhar aprovações.'],
    rests: ['Não aprova solicitações.', 'Não realiza compras.', 'Não acessa módulos administrativos.']
  },
  Comprador: {
    perfil: 'comprador',
    cargo: '[DESKTOP] Comprador',
    mobile: true,
    desktop: true,
    perms: ['Receber solicitações.', 'Realizar cotações.', 'Comparar fornecedores.', 'Emitir orçamentos.', 'Conduzir processos de compra.', 'Acompanhar negociações.'],
    rests: []
  },
  Gestor: {
    perfil: 'gestor',
    cargo: '[DESKTOP] Gestor',
    mobile: true,
    desktop: true,
    perms: ['Aprovar solicitações.', 'Aprovar valores conforme política.', 'Acompanhar solicitações da equipe.', 'Delegar aprovações quando permitido.'],
    rests: []
  },
  Administrador: {
    perfil: 'administrador',
    cargo: '[DESKTOP] Administrador',
    mobile: true,
    desktop: true,
    perms: ['Administração do sistema.', 'Gestão de usuários.', 'Configurações gerais.', 'Gestão operacional completa.'],
    rests: []
  },
  Auditor: {
    perfil: 'consulta',
    cargo: '[DESKTOP] Auditor',
    mobile: false,
    desktop: true,
    perms: ['Consulta de informações.', 'Consulta de históricos.', 'Consulta de aprovações.', 'Consulta de processos encerrados.'],
    rests: ['Não cria solicitações.', 'Não aprova solicitações.', 'Não realiza compras.', 'Não altera registros.', 'Não acessa funções administrativas.']
  }
};

