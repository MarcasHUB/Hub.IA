import { supabase } from '@/infrastructure/supabase/client';
import { Operator, OperatorStatus } from '../../domain/entities/Operator';
import { Invitation } from '../../domain/entities/Invitation';
import { IOperatorRepository } from '../../domain/repositories/IOperatorRepository';
import { hashToken } from '@/shared/utils/tokenUtils';

const neutralInviteMessage = 'Não foi possível processar o convite. Verifique os dados e tente novamente.';

export class SupabaseOperatorRepository implements IOperatorRepository {
  async inviteOperator(payload: {
    nome: string;
    sobrenome: string;
    email: string;
    telefone?: string;
    cargo?: string;
    perfil: string;
    gestor_id?: string;
    category_ids: string[];
    todas_categorias?: boolean;
    organization_id?: string;
    invited_by_id?: string;
  }): Promise<{ success: boolean; message: string; user?: any; token?: string; expires_at?: string }> {
    const { data, error } = await supabase.functions.invoke('invite-operator', { body: payload });
    if (!error) return data;

    let message = neutralInviteMessage;
    if (error.context && typeof error.context.json === 'function') {
      try {
        const response = await error.context.json();
        if (response.error === 'OPERATOR_EMAIL_REQUIRED') message = 'Informe um e-mail válido para o convite.';
      } catch {
        // A resposta externa permanece neutra.
      }
    }
    throw new Error(message);
  }

  async acceptInvite(payload: { token: string; password?: string }): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.functions.invoke('accept-invite', { body: payload });
    if (error) throw new Error('Não foi possível processar o convite.');
    return data;
  }

  async getInvitationByToken(token: string): Promise<Invitation | null> {
    const { data, error } = await supabase.functions.invoke('validate-operator-invite', { body: { token } });
    if (error || !data?.success) return null;
    return data.data as Invitation;
  }

  async listOperators(): Promise<Operator[]> {
    const { data, error } = await supabase.rpc('get_my_operators');
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map((operator: any) => ({
      ...operator,
      categories: Array.isArray(operator.category_ids) ? operator.category_ids : [],
    })) as Operator[];
  }

  async cancelInvite(email: string, operatorId: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_operator_invitation', {
      p_email: email,
      p_operator_id: operatorId,
    });
    if (error) throw error;
  }

  async updateOperatorStatus(id: string, status: OperatorStatus): Promise<void> {
    const { error } = await supabase.from('operators')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async updateOperator(id: string, payload: Partial<Operator>): Promise<void> {
    if (payload.status === 'pendente' && payload.email) {
      const { error } = await supabase.rpc('update_pending_operator_invitation', {
        p_operator_id: id,
        p_nome: payload.nome || '',
        p_sobrenome: payload.sobrenome || '',
        p_telefone: payload.telefone || null,
        p_cargo: payload.cargo || null,
        p_perfil: payload.perfil || 'comprador',
        p_gestor_id: payload.gestor_id || null,
        p_todas_categorias: Boolean(payload.todas_categorias),
        p_category_ids: payload.categories || [],
      });
      if (error) throw error;
      return;
    }

    const allowed: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ['nome', 'sobrenome', 'telefone', 'cargo', 'perfil', 'status', 'todas_categorias'] as const) {
      if (payload[key] !== undefined) allowed[key] = payload[key];
    }

    const { error } = await supabase.from('operators').update(allowed).eq('id', id);
    if (error) throw error;

    if (payload.categories !== undefined) {
      const { error: deleteError } = await supabase.from('operator_categories').delete().eq('operator_id', id);
      if (deleteError) throw deleteError;
      if (!payload.todas_categorias && payload.categories.length > 0) {
        const { error: insertError } = await supabase.from('operator_categories').insert(
          payload.categories.map(categoryId => ({ operator_id: id, category_id: categoryId })),
        );
        if (insertError) throw insertError;
      }
    }
  }

  async deleteOperator(id: string): Promise<void> {
    const { error } = await supabase.rpc('delete_operator_permanently', { p_operator_id: id });
    if (error) throw error;
  }

  async resendInvite(email: string): Promise<{ token: string; expires_at: string }> {
    const { data, error } = await supabase.functions.invoke('invite-operator', {
      body: { action: 'resend', email },
    });
    if (error || !data?.success || !data.token || !data.expires_at) throw new Error(neutralInviteMessage);
    return { token: data.token, expires_at: data.expires_at };
  }

  async updateEmailStatus(token: string, status: string, errorMessage?: string): Promise<void> {
    const tokenHash = await hashToken(token);
    const { error } = await supabase.rpc('mark_operator_invitation_email_delivery', {
      p_token_hash: tokenHash,
      p_status: status,
      p_error: errorMessage || null,
    });
    if (error) console.error('Falha ao atualizar o status de entrega do convite.');
  }
}
