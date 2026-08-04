const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  const email = 'viniciuscordebello@hotmail.com';
  
  console.log('=== AUDITING: ' + email + ' ===');

  const { data: invites, error: invErr } = await supabase
    .from('operator_invitations')
    .select('*')
    .eq('email', email);
  
  if (invErr) console.error('Invites error:', invErr);
  else console.log('Operator Invitations:', JSON.stringify(invites, null, 2));

  // The anon key might not have access to auth.users, profiles, operators without RLS bypass
  // Since we don't have the service role key, we might need to rely on the fact that we can query via RPC if there's one, or just do what we can.
  const { data: operators, error: opErr } = await supabase
    .from('operators')
    .select('*, operator_categories(category_id)')
    .eq('email', email);
    
  if (opErr) console.error('Operators error:', opErr);
  else console.log('Operators:', JSON.stringify(operators, null, 2));
}

runAudit();
