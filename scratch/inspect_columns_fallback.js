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
  const testId = crypto.randomUUID();
  const { data, error } = await supabase.from('products').insert({
    id: testId,
    name: 'TEST_INSERT_MINIMAL',
    sku: 'TEST_MIN_SKU'
  }).select();

  if (error) {
    console.error('Insert error:', error.message, error.code, error.details);
  } else {
    console.log('Insert success!', JSON.stringify(data));
    // Clean up
    const { error: delError } = await supabase.from('products').delete().eq('id', testId);
    console.log('Delete cleanup:', delError ? delError.message : 'success');
  }
}

run();
