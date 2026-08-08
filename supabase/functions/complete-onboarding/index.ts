// ============================================================
// SupplyHub.IA — Edge Function: complete-onboarding
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let createdUserId: string | null = null;
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const body = await req.json();
    const {
      token,
      password,
      fullName,
      role,
      orgTradeName,
      city,
      state,
      website,
      segments
    } = body;

    // 1. Validate request
    if (!token) {
      return new Response(
        JSON.stringify({ code: 'ONBOARDING_TOKEN_REQUIRED', message: 'O token é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!fullName || !fullName.trim()) {
      return new Response(
        JSON.stringify({ code: 'ONBOARDING_FULL_NAME_REQUIRED', message: 'O nome completo é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ code: 'ONBOARDING_PASSWORD_INVALID', message: 'A senha não atende aos requisitos mínimos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(segments)) {
      return new Response(
        JSON.stringify({ code: 'ONBOARDING_SEGMENTS_INVALID', message: 'Segmentos inválidos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validate token (Source of Truth)
    const { data: inviteData, error: inviteGetError } = await supabaseAdmin
      .rpc('validate_company_invite', { p_token: token });

    if (inviteGetError || !inviteData || inviteData.length === 0) {
      return new Response(
        JSON.stringify({ code: 'ONBOARDING_INTERNAL_ERROR', message: 'Falha ao acessar convite.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invite = inviteData[0];

    // Exigir validation_status === 'valid'
    if (invite.validation_status !== 'valid') {
      let code = 'ONBOARDING_INVITE_INVALID';
      if (invite.validation_status === 'expired') code = 'ONBOARDING_INVITE_EXPIRED';
      if (invite.validation_status === 'already_used') code = 'ONBOARDING_INVITE_ALREADY_USED';
      
      return new Response(
        JSON.stringify({ code, message: 'O convite é inválido ou já foi utilizado.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair email rigidamente do convite
    const email = invite.email;
    if (!email) {
      return new Response(
        JSON.stringify({ code: 'ONBOARDING_INVITE_INVALID', message: 'Convite sem e-mail associado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CNPJ obrigatório do convite (não permite fallback do frontend)
    const document = invite.document;
    if (!document) {
      return new Response(
        JSON.stringify({ code: 'ONBOARDING_INVITE_INVALID', message: 'Convite sem CNPJ/Documento associado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Create Auth User
    const { data: userCreatedData, error: userCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (userCreateError) {
      const authErrorCode = 'code' in userCreateError ? (userCreateError as any).code : undefined;
      const normalizedMessage = userCreateError.message?.toLowerCase() || '';

      const isAlreadyRegistered =
        authErrorCode === 'email_exists' ||
        authErrorCode === 'user_already_exists' ||
        normalizedMessage.includes('already registered') ||
        normalizedMessage.includes('already exists');
      
      if (isAlreadyRegistered) {
        return new Response(
          JSON.stringify({ code: 'ONBOARDING_AUTH_USER_EXISTS', message: 'Usuário já existe.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ code: 'ONBOARDING_AUTH_CREATE_FAILED', message: 'Falha ao criar o usuário.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userCreatedData || !userCreatedData.user) {
      return new Response(
        JSON.stringify({ code: 'ONBOARDING_INTERNAL_ERROR', message: 'Falha ao recuperar ID do usuário criado.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Só atribui após sucesso
    createdUserId = userCreatedData.user.id;

    console.log('[AUTH_USER_CREATED]', {
      userId: createdUserId,
      email: email,
      emailConfirmedAt: userCreatedData.user?.email_confirmed_at ?? null,
    });

    console.log('[AUTH_CONFIRM_GATE_START]', {
      userId: createdUserId,
      email: email
    });

    // Helper interno para compensação
    const rollbackCreatedUser = async (userId: string) => {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error('[complete-onboarding] ONBOARDING_AUTH_ROLLBACK_FAILED! Não foi possível remover usuário recém criado. ID:', userId, 'Erro:', deleteError.message || deleteError.code || 'Desconhecido');
      }
    };

    // 4. Confirmação Administrativa Explícita OBRIGATÓRIA
    // O Supabase GoTrue pode retornar email_confirmed_at preenchido no createUser de forma otimista,
    // mas não efetivar no banco dependendo do estado do Confirm Email. 
    // Por isso, executamos a confirmação administrativamente e incondicionalmente.
    const { data: confirmedUser, error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(createdUserId, {
      email_confirm: true
    });

    console.log('[AUTH_CONFIRM_GATE_RESULT]', {
      userId: confirmedUser?.user?.id,
      emailConfirmedAt: confirmedUser?.user?.email_confirmed_at ?? null,
      hasError: Boolean(confirmError),
    });

    if (confirmError) {
      console.error('[AUDIT] Falha no updateUserById:', confirmError.message || confirmError.code || 'Desconhecido');
      await rollbackCreatedUser(createdUserId);
      createdUserId = null;
      return new Response(
        JSON.stringify({ code: 'ONBOARDING_AUTH_CONFIRM_FAILED', message: 'Falha ao confirmar o email do usuário administrativamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. READ-AFTER-WRITE OBRIGATÓRIO (A FONTE FINAL DA VERDADE)
    const { data: readback, error: readbackError } = await supabaseAdmin.auth.admin.getUserById(createdUserId);

    console.log('[AUTH_CONFIRM_READBACK]', {
      userId: readback?.user?.id,
      email: readback?.user?.email,
      emailConfirmedAt: readback?.user?.email_confirmed_at ?? null,
    });

    if (
      readbackError ||
      !readback?.user ||
      readback.user.id !== createdUserId ||
      readback.user.email?.toLowerCase() !== email.toLowerCase() ||
      !readback.user.email_confirmed_at
    ) {
      console.error('[AUDIT] Validação falhou no read-after-write. UID, Email ou Confirmação inválidos.');
      await rollbackCreatedUser(createdUserId);
      createdUserId = null;
      return new Response(
        JSON.stringify({ code: 'ONBOARDING_AUTH_CONFIRM_FAILED', message: 'Falha ao verificar confirmação da conta.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Run complete_onboarding RPC
    let mappedRole = 'admin';
    if (role === 'Comercial') mappedRole = 'manager';
    if (role === 'Engenharia') mappedRole = 'buyer';

    const { error: rpcError } = await supabaseAdmin.rpc('complete_onboarding', {
      p_token: token,
      p_auth_id: createdUserId,
      p_email: email,
      p_full_name: fullName,
      p_role: mappedRole,
      p_org_name: orgTradeName || invite.company,
      p_org_trade_name: orgTradeName || invite.company,
      p_org_document: document,
      p_org_city: city,
      p_org_state: state,
      p_org_website: website || null,
      p_segments: segments
    });

    if (rpcError) {
      throw rpcError;
    }

    // 8. Return full success!
    return new Response(
      JSON.stringify({ code: 'SUCCESS', message: 'Onboarding concluído.', data: { userId: createdUserId } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    // COMPENSAÇÃO GLOBAL
    if (createdUserId) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      if (deleteError) {
        console.error('[complete-onboarding] ONBOARDING_AUTH_ROLLBACK_FAILED! Não foi possível remover usuário recém criado. ID:', createdUserId, 'Erro:', deleteError.message || deleteError.code || 'Desconhecido');
      }
    }

    // Identificar erro
    const msg = error.message || '';
    
    // Tratamento de falha de provisionamento RPC
    if (error.code || (msg && msg.includes('ONBOARDING_'))) {
      console.error('[complete-onboarding] provision_failed', {
        userId: createdUserId,
        code: error.code || 'UNKNOWN',
        message: msg
      });

      // Whitelist de erros de domínio
      const knownErrors = [
        'ONBOARDING_SEGMENT_NOT_FOUND',
        'ONBOARDING_SEGMENT_AMBIGUOUS',
        'ONBOARDING_INVITE_INVALID',
        'ONBOARDING_INVITE_EXPIRED',
        'ONBOARDING_REQUIRED_DATA_MISSING'
      ];

      const foundKnownError = knownErrors.find(k => msg.includes(k));
      if (foundKnownError) {
        return new Response(
          JSON.stringify({ code: foundKnownError, message: 'Falha de validação do convite.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ code: 'ONBOARDING_PROVISION_FAILED', message: 'Não foi possível concluir seu cadastro. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tratamento de falha interna. Request body/password não é logado.
    console.error('[complete-onboarding] Erro fatal:', msg || 'Desconhecido');
    
    return new Response(
      JSON.stringify({ code: 'ONBOARDING_INTERNAL_ERROR', message: 'Erro interno.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
