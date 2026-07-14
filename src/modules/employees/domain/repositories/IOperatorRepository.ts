import { Operator } from '../entities/Operator';
import { Invitation } from '../entities/Invitation';

export interface IOperatorRepository {
  inviteOperator(payload: {
    nome: string;
    sobrenome: string;
    email: string;
    telefone?: string;
    cargo?: string;
    perfil: string;
    segment_ids: string[];
    invited_by_id?: string;
    organization_id: string;
  }): Promise<{ success: boolean; message: string; user?: any; token?: string; expires_at?: string }>;

  acceptInvite(payload: {
    token: string;
    password?: string;
    ip?: string;
    user_agent?: string;
  }): Promise<{ success: boolean; message: string }>;

  getInvitationByToken(token: string): Promise<Invitation | null>;

  listOperators(organizationId: string): Promise<Operator[]>;
  
  // Opções adicionais que podemos precisar depois
  // updateOperator(id: string, payload: Partial<Operator>): Promise<Operator>;
  // inactivateOperator(id: string): Promise<void>;
}
