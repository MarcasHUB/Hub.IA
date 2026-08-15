const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.LOCAL_SUPABASE_ANON_KEY;
const outputPath = path.resolve(process.env.LOCAL_AUDIT_OUTPUT_PATH || '');

if (!supabaseKey) throw new Error('LOCAL_SUPABASE_ANON_KEY is required.');
if (!['127.0.0.1', 'localhost'].includes(new URL(supabaseUrl).hostname)) {
  throw new Error('Only a local Supabase URL is accepted.');
}
if (!process.env.LOCAL_AUDIT_OUTPUT_PATH || outputPath.startsWith(path.resolve(process.cwd()) + path.sep)) {
  throw new Error('LOCAL_AUDIT_OUTPUT_PATH must point outside the repository.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const data = {};
  for (const table of [
    'organizations', 'companies', 'profiles', 'operators',
    'products', 'materials', 'organization_materials',
  ]) {
    const { data: rows, error } = await supabase.from(table).select('*');
    if (error) throw new Error(`Local audit failed for ${table}.`);
    data[table] = rows || [];
  }
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log('Local audit completed.');
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
