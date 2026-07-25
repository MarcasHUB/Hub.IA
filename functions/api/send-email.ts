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

    // Função auxiliar para evitar barra dupla no link
    function joinUrl(baseUrl: string, path: string) {
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const cleanPath = path.replace(/^\/+/, '');
      return `${cleanBase}/${cleanPath}`;
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
      const link = joinUrl(publicUrl, `aceitar-convite?token=${invite.token}`);
      const manualUrl = joinUrl(publicUrl, 'aceitar-convite');

      const c = invite.cargo || '';
      let roleName = 'Comprador';
      let mobile = true;
      let desktop = true;
      let perms: string[] = [];
      let rests: string[] = [];

      if (c.includes('[APP] Solicitante')) {
        roleName = 'Solicitante';
        mobile = true; desktop = false;
        perms = ['Criar solicitações.', 'Consultar andamento das solicitações.', 'Acompanhar aprovações.'];
        rests = ['Não aprova solicitações.', 'Não realiza compras.', 'Não acessa módulos administrativos.'];
      } else if (c.includes('[DESKTOP] Auditor')) {
        roleName = 'Auditor';
        mobile = false; desktop = true;
        perms = ['Consultar processos.', 'Consultar históricos.', 'Consultar aprovações.', 'Consulta de processos encerrados.'];
        rests = ['Não aprova.', 'Não compra.', 'Não cria solicitações.', 'Não altera registros.'];
      } else if (c.includes('[DESKTOP] Gestor') || invite.perfil === 'gestor') {
        roleName = 'Gestor';
        perms = ['Aprovar solicitações.', 'Aprovar valores conforme política.', 'Acompanhar solicitações da equipe.', 'Delegar aprovações quando permitido.'];
      } else if (c.includes('[DESKTOP] Administrador') || invite.perfil === 'administrador') {
        roleName = 'Administrador';
        perms = ['Administração do sistema.', 'Gestão de usuários.', 'Configurações gerais.', 'Gestão operacional completa.'];
      } else {
        roleName = 'Comprador';
        perms = ['Receber solicitações.', 'Realizar cotações.', 'Comparar fornecedores.', 'Emitir orçamentos.', 'Conduzir processos de compra.', 'Acompanhar negociações.'];
      }

      const accessChannelsHTML = `
        <ul style="list-style: none; padding-left: 0; margin-top: 4px;">
          <li style="margin-bottom: 4px;">${mobile ? '✅' : '❌'} Aplicativo Mobile</li>
          <li>${desktop ? '✅' : '❌'} Portal Desktop/Web</li>
        </ul>
      `;

      const permsHTML = `
        <ul style="padding-left: 20px; margin-top: 4px; color: #444;">
          ${perms.map(p => `<li>${p}</li>`).join('')}
        </ul>
      `;
      
      const restsHTML = rests.length > 0 ? `
        <h4 style="margin-top: 16px; margin-bottom: 0; color: #d32f2f;">Restrições</h4>
        <ul style="padding-left: 20px; margin-top: 4px; color: #666;">
          ${rests.map(r => `<li>${r}</li>`).join('')}
        </ul>
      ` : '';

      const infoBlockHTML = `
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 24px; margin-bottom: 24px;">
          <h3 style="margin-top: 0; color: #111827; margin-bottom: 4px;">Perfil Liberado</h3>
          <p style="margin-top: 0; font-size: 16px; font-weight: bold; color: #4F46E5;">${roleName}</p>
          
          <h4 style="margin-top: 16px; margin-bottom: 0; color: #374151;">Acessos Disponíveis</h4>
          ${accessChannelsHTML}
          
          <h4 style="margin-top: 16px; margin-bottom: 0; color: #374151;">Permissões</h4>
          ${permsHTML}
          
          ${restsHTML}
        </div>
      `;

      const infoBlockText = `\nPerfil Liberado: ${roleName}\nAcessos Disponíveis:\n${mobile ? '✅' : '❌'} Aplicativo Mobile\n${desktop ? '✅' : '❌'} Portal Desktop/Web\n\nPermissões:\n${perms.map(p => `- ${p}`).join('\n')}${rests.length > 0 ? `\n\nRestrições:\n${rests.map(r => `- ${r}`).join('\n')}` : ''}\n`;

      const welcomeText = 'Você foi convidado para acessar a plataforma.';

      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Bem-vindo à SupplyHUB!</h2>
          <p>Olá <strong>${toName}</strong>,</p>
          <p>${welcomeText}</p>
          
          ${infoBlockHTML}

          <p>Clique no botão abaixo para concluir seu cadastro:</p>
          <p>
            <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 8px;">Aceitar Convite</a>
          </p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
            <p>Se o botão não abrir no celular, acesse o link abaixo no navegador:</p>
            <p style="word-break: break-all;"><a href="${link}" style="color: #4F46E5;">${link}</a></p>
            
            <p style="margin-top: 20px;">Se o cliente de e-mail alterar o link, acesse:</p>
            <p style="word-break: break-all;"><a href="${manualUrl}" style="color: #4F46E5;">${manualUrl}</a></p>
            <p>E cole o código do convite abaixo.</p>
            
            <p style="margin-bottom: 4px; font-weight: bold; color: #333;">Código do convite:</p>
            <div style="font-family: monospace; font-size: 16px; letter-spacing: 0.5px; background: #f4f6f8; padding: 12px; border-radius: 8px; word-break: break-all; text-align: center; color: #333;">
              ${invite.token}
            </div>
          </div>

          <p style="margin-top: 30px; font-size: 12px; color: #999;">Este convite expira em 72 horas.</p>
        </div>
      `;
      textContent = `Olá ${toName},\n\n${welcomeText}\n${infoBlockText}\nClique no botão ou copie e cole este link no navegador para concluir seu cadastro:\n${link}\n\nCódigo do convite:\n${invite.token}\n\nEste convite expira em 72 horas.`;
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
      toName = invite.contact_name || invite.name || invite.company;
      subject = 'Sua empresa foi convidada para fazer parte da Rede Hub.IA de Suprimentos';
      
      const link = joinUrl(publicUrl, `onboarding?token=${invite.token_hash}`);

      const inviterName = user?.user_metadata?.nome 
        ? `${user.user_metadata.nome} ${user.user_metadata.sobrenome || ''}`.trim() 
        : 'Usuário do Sistema';
      const inviterEmail = user?.email || 'contato@hub.ia';
      
      let inviterCompany = 'Rede Hub.IA';
      if (invite.organization_id) {
         const { data: org } = await supabase.from('organizations').select('name').eq('id', invite.organization_id).maybeSingle();
         if (org && org.name) inviterCompany = org.name;
      }

      const messageBlock = invite.message ? `
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #166534; font-style: italic;">"${invite.message}"</p>
          </div>
      ` : '';

      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.5;">
          <h2 style="color: #111827;">Bem-vindo à Rede Hub.IA</h2>
          <p>Olá <strong>${toName}</strong>,</p>
          <p>Sua empresa foi convidada para participar da <strong>Rede Hub.IA de Suprimentos</strong>.</p>
          <p>A Hub.IA conecta empresas compradoras e fornecedoras em um ambiente único para geração de negócios, cotações, parcerias estratégicas e oportunidades comerciais.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #4F46E5; padding: 16px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase;">Convite enviado por:</p>
            <p style="margin: 0 0 4px 0;"><strong>Empresa:</strong> ${inviterCompany}</p>
            <p style="margin: 0 0 4px 0;"><strong>Contato:</strong> ${inviterName}</p>
            <p style="margin: 0;"><strong>E-mail:</strong> ${inviterEmail}</p>
          </div>

          ${messageBlock}

          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <h3 style="margin-top: 0; color: #111827; font-size: 16px;">Dados da Empresa</h3>
            <p style="margin: 8px 0 0 0;"><strong>Razão Social:</strong> ${invite.company}</p>
            <p style="margin: 4px 0 0 0;"><strong>CNPJ:</strong> ${invite.document}</p>
            ${invite.city && invite.state ? `<p style="margin: 4px 0 0 0;"><strong>Localização:</strong> ${invite.city}/${invite.state}</p>` : ''}
          </div>

          <p style="font-weight: bold; margin-bottom: 8px;">Próximo passo</p>
          <p style="margin-top: 0;">Clique abaixo para acessar a plataforma e concluir seu cadastro.</p>
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 8px;">Acessar Plataforma</a>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
            <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
            <p style="word-break: break-all;"><a href="${link}" style="color: #4F46E5;">${link}</a></p>
            <p style="margin-top: 16px;">Este convite expira em 7 dias.</p>
          </div>
        </div>
      `;
      
      textContent = `Olá ${toName},\n\nBem-vindo à Rede Hub.IA\n\nSua empresa foi convidada para participar da Rede Hub.IA de Suprimentos.\nA Hub.IA conecta empresas compradoras e fornecedoras em um ambiente único para geração de negócios, cotações, parcerias estratégicas e oportunidades comerciais.\n\nDados da Empresa:\nRazão Social: ${invite.company}\nCNPJ: ${invite.document}\n\nPróximo passo:\nClique no link abaixo para acessar a plataforma e concluir seu cadastro:\n${link}\n\nEste convite expira em 7 dias.`;
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
