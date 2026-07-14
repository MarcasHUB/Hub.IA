// ─── Invitation Domain Entity ──────────────────────────────────────────────────

export type InvitationStatus = 'pendente' | 'aceito' | 'expirado' | 'cancelado';

export interface Invitation {
  id: string;
  organization_id: string;
  invited_by_id: string;
  email: string;
  nome: string;
  cargo?: string;
  perfil: string;
  token: string; // hash SHA-256, nunca o token cru
  status: InvitationStatus;
  sent_at: string;
  expires_at: string;
  accepted_at?: string;
  ip_aceite?: string;
  user_agent_aceite?: string;

  // Segmentos a vincular após aceite
  segment_ids?: string[];

  // Relacionamentos opcionais
  invited_by_nome?: string;
}
