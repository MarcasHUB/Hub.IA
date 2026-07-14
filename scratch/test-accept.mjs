import { createClient } from '@supabase/supabase-js';

// Precisamos do URL e da ANON_KEY do projeto.
// Eles podem ser extraídos de .env
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envStr = fs.readFileSync(envPath, 'utf-8');
const env = Object.fromEntries(envStr.split('\n').map(line => line.split('=')));

const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Iniciando validação do aceite de convite...');
  const token = '2f02defb-aac6-4850-84b4-ef3e8dedeb84';
  const password = 'SenhaForte123!';

  console.log(`Token: ${token}`);
  console.log('Chamando edge function accept-invite...');

  const response = await fetch(`${supabaseUrl}/functions/v1/accept-invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`
    },
    body: JSON.stringify({
      token,
      password,
      ip: '127.0.0.1',
      user_agent: 'Antigravity Validation Script'
    })
  });
  
  const rawBody = await response.text();
  console.log(`Status: ${response.status}`);
  console.log('Body:', rawBody);
}

run();
