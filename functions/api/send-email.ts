import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Configurações base
    const supabaseUrl = env.SUPABASE_URL || 'https://zwliwnpxwxxcqshxxmuu.supabase.co';
    const supabaseAnonKey = env.SUPABASE_ANON_KEY || 'sb_publishable_pupAJxCrbecwnz23tQY8ww_UpIA5SsV';
    const mailtrapToken = env.MAILTRAP_API_TOKEN;
    const fromEmail = env.MAILTRAP_FROM_EMAIL || 'convites@supplyhub.ia.br';
    const fromName = env.MAILTRAP_FROM_NAME || 'SupplyHUB';
    const publicUrl = env.APP_PUBLIC_URL || 'https://supplyhub.ia.br';

    if (!mailtrapToken) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: Mailtrap credentials missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Cria cliente Supabase atuando COMO o usuário logado (RLS será aplicado perfeitamente)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Validar sessão real no Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json();
    const { action, target_id } = body;

    if (!['operator_invite', 'supplier_invite'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action or action not allowed yet' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!target_id) {
      return new Response(JSON.stringify({ error: 'Missing target_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    let toEmail = '';
    let toName = '';
    let subject = '';
    let htmlContent = '';
    let textContent = '';

    // FLUXO: CONVITE DE OPERADOR
    if (action === 'operator_invite') {
      const { data: invite, error: fetchError } = await supabase
        .from('operator_invitations')
        .select('*')
        .eq('token', target_id)
        .single();

      if (fetchError || !invite) {
        return new Response(JSON.stringify({ error: 'Convite não encontrado ou RLS bloqueou o acesso' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      toEmail = invite.email;
      toName = invite.nome || 'Operador';
      subject = 'Convite para ingressar na SupplyHUB';
      const link = `${publicUrl}/aceitar-convite?token=${invite.token}`;

      const isApp = invite.cargo?.includes('[APP]');
      const welcomeText = isApp 
        ? 'Você foi convidado para acessar o SupplyHub como usuário de campo.'
        : 'Você foi convidado para acessar o SupplyHub como usuário de compras no Desktop.';
      
      const instructionsText = isApp
        ? 'Para concluir o cadastro, aceite o convite e defina sua senha pelo celular.'
        : 'Para concluir o cadastro, aceite o convite e defina sua senha.';

      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Bem-vindo à SupplyHUB!</h2>
          <p>Olá <strong>${toName}</strong>,</p>
          <p>${welcomeText}</p>
          <p>${instructionsText}</p>
          <p>Clique no botão abaixo para acessar:</p>
          <p>
            <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 16px;">Aceitar Convite</a>
          </p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
            <p>Se o botão não abrir no celular, acesse o link abaixo no navegador:</p>
            <p style="word-break: break-all;"><a href="${link}" style="color: #4F46E5;">${link}</a></p>
            
            <p style="margin-top: 20px;">Se o cliente de e-mail alterar o link, acesse:</p>
            <p style="word-break: break-all;"><a href="${publicUrl}/aceitar-convite" style="color: #4F46E5;">${publicUrl}/aceitar-convite</a></p>
            <p>E cole o código do convite abaixo.</p>
            
            <p style="margin-bottom: 4px; font-weight: bold; color: #333;">Código do convite:</p>
            <div style="font-family: monospace; font-size: 16px; letter-spacing: 0.5px; background: #f4f6f8; padding: 12px; border-radius: 8px; word-break: break-all; text-align: center; color: #333;">
              ${invite.token}
            </div>
          </div>

          <p style="margin-top: 30px; font-size: 12px; color: #999;">Este convite expira em 72 horas.</p>
        </div>
      `;
      textContent = `Olá ${toName},\n\n${welcomeText}\n${instructionsText}\n\nClique no botão ou copie e cole este link no navegador:\n${link}\n\nCódigo do convite:\n${invite.token}\n\nEste convite expira em 72 horas.`;
    }

    // FLUXO: CONVITE DE FORNECEDOR/EMPRESA
    if (action === 'supplier_invite') {
      const { data: invite, error: fetchError } = await supabase
        .from('invitations')
        .select('*')
        .eq('token_hash', target_id)
        .single();

      if (fetchError || !invite) {
        return new Response(JSON.stringify({ error: 'Convite de empresa não encontrado ou RLS bloqueou o acesso' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      toEmail = invite.email;
      toName = invite.name || invite.company;
      subject = 'Convite para conectar na SupplyHUB';
      // Aqui assumimos que o token é o próprio hash/token gerado no frontend (salvo em token_hash ou similar, se for token puro)
      const link = `${publicUrl}/fornecedor/aceite?token=${invite.token_hash}`;

      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Sua empresa foi convidada para a Rede SupplyHUB</h2>
          <p>Olá <strong>${toName}</strong>,</p>
          <p>Uma empresa deseja conectar-se a você (<strong>${invite.company}</strong>) através da plataforma SupplyHUB.</p>
          <p>Para se cadastrar gratuitamente e responder a cotações, clique no botão abaixo:</p>
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 16px;">Conectar à Rede</a>
        </div>
      `;
      textContent = `Olá ${toName},\n\nSua empresa foi convidada para a Rede SupplyHUB.\nAcesse: ${link}`;
    }

    // Disparar Mailtrap
    const mailtrapUrl = 'https://send.api.mailtrap.io/api/send';
    const payload = {
      from: { email: fromEmail, name: fromName },
      to: [{ email: toEmail, name: toName }],
      subject: subject,
      html: htmlContent,
      text: textContent,
      category: action
    };

    const response = await fetch(mailtrapUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mailtrapToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    if (!response.ok) {
      // Falha no Mailtrap (Logar e retornar erro claro)
      console.error('[Mailtrap] Send failed', {
        status: response.status,
        body: responseData,
        action,
        to: toEmail,
        hasQrCode: false
      });
      return new Response(JSON.stringify({ 
        error: 'Mailtrap send failed', 
        status: response.status, 
        detail: responseData?.errors || responseData?.message || 'Erro desconhecido da Mailtrap'
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Se tudo deu certo, retorna HTTP 200 pro Frontend
    return new Response(JSON.stringify({
      success: true,
      message: 'Email successfully sent',
      data: responseData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err: any) {
    console.error('Send Email Backend Error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
