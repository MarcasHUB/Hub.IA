import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  const email = 'everton.cordebello@raizen.com';
  
  console.log(`\n=== Auditing User: ${email} ===\n`);
  
  // 1. auth.users (if service role key is available)
  // Actually, without service role, we can't query auth.users by email.
  // We'll query profiles by email if it exists there, or just skip auth.users.
  
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', email);
    
  if (pErr) console.error("Error fetching profile:", pErr.message);
  console.log("PROFILES:");
  console.log(JSON.stringify(profiles, null, 2));
  
  if (profiles && profiles.length > 0) {
    const userId = profiles[0].id;
    
    console.log(`\nFetching operators for user_id: ${userId}`);
    const { data: operators, error: oErr } = await supabase
      .from('operators')
      .select('*')
      .eq('user_id', userId);
      
    if (oErr) console.error("Error fetching operators:", oErr.message);
    console.log("OPERATORS:");
    console.log(JSON.stringify(operators, null, 2));
    
    if (operators && operators.length > 0) {
      for (const op of operators) {
         console.log(`\nFetching operator_categories for operator_id: ${op.id}`);
         const { data: opCats, error: ocErr } = await supabase
            .from('operator_categories')
            .select('*')
            .eq('operator_id', op.id);
            
         if (ocErr) console.error("Error fetching operator_categories:", ocErr.message);
         console.log("OPERATOR_CATEGORIES:");
         console.log(JSON.stringify(opCats, null, 2));
      }
    }
  } else {
    console.log("Profile not found by email. Trying operators by email.");
    const { data: ops, error: oErr2 } = await supabase
      .from('operators')
      .select('*')
      .ilike('email', email);
    
    if (oErr2) console.error("Error fetching ops by email:", oErr2.message);
    console.log("OPERATORS by email:");
    console.log(JSON.stringify(ops, null, 2));
  }
}

runAudit();
