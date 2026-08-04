const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName) {
    const { error } = await supabase.from(tableName).select('id').limit(1);
    if (error) {
       console.log(`Table ${tableName}: ERROR - ${error.message}`);
       return false;
    }
    console.log(`Table ${tableName}: EXISTS`);
    return true;
}

async function run() {
    const tablesToCheck = [
        'connection_requests',
        'organization_connections',
        'companies',
        'organizations',
        'suppliers',
        'supplier_invitations',
        'invitations',
        'empresa_parceiros'
    ];
    
    for (const t of tablesToCheck) {
        await checkTable(t);
    }
}

run();
