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
    gestor_id?: string;
    category_ids: string[];
    todas_categorias?: boolean;
  }): Promise<{ success: boolean; message: string; user?: any; token?: string; expires_at?: string }>;

  acceptInvite(payload: {
    token: string;
    password?: string;
  }): Promise<{ success: boolean; message: string }>;

  getInvitationByToken(token: string): Promise<Invitation | null>;

  listOperators(): Promise<Operator[]>;
  cancelInvite(email: string, operatorId: string): Promise<void>;
  resendInvite(email: string): Promise<{ token: string; expires_at: string }>;
  
  updateOperator(id: string, payload: Partial<Operator>): Promise<void>;
  deleteOperator(id: string): Promise<void>;
  updateOperatorStatus(id: string, status: OperatorStatus): Promise<void>;
}
