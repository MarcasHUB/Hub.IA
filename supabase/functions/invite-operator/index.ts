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

const generateToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'SERVER_NOT_CONFIGURED' }, 500);

  const authorization = req.headers.get('Authorization') ?? '';
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return json({ error: 'AUTH_REQUIRED' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken);
  if (callerError || !callerData.user) return json({ error: 'AUTH_INVALID' }, 401);

  try {
    const body = await req.json();
    const action = body.action === 'resend' ? 'resend' : 'invite';
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email) return json({ error: 'OPERATOR_EMAIL_REQUIRED' }, 400);

    const rawToken = generateToken();
    const tokenHash = await sha256(rawToken);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    if (action === 'resend') {
      const { error } = await admin.rpc('rotate_operator_invitation_token', {
        p_caller_id: callerData.user.id,
        p_email: email,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
      });

      if (error) return json({ error: 'OPERATOR_INVITE_UNAVAILABLE' }, 400);
      return json({ success: true, message: 'Convite renovado.', token: rawToken, expires_at: expiresAt });
    }

    const nome = String(body.nome ?? '').trim();
    const sobrenome = String(body.sobrenome ?? '').trim();
    const perfil = String(body.perfil ?? '').trim();
    const allowedProfiles = new Set(['administrador', 'gestor', 'comprador', 'solicitante', 'auditor']);

    if (!nome || !allowedProfiles.has(perfil)) {
      return json({ error: 'OPERATOR_INVITE_INVALID' }, 400);
    }

    const { data: resolvedUserId, error: resolutionError } = await admin.rpc(
      'resolve_operator_invitation_identity',
      { p_caller_id: callerData.user.id, p_email: email },
    );
    if (resolutionError) return json({ error: 'OPERATOR_INVITE_UNAVAILABLE' }, 400);

    let userId = resolvedUserId ?? null;
    let createdUserId: string | null = null;

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: false,
        user_metadata: { full_name: `${nome} ${sobrenome}`.trim() },
      });

      if (createError || !created.user) {
        return json({ error: 'OPERATOR_INVITE_UNAVAILABLE' }, 400);
      }

      userId = created.user.id;
      createdUserId = created.user.id;
    }

    const { error: invitationError } = await admin.rpc('create_operator_invitation_transactional', {
      p_caller_id: callerData.user.id,
      p_user_id: userId,
      p_email: email,
      p_nome: nome,
      p_sobrenome: sobrenome,
      p_telefone: body.telefone || null,
      p_cargo: body.cargo || null,
      p_perfil: perfil,
      p_gestor_id: body.gestor_id || null,
      p_category_ids: Array.isArray(body.category_ids) ? body.category_ids : [],
      p_todas_categorias: Boolean(body.todas_categorias),
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
    });

    if (invitationError) {
      if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
      return json({ error: 'OPERATOR_INVITE_UNAVAILABLE' }, 400);
    }

    return json({
      success: true,
      message: 'Convite processado com sucesso.',
      user: { id: userId, email },
      token: rawToken,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error('[invite-operator] request_failed', error instanceof Error ? error.message : 'UNKNOWN');
    return json({ error: 'OPERATOR_INVITE_INTERNAL_ERROR' }, 500);
  }
});
