import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const orgId = '00000000-0000-0000-0000-000000000000';
  console.log('Verificando se a organização padrão existe...');
  const { data: existing, error: fetchError } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', orgId);

  if (fetchError) {
    console.error('Erro ao consultar:', fetchError);
    return;
  }

  if (existing && existing.length > 0) {
    console.log('Organização padrão já existe!');
    return;
  }

  console.log('Inserindo organização padrão...');
  const { data, error } = await supabase
    .from('organizations')
    .insert({
      id: orgId,
      name: 'SupplyHub B2B',
      created_at: new Date().toISOString()
    })
    .select();

  if (error) {
    console.error('Erro ao inserir:', error);
  } else {
    console.log('Organização padrão inserida com sucesso:', data);
  }
}

run();
