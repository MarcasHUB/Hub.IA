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
  // Let's try select('id') to see if 'id' exists
  const { data: d1, error: e1 } = await supabase.from('products').select('id').limit(1);
  if (e1) {
    console.error('Select id error:', e1.message);
  } else {
    console.log('Select id success!', d1);
  }

  // Let's fetch postgrest schema info using fetch
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const schema = await res.json();
    console.log('Available tables in schema:', Object.keys(schema.paths));
    if (schema.definitions && schema.definitions.products) {
      console.log('Products columns:', Object.keys(schema.definitions.products.properties));
    } else {
      console.log('Products definition not found in OpenAPI schema');
    }
  } catch (err) {
    console.error('Error fetching schema:', err);
  }
}

run();
