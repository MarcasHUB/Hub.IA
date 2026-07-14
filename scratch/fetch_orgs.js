import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Carregar variáveis do .env manualmente sem dotenv
const envPath = path.resolve('e:/SupplyHUB/.env');
const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
const envConfig = {};
lines.forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    envConfig[key] = val;
  }
});

const supabaseUrl = envConfig.VITE_SUPABASE_URL || 'https://zwliwnpxwxxcqshxxmuu.supabase.co';
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl);
console.log('KEY:', supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Buscando organizações do Supabase...');
  const { data, error } = await supabase.from('organizations').select('id, name');
  if (error) {
    console.error('Erro ao buscar:', error);
  } else {
    console.log('Organizações encontradas:', data);
  }
}

check();
