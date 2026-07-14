// ============================================================
// SupplyHub.IA — Edge Function: accept-invite
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = await req.json();
    const { token, password, ip, user_agent } = body;

    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: 'Token e password são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Validar e obter o convite na tabela operator_invitations
    const { data: invite, error: inviteGetError } = await supabase
      .from('operator_invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pendente')
      .single();

    if (inviteGetError || !invite) {
      return new Response(
        JSON.stringify({ error: 'Convite inválido, já aceito ou expirado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar expiração
    if (new Date(invite.expires_at) < new Date()) {
      await supabase
        .from('operator_invitations')
        .update({ status: 'expirado' })
        .eq('id', invite.id);

      return new Response(
        JSON.stringify({ error: 'Este convite expirou.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Encontrar o ID do usuário correspondente na tabela operators por email
    const { data: opData, error: opGetError } = await supabase
      .from('operators')
      .select('id')
      .eq('email', invite.email)
      .single();

    if (opGetError || !opData) {
      return new Response(
        JSON.stringify({ error: 'Operador não encontrado na base de dados.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = opData.id;

    // 3. Atualizar a senha do usuário usando a API administrativa
    const { error: passUpdateError } = await supabase.auth.admin.updateUserById(userId, {
      password: password,
      email_confirm: true, // Garante que o e-mail está confirmado
    });

    if (passUpdateError) {
      throw passUpdateError;
    }

    const now = new Date().toISOString();

    // 4. Atualizar o operador na tabela operators para status = 'ativo'
    const { error: operatorUpdateError } = await supabase
      .from('operators')
      .update({
        status: 'ativo',
        accepted_at: now,
        updated_at: now,
      })
      .eq('id', userId);

    if (operatorUpdateError) {
      throw operatorUpdateError;
    }

    // 5. Atualizar o convite na tabela operator_invitations
    const { error: inviteUpdateError } = await supabase
      .from('operator_invitations')
      .update({
        status: 'aceito',
        accepted_at: now,
        ip_aceite: ip || null,
        user_agent_aceite: user_agent || null,
      })
      .eq('id', invite.id);

    if (inviteUpdateError) {
      throw inviteUpdateError;
    }

    // 6. Registrar log operacional do aceite do convite
    await supabase.from('operation_logs').insert({
      operator_id: userId,
      organization_id: invite.organization_id,
      entidade: 'operator_invitation',
      acao: 'aceitou',
      payload_depois: { email: invite.email, ip, user_agent }
    });

    // 7. Notificar o gestor responsável enviando sinal Hub.IA
    await supabase.from('hubia_signals').insert({
      organization_id: invite.organization_id,
      operator_id: userId,
      tipo_sinal: 'oportunidade_saving', // Tipo flexível ou podemos mapear um novo
      descricao: `O operador ${invite.nome} aceitou o convite e está ativo no sistema.`,
      dados: { email: invite.email, accepted_at: now }
    });

    // 8. Gerar sinal Hub.IA de novo operador ativo para a inteligência de negócios
    // Nota: Usamos um tipo correspondente do enum
    await supabase.from('hubia_signals').insert({
      organization_id: invite.organization_id,
      operator_id: userId,
      tipo_sinal: 'novo_fornecedor', // Usado provisoriamente ou podemos expandir se necessário, no enum temos novo_fornecedor
      descricao: `Inteligência: Novo perfil operacional ativo (${invite.perfil}) para análises de suprimentos.`,
      dados: { perfil: invite.perfil, email: invite.email }
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Operador ativado com sucesso.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[accept-invite] Erro:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
