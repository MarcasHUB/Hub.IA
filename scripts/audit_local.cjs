const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const data = {};

  const { data: orgs } = await supabase.from('organizations').select('*');
  data.organizations = orgs || [];

  const { data: companies } = await supabase.from('companies').select('*');
  data.companies = companies || [];

  const { data: profiles } = await supabase.from('profiles').select('*');
  data.profiles = profiles || [];

  const { data: operators } = await supabase.from('operators').select('*');
  data.operators = operators || [];

  const { data: products } = await supabase.from('products').select('*');
  data.products = products || [];

  const { data: materials } = await supabase.from('materials').select('*');
  data.materials = materials || [];

  const { data: org_materials } = await supabase.from('organization_materials').select('*');
  data.organization_materials = org_materials || [];

  fs.writeFileSync('audit_results.json', JSON.stringify(data, null, 2));
  console.log('Audit completed.');
}

run().catch(console.error);
