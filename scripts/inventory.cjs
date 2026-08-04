const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: orgs } = await supabase.from('organizations').select('id, cnpj, razao_social, nome_fantasia, status');
  
  if (!orgs) return;

  const inventory = [];

  for (const org of orgs) {
    const { count: opCount } = await supabase.from('operators').select('*', { count: 'exact', head: true }).eq('organization_id', org.id);
    const { count: profCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('organization_id', org.id);
    const { count: prodCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('organization_id', org.id);
    const { count: invCount } = await supabase.from('invitations').select('*', { count: 'exact', head: true }).eq('organization_id', org.id);
    
    // For conversations, we can't easily query with OR using just head:true in JS client, so we do it this way:
    const { count: convCount } = await supabase.from('conversations').select('*', { count: 'exact', head: true }).or(`company_a_id.eq.${org.id},company_b_id.eq.${org.id}`);
    const { count: msgCount } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_organization_id', org.id);

    inventory.push({
      ...org,
      operadores: opCount || 0,
      profiles: profCount || 0,
      produtos: prodCount || 0,
      convites: invCount || 0,
      conversas: convCount || 0,
      mensagens: msgCount || 0
    });
  }

  console.log(JSON.stringify(inventory, null, 2));
}

run().catch(console.error);
