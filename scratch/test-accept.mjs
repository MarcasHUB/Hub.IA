// Script de diagnostico exclusivamente local. Nao executar contra projeto remoto.
import { createClient } from '@supabase/supabase-js';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variavel local obrigatoria ausente: ${name}`);
  return value;
};

const supabaseUrl = required('LOCAL_SUPABASE_URL');
const parsedUrl = new URL(supabaseUrl);
if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname)) {
  throw new Error('Este script aceita apenas uma URL Supabase local.');
}

const supabase = createClient(supabaseUrl, required('LOCAL_SUPABASE_ANON_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.functions.invoke('accept-invite', {
  body: {
    token: required('LOCAL_TEST_INVITE_TOKEN'),
    password: required('LOCAL_TEST_PASSWORD'),
  },
});

if (error) throw new Error('Falha no aceite local do convite.');
console.log({ success: Boolean(data?.success) });
