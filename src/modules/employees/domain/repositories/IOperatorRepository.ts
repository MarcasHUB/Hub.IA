import { Operator, OperatorStatus } from '../entities/Operator';
import { Invitation } from '../entities/Invitation';

export interface IOperatorRepository {
  inviteOperator(payload: {
    nome: string;
    sobrenome: string;
    email: string;
    telefone?: string;
    cargo?: string;
    perfil: string;
    category_ids: string[];
    todas_categorias?: boolean;
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
  getInvitationByEmail(email: string): Promise<Invitation | null>;
  cancelInvite(email: string, operatorId: string): Promise<void>;
  resendInvite(email: string): Promise<void>;
  
  updateOperator(id: string, payload: Partial<Operator>): Promise<void>;
  deleteOperator(id: string): Promise<void>;
  updateOperatorStatus(id: string, status: OperatorStatus): Promise<void>;
}
