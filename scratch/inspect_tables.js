import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: operators, error: e1 } = await supabase.from('operators').select('*');
  console.log('operators error:', e1 ? e1.message : 'none');
  console.log('operators rows:', operators?.length);

  const { data: userRoles, error: e2 } = await supabase.from('user_roles').select('*');
  console.log('user_roles error:', e2 ? e2.message : 'none');
  console.log('user_roles rows:', userRoles?.length);
}

run();
