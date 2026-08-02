import * as dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const envContent = readFileSync(join(process.cwd(), '.env'), 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
}

async function fetchSchema() {
  console.log('Fetching schema...');
  const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
  const json = await res.json();
  
  if (!json.definitions) {
      console.log('No definitions found in JSON response:', Object.keys(json));
      return;
  }
  
  const output: any = {};
  for (const table of ['organizations', 'categories', 'operators', 'user_roles', 'profiles', 'users']) {
      if (json.definitions[table]) {
          output[table] = Object.keys(json.definitions[table].properties);
      } else {
          output[table] = 'NOT FOUND';
      }
  }
  
  writeFileSync('schema_info.json', JSON.stringify(output, null, 2));
  console.log('Schema info saved to schema_info.json');
}

fetchSchema().catch(console.error);
