import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    if (match[1] === 'VITE_SUPABASE_URL') supabaseUrl = match[2].trim();
    if (match[1] === 'VITE_SUPABASE_ANON_KEY') supabaseKey = match[2].trim();
  }
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, razao_social, status, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching organizations:', error);
  } else {
    console.table(data);
  }
}

run();
