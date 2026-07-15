import { supabase } from '@/infrastructure/supabase/client';
import { Operator } from '../../domain/entities/Operator';
import { Invitation } from '../../domain/entities/Invitation';
import { IOperatorRepository } from '../../domain/repositories/IOperatorRepository';

export class SupabaseOperatorRepository implements IOperatorRepository {
  /**
   * Invoca a Edge Function para criar e convidar o operador com segurança (admin logic)
   */
  async inviteOperator(payload: {
    nome: string;
    sobrenome: string;
    email: string;
    telefone?: string;
    cargo?: string;
    perfil: string;
    segment_ids: string[];
    invited_by_id?: string;
    organization_id: string;
  }): Promise<{ success: boolean; message: string; user?: any; token?: string; expires_at?: string }> {
    const { data, error } = await supabase.functions.invoke('invite-operator', {
      body: payload,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao enviar convite via Edge Function.');
    }

    return data;
  }

  /**
   * Invoca a Edge Function para aceitar o convite, definir senha e ativar operador
   */
  async acceptInvite(payload: {
    token: string;
    password?: string;
    ip?: string;
    user_agent?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.functions.invoke('accept-invite', {
      body: payload,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao processar aceite do convite.');
    }

    return data;
  }

  /**
   * Busca um convite pendente por token para validação na tela de aceite
   */
  async getInvitationByToken(token: string): Promise<Invitation | null> {
    const { data, error } = await supabase
      .from('operator_invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pendente')
      .single();

    if (error || !data) {
      return null;
    }

    return data as Invitation;
  }

  /**
   * Lista todos os operadores do tenant atual
   */
  async listOperators(organizationId: string): Promise<Operator[]> {
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('nome', { ascending: true });

    if (error) {
      throw error;
    }

    return data as Operator[];
  }

  async getInvitationByEmail(email: string): Promise<Invitation | null> {
    const { data, error } = await supabase
      .from('operator_invitations')
      .select('*')
      .eq('email', email)
      .eq('status', 'pendente')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as Invitation;
  }

  async cancelInvite(email: string, operatorId: string): Promise<void> {
    const { error: errInv } = await supabase
      .from('operator_invitations')
      .update({ status: 'cancelado' })
      .eq('email', email)
      .eq('status', 'pendente');

    if (errInv) throw errInv;

    const { error: errOp } = await supabase
      .from('operators')
      .delete()
      .eq('id', operatorId);

    if (errOp) throw errOp;
  }

  async resendInvite(email: string): Promise<void> {
    const { error } = await supabase
      .from('operator_invitations')
      .update({
        sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      })
      .eq('email', email)
      .eq('status', 'pendente');

    if (error) throw error;
  }
}
