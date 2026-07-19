export async function onRequestGet(context: any) {
  const { env } = context;
  
  const token = env.MAILTRAP_API_TOKEN;
  const fromEmail = env.MAILTRAP_FROM_EMAIL;
  const fromName = env.MAILTRAP_FROM_NAME;
  const publicUrl = env.APP_PUBLIC_URL;
  const mode = env.MAILTRAP_MODE || 'sandbox'; // opcional

  // Não retornamos segredos, apenas a confirmação da presença das envs.
  return new Response(JSON.stringify({
    health: 'ok',
    mailtrapTokenPresent: !!token,
    fromEmailPresent: !!fromEmail,
    fromNamePresent: !!fromName,
    publicUrlPresent: !!publicUrl,
    mode,
    senderDomain: fromEmail ? fromEmail.split('@')[1] : null,
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
