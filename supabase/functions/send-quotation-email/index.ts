// ============================================================
// SupplyHub.IA — Edge Function: send-quotation-email
// ============================================================
// STATUS: ESTRUTURA PRONTA — aguardando configuração de
// provedor de e-mail (ex: Resend, SendGrid, AWS SES).
//
// Para ativar:
// 1. Assinar um serviço de e-mail (recomendado: Resend.com)
// 2. Adicionar a chave de API no Supabase:
//    Dashboard → Settings → Edge Functions → Environment Variables
//    RESEND_API_KEY = re_xxxxxxxxxxxx
// 3. Descomentar o bloco de envio abaixo
// 4. Deploy: supabase functions deploy send-quotation-email
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuotationEmailPayload {
  type: 'quotation_sent_to_supplier' | 'quotation_response_received' | 'connection_invite';
  recipient_email: string;
  recipient_name: string;
  sender_company: string;
  subject_title: string;
  action_url: string;
  metadata?: Record<string, unknown>;
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: QuotationEmailPayload = await req.json();

    // ── Validação básica ──────────────────────────────────────────────────
    if (!payload.recipient_email || !payload.type) {
      return new Response(
        JSON.stringify({ error: 'recipient_email e type são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Template HTML por tipo de notificação ────────────────────────────
    const templates: Record<QuotationEmailPayload['type'], { subject: string; html: string }> = {
      quotation_sent_to_supplier: {
        subject: `📋 Nova cotação para responder — ${payload.subject_title}`,
        html: `
          <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">SupplyHub.IA</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 13px;">Plataforma Inteligente de Compras</p>
            </div>
            <div style="padding: 32px; background: white;">
              <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 16px;">Olá, ${payload.recipient_name}!</h2>
              <p style="color: #475569; line-height: 1.6;">
                A empresa <strong>${payload.sender_company}</strong> enviou uma nova solicitação de cotação:
              </p>
              <div style="background: #f1f5f9; border-left: 4px solid #4f46e5; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <strong style="color: #1e293b;">${payload.subject_title}</strong>
              </div>
              <p style="color: #475569; line-height: 1.6;">
                Acesse a plataforma para ver os itens solicitados e enviar sua proposta de preço.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${payload.action_url}" style="background: #4f46e5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                  Responder Cotação
                </a>
              </div>
            </div>
            <div style="padding: 20px; text-align: center; background: #f8fafc;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                SupplyHub.IA · Rede Inteligente de Compras B2B<br/>
                Você recebe este e-mail por ser parceiro da plataforma.
              </p>
            </div>
          </div>
        `,
      },
      quotation_response_received: {
        subject: `✅ Nova proposta recebida — ${payload.subject_title}`,
        html: `
          <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #059669, #0d9488); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">SupplyHub.IA</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 13px;">Nova Proposta Recebida!</p>
            </div>
            <div style="padding: 32px; background: white;">
              <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 16px;">Olá, ${payload.recipient_name}!</h2>
              <p style="color: #475569; line-height: 1.6;">
                <strong>${payload.sender_company}</strong> enviou uma proposta para a sua cotação:
              </p>
              <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <strong style="color: #1e293b;">${payload.subject_title}</strong>
              </div>
              <p style="color: #475569; line-height: 1.6;">
                Acesse o comparativo de propostas para avaliar e fechar o melhor negócio.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${payload.action_url}" style="background: #059669; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                  Ver Mapa Comparativo
                </a>
              </div>
            </div>
            <div style="padding: 20px; text-align: center; background: #f8fafc;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                SupplyHub.IA · Rede Inteligente de Compras B2B
              </p>
            </div>
          </div>
        `,
      },
      connection_invite: {
        subject: `🤝 Convite de parceria — ${payload.sender_company}`,
        html: `
          <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #1d4ed8, #4f46e5); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">SupplyHub.IA</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 13px;">Convite de Parceria na Rede</p>
            </div>
            <div style="padding: 32px; background: white;">
              <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 16px;">Olá, ${payload.recipient_name}!</h2>
              <p style="color: #475569; line-height: 1.6;">
                A empresa <strong>${payload.sender_company}</strong> enviou um convite de parceria para você na Rede de Empresas SupplyHub.IA.
              </p>
              <p style="color: #475569; line-height: 1.6;">
                Ao aceitar, vocês poderão trocar cotações diretamente pela plataforma.
              </p>
              <div style="text-align: center; margin: 28px 0; display: flex; gap: 12px; justify-content: center;">
                <a href="${payload.action_url}?action=accept" style="background: #1d4ed8; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                  ✅ Aceitar Convite
                </a>
                <a href="${payload.action_url}?action=reject" style="background: white; color: #64748b; border: 1px solid #e2e8f0; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
                  Recusar
                </a>
              </div>
            </div>
            <div style="padding: 20px; text-align: center; background: #f8fafc;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                SupplyHub.IA · Rede Inteligente de Compras B2B
              </p>
            </div>
          </div>
        `,
      },
    };

    const template = templates[payload.type];

    // ────────────────────────────────────────────────────────────────────
    // BLOCO DE ENVIO — DESCOMENTARAR QUANDO O SERVIÇO DE E-MAIL FOR ATIVADO
    // ────────────────────────────────────────────────────────────────────
    /*
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY não configurada nas variáveis de ambiente.');
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SupplyHub.IA <noreply@supplyhub.com.br>',
        to: [payload.recipient_email],
        subject: template.subject,
        html: template.html,
      }),
    });

    if (!emailResponse.ok) {
      const err = await emailResponse.text();
      throw new Error(`Resend API error: ${err}`);
    }

    const emailResult = await emailResponse.json();
    console.log('[send-quotation-email] E-mail enviado:', emailResult.id);
    */
    // ────────────────────────────────────────────────────────────────────

    // Retorno de sucesso (modo staging — sem envio real)
    return new Response(
      JSON.stringify({
        success: true,
        mode: 'staging',
        message: 'Estrutura de e-mail pronta. Ative o provedor de e-mail para envio real.',
        template_preview: {
          to: payload.recipient_email,
          subject: template.subject,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[send-quotation-email] Erro:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
