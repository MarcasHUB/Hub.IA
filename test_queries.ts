import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
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
    console.log('Success NetworkPage');
  }

  const res2 = await supabase
    .from('organizations')
    .select('*, operators(id, status)')
    .limit(1);
    
  if (res2.error) {
    console.error('Error Admin:', res2.error.message, res2.error.details, res2.error.hint);
  } else {
    console.log('Success Admin');
  }
}

test();
