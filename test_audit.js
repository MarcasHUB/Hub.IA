import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('E:/SupplyHUB/.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, razao_social, nome_fantasia')
    .or('razao_social.ilike.%Raízen%,razao_social.ilike.%Raizen%,nome_fantasia.ilike.%Raízen%,nome_fantasia.ilike.%Raizen%,razao_social.ilike.%Chaparia%');

  if (error) {
    console.error(error);
  } else {
    console.log("Organizations:");
    console.log(data);
  }

  const { data: conns, error: err2 } = await supabase
    .from('connection_requests')
    .select('*');

  if (err2) {
    console.error(err2);
  } else {
    console.log("Connections:");
    console.log(conns);
  }
}

run();
