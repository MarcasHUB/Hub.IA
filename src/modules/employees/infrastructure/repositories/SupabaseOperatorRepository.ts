import { supabase } from '@/infrastructure/supabase/client';
import { Operator, OperatorStatus } from '../../domain/entities/Operator';
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
    category_ids: string[];
    todas_categorias?: boolean;
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
    const { data, error } = await supabase.functions.invoke('validate-operator-invite', {
      body: { token }
    });

    if (error || !data || !data.success) {
      return null;
    }

    return data.data as Invitation;
  }

  /**
   * Lista todos os operadores do tenant atual
   */
  async listOperators(organizationId: string): Promise<Operator[]> {
    const { data, error } = await supabase
      .from('operators')
      .select('*, operator_categories(category_id)')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('nome', { ascending: true });

    if (error) {
      throw error;
    }

    // Map `operator_categories` para um array de strings `categories` para o frontend
    return (data as any[]).map(op => ({
      ...op,
      categories: op.operator_categories ? op.operator_categories.map((os: any) => os.category_id) : []
    })) as Operator[];
  }

  async getInvitationByEmail(email: string): Promise<Invitation | null> {
    const { data, error } = await supabase
      .from('operator_invitations')
      .select('*')
      .ilike('email', email)
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
      .ilike('email', email)
      .eq('status', 'pendente');

    if (errInv) throw errInv;

    const { error: errOp } = await supabase
      .from('operators')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('id', operatorId)
      .eq('status', 'pendente');

    if (errOp) throw errOp;
  }

  async updateOperatorStatus(id: string, status: OperatorStatus): Promise<void> {
    const { error } = await supabase
      .from('operators')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  async updateOperator(id: string, payload: Partial<Operator>): Promise<void> {
    // Implementa allowlist explícita: envia SOMENTE colunas reais da tabela operators.
    const allowedPayload: any = {};
    if (payload.nome !== undefined) allowedPayload.nome = payload.nome;
    if (payload.sobrenome !== undefined) allowedPayload.sobrenome = payload.sobrenome;
    if (payload.telefone !== undefined) allowedPayload.telefone = payload.telefone;
    if (payload.cargo !== undefined) allowedPayload.cargo = payload.cargo;
    if (payload.perfil !== undefined) allowedPayload.perfil = payload.perfil;
    if (payload.status !== undefined) allowedPayload.status = payload.status;
    if (payload.todas_categorias !== undefined) allowedPayload.todas_categorias = payload.todas_categorias;
    
    allowedPayload.updated_at = new Date().toISOString();
    
    const { error } = await supabase
      .from('operators')
      .update(allowedPayload)
      .eq('id', id);

    if (error) throw error;

    // Se o operador for pendente, precisamos manter as duas estruturas consistentes (operators e operator_invitations)
    if (payload.status === 'pendente' && payload.email) {
      const allowedInvitePayload: any = {};
      if (payload.nome !== undefined) allowedInvitePayload.nome = payload.nome;
      if (payload.cargo !== undefined) allowedInvitePayload.cargo = payload.cargo;
      if (payload.perfil !== undefined) allowedInvitePayload.perfil = payload.perfil;
      if (payload.todas_categorias !== undefined) allowedInvitePayload.todas_categorias = payload.todas_categorias;
      if (payload.categories !== undefined) allowedInvitePayload.category_ids = payload.categories;
      
      if (Object.keys(allowedInvitePayload).length > 0) {
        const { error: invError } = await supabase
          .from('operator_invitations')
          .update(allowedInvitePayload)
          .eq('email', payload.email)
          .eq('status', 'pendente');
          
        if (invError) throw invError;
      }
    }

    // Atualizar tabela N:N se o array de categorias foi passado
    if (payload.categories !== undefined) {
      // 1. Limpar vínculos anteriores
      const { error: delError } = await supabase
        .from('operator_categories')
        .delete()
        .eq('operator_id', id);
        
      if (delError) throw delError;

      // 2. Se não for "todas_categorias", e tiver categorias a inserir, criar novos vínculos
      if (!payload.todas_categorias && payload.categories && payload.categories.length > 0) {
        const links = payload.categories.map(catId => ({
          operator_id: id,
          category_id: catId
        }));
        
        const { error: insError } = await supabase
          .from('operator_categories')
          .insert(links);
          
        if (insError) throw insError;
      }
    }
  }

  async deleteOperator(id: string): Promise<void> {
    const { error } = await supabase
      .from('operators')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  async resendInvite(email: string): Promise<void> {
    const { error } = await supabase
      .from('operator_invitations')
      .update({
        sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      })
      .ilike('email', email)
      .eq('status', 'pendente');

    if (error) throw error;
  }

  async updateEmailStatus(token: string, status: string, errorMessage?: string): Promise<void> {
    const { error } = await supabase
      .from('operator_invitations')
      .update({
        email_status: status,
        email_error: errorMessage || null,
        email_sent_at: status === 'sent' ? new Date().toISOString() : undefined
      })
      .eq('token', token);

    if (error) {
      console.error('Falha ao atualizar status de email do operator_invitation', error);
    }
  }
}
