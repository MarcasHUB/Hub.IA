import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Parse .env
const envFile = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'] || '';
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('--- TEST 1: NetworkPage ---');
  const { data, error } = await supabase
    .from('organizations')
    .select(`
      id, name, razao_social, nome_fantasia, cnpj, city, state, country,
      logo_url, website, description, segment, business_email, email_corporativo,
      phone, telefone, whatsapp, business_model, perfil_comercial, tipo_empresa, raio_atendimento_km,
      profile_completion, created_at, status,
      empresa_certificacoes(certifications(name))
    `)
    .limit(1);

  if (error) {
    console.error('Error NetworkPage:', error.message, error.details, error.hint);
  } else {
    console.log('Success NetworkPage, count:', data?.length);
  }

  console.log('\n--- TEST 2: Admin Global ---');
  const res2 = await supabase
    .from('organizations')
    .select('*, operators(id, status)')
    .limit(1);
    
  if (res2.error) {
    console.error('Error Admin:', res2.error.message, res2.error.details, res2.error.hint);
  } else {
    console.log('Success Admin, count:', res2.data?.length);
  }

  console.log('\n--- TEST 3: Minha Empresa ---');
  const res3 = await supabase
    .from('organizations')
    .select(`
      *,
      empresa_certificacoes(certifications(name)),
      empresa_cnaes(cnae_code),
      empresa_estados_atendidos(state_code),
      organization_segments(segments(nome))
    `)
    .limit(1);

  if (res3.error) {
    console.error('Error MinhaEmpresa:', res3.error.message, res3.error.details, res3.error.hint);
  } else {
    console.log('Success MinhaEmpresa, count:', res3.data?.length);
  }
}

test();
