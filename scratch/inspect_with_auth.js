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
  const email = `test_diag_${Date.now()}@supplyhub.com.br`;
  const password = 'SenhaForte123!';
  const orgId = '00000000-0000-0000-0000-000000000000';
  const orgId2 = '68a2f0b2-80f7-4868-bbb9-30b531c12db2';

  console.log('Signing up user:', email);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nome: 'Diagnostic',
        sobrenome: 'Agent'
      }
    }
  });

  if (signUpError) {
    console.error('Sign up error:', signUpError.message);
    return;
  }

  const user = signUpData.user;
  if (!user) {
    console.error('No user returned from sign up.');
    return;
  }

  console.log('Sign up success! User ID:', user.id);

  // Authenticate the client with the user's session
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error('Sign in error:', signInError.message);
    return;
  }

  console.log('Sign in success! Querying with authenticated user...');

  // Ensure default organization exists
  console.log('Inserting default org...');
  await supabase.from('organizations').insert({ id: orgId, name: 'SupplyHub B2B' }).select();
  await supabase.from('organizations').insert({ id: orgId2, name: 'SupplyHub principal' }).select();

  // Insert operator for orgId
  console.log('Inserting operator for orgId...');
  const { error: opError } = await supabase.from('operators').insert({
    id: user.id,
    organization_id: orgId,
    nome: 'Diagnostic',
    sobrenome: 'Agent',
    email: email,
    perfil: 'administrador',
    status: 'ativo'
  });

  if (opError) {
    console.error('Operator insertion error for orgId:', opError.message);
  }

  // Let's query products for orgId
  console.log('=== Querying products for orgId (00000000-0000-0000-0000-000000000000) ===');
  const { data: products1, error: pError1 } = await supabase.from('products').select('*');
  if (pError1) {
    console.error('Error fetching products (org1):', pError1.message);
  } else {
    console.log(`Found ${products1.length} products:`);
    products1.forEach(p => console.log('  -', JSON.stringify(p)));
  }

  // Update operator to orgId2 to inspect other tenant
  console.log('Updating operator to orgId2 (68a2f0b2-80f7-4868-bbb9-30b531c12db2)...');
  const { error: opUpdateError } = await supabase.from('operators').update({
    organization_id: orgId2
  }).eq('id', user.id);

  if (opUpdateError) {
    console.error('Operator update error:', opUpdateError.message);
  }

  // Let's query products for orgId2
  console.log('=== Querying products for orgId2 (68a2f0b2-80f7-4868-bbb9-30b531c12db2) ===');
  const { data: products2, error: pError2 } = await supabase.from('products').select('*');
  if (pError2) {
    console.error('Error fetching products (org2):', pError2.message);
  } else {
    console.log(`Found ${products2.length} products:`);
    products2.forEach(p => console.log('  -', JSON.stringify(p)));
  }

  // Cleanup: delete operator
  console.log('Cleaning up operator row...');
  const { error: opDelError } = await supabase.from('operators').delete().eq('id', user.id);
  console.log('Operator cleanup:', opDelError ? opDelError.message : 'success');
}

run();
