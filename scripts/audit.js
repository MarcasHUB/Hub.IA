import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data: orgs, error } = await supabase.from('organizations').select('*');
    if (error) throw error;
    fs.writeFileSync('audit_orgs.json', JSON.stringify(orgs, null, 2));

    const { data: companies } = await supabase.from('companies').select('*');
    fs.writeFileSync('audit_companies.json', JSON.stringify(companies || [], null, 2));

    const { data: products } = await supabase.from('products').select('*');
    fs.writeFileSync('audit_products.json', JSON.stringify(products || [], null, 2));

    const { data: materials } = await supabase.from('materials').select('*');
    fs.writeFileSync('audit_materials.json', JSON.stringify(materials || [], null, 2));

    const { data: profiles } = await supabase.from('profiles').select('*');
    fs.writeFileSync('audit_profiles.json', JSON.stringify(profiles || [], null, 2));

    const { data: user_roles } = await supabase.from('user_roles').select('*');
    fs.writeFileSync('audit_user_roles.json', JSON.stringify(user_roles || [], null, 2));

    const { data: operators } = await supabase.from('operators').select('*');
    fs.writeFileSync('audit_operators.json', JSON.stringify(operators || [], null, 2));
    
    console.log('Audit data saved to audit_*.json');
  } catch (err) {
    console.error(err);
  }
}
run();
