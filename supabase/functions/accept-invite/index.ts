import { createClient } from 'npm:@supabase/supabase-js@2.110.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'SERVER_NOT_CONFIGURED' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json();
    const token = String(body.token ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!/^[0-9a-f]{64}$/.test(token) || password.length < 8) {
      return json({ error: 'OPERATOR_INVITE_INPUT_INVALID' }, 400);
    }

    const tokenHash = await sha256(token);
    const { data: invite, error: inviteError } = await admin
      .from('operator_invitations')
      .select('id, organization_id, email, nome, perfil, status, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteError || !invite || invite.status !== 'pendente') {
      return json({ error: 'OPERATOR_INVITE_INVALID' }, 404);
    }
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      return json({ error: 'OPERATOR_INVITE_EXPIRED' }, 400);
    }

    const { data: operator, error: operatorError } = await admin
      .from('operators')
      .select('id, organization_id, status')
      .eq('organization_id', invite.organization_id)
      .ilike('email', invite.email)
      .maybeSingle();

    if (operatorError || !operator || operator.status !== 'pendente') {
      return json({ error: 'OPERATOR_IDENTITY_INCOMPLETE' }, 409);
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(operator.id, {
      password,
      email_confirm: true,
    });
    if (passwordError) return json({ error: 'OPERATOR_PASSWORD_UPDATE_FAILED' }, 400);

    const requestIp =
      req.headers.get('cf-connecting-ip') ??
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      null;

    const { error: acceptanceError } = await admin.rpc('accept_operator_invitation_transactional', {
      p_token_hash: tokenHash,
      p_user_id: operator.id,
      p_ip: requestIp,
      p_user_agent: req.headers.get('user-agent'),
    });

    if (acceptanceError) {
      await admin.auth.admin.updateUserById(operator.id, {
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: false,
      });
      return json({ error: acceptanceError.message, code: acceptanceError.code }, 409);
    }

    const acceptedAt = new Date().toISOString();
    const { error: signalError } = await admin.from('hubia_signals').insert({
      organization_id: invite.organization_id,
      operator_id: operator.id,
      tipo_sinal: 'convite_pendente',
      descricao: `O operador ${invite.nome} aceitou o convite e está ativo.`,
      dados: { perfil: invite.perfil, accepted_at: acceptedAt },
    });
    if (signalError) console.warn('[accept-invite] signal_failed', signalError.code);

    return json({ success: true, message: 'Operador ativado com sucesso.' });
  } catch (error) {
    console.error('[accept-invite] request_failed', error instanceof Error ? error.message : 'UNKNOWN');
    return json({ error: 'OPERATOR_INVITE_INTERNAL_ERROR' }, 500);
  }
});
