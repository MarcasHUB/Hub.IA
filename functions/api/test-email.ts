export async function onRequestPost(context: any) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { to } = body;

    if (!to) {
      return new Response(JSON.stringify({ error: 'Missing "to" in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const token = env.MAILTRAP_API_TOKEN;
    const fromEmail = env.MAILTRAP_FROM_EMAIL;
    const fromName = env.MAILTRAP_FROM_NAME || 'SupplyHUB';

    if (!token || !fromEmail) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: Mailtrap credentials missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Default Mailtrap Send API for transactional emails
    const mailtrapUrl = 'https://send.api.mailtrap.io/api/send';

    const payload = {
      from: { email: fromEmail, name: fromName },
      to: [{ email: to }],
      subject: 'Teste Mailtrap Hub.IA',
      text: 'Este é um teste de envio da Hub.IA via Cloudflare + Mailtrap usando o domínio supplyhub.ia.br.',
      category: 'Test'
    };

    const response = await fetch(mailtrapUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Mailtrap API error', details: responseData }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Test email dispatched successfully to Mailtrap',
      data: responseData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// OPTIONS responder for CORS
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}
