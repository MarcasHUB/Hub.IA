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

  try {
    const { token: inputToken } = await req.json();
    const token = String(inputToken ?? '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: 'OPERATOR_INVITE_INVALID' }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const tokenHash = await sha256(token);

    const { data: invite, error } = await admin
      .from('operator_invitations')
      .select('email, nome, cargo, perfil, status, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error || !invite) return json({ error: 'OPERATOR_INVITE_NOT_FOUND' }, 404);

    const expired = new Date(invite.expires_at).getTime() <= Date.now();
    return json({
      success: true,
      data: {
        email: invite.email,
        nome: invite.nome,
        cargo: invite.cargo,
        perfil: invite.perfil,
        status: expired ? 'expirado' : invite.status,
        expires_at: invite.expires_at,
      },
    });
  } catch (error) {
    console.error('[validate-operator-invite] request_failed', error instanceof Error ? error.message : 'UNKNOWN');
    return json({ error: 'OPERATOR_INVITE_INTERNAL_ERROR' }, 500);
  }
});
