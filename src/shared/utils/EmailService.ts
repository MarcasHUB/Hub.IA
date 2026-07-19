import { supabase } from '@/infrastructure/supabase/client';

export type SendEmailAction = 'operator_invite' | 'supplier_invite' | 'new_quotation';

export class EmailService {
  /**
   * Dispara o envio de um e-mail transacional de forma segura através do Cloudflare Functions.
   * Valida automaticamente a sessão e envia o JWT para autorização e RLS.
   * 
   * @param action A ação na whitelist (ex: operator_invite, supplier_invite)
   * @param targetId O ID do recurso no banco de dados (operator_invitations.id, invitations.id)
   */
  static async sendTransactionalEmail(action: SendEmailAction, targetId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action, target_id: targetId })
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('Email API Error:', responseData);
        throw new Error(responseData.error || 'Erro ao enviar e-mail');
      }

      return { success: true, message: responseData.message };
    } catch (err: any) {
      console.error('EmailService Exception:', err);
      return { success: false, message: err.message };
    }
  }
}
