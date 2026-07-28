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
// Use the service role key if available to run raw SQL, or just query standard REST endpoint
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'] || supabaseKey;
const supabase = createClient(supabaseUrl, serviceKey);

async function test() {
  // Let's try to fetch just from empresa_certificacoes directly to see if the table exists
  const res = await supabase.from('empresa_certificacoes').select('*').limit(1);
  if (res.error) {
    console.error('Table empresa_certificacoes error:', res.error);
  } else {
    console.log('Table empresa_certificacoes exists! Rows:', res.data.length);
  }
}

test();
