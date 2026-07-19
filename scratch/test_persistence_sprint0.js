import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve('E:/SupplyHUB/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- TESTE DE PERSISTÊNCIA (SPRINT 0) ---');
  
  // Como estamos testando bypass RLS para validar banco real vazio e fluxos, precisamos de algo com poder (se possível) ou testar a resposta do anon
  // Porém, a instrução 0.5 diz: "Não concluir ausência de dados usando conexão anônima quando houver RLS"
  console.log('Validando acesso anônimo à tabela organizations:');
  const { data: orgs, error: orgError } = await supabase.from('organizations').select('*');
  console.log('Organizations fetch error:', orgError?.message || 'None');
  console.log('Organizations data count:', orgs?.length || 0);

  console.log('Validando acesso anônimo à tabela products:');
  const { data: prods, error: prodError } = await supabase.from('products').select('*');
  console.log('Products fetch error:', prodError?.message || 'None');
  console.log('Products data count:', prods?.length || 0);
}

run().catch(console.error);
