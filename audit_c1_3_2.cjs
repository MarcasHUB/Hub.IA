require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runAudit() {
  console.log("--- 1.1 Estrutura Completa ---");
  const q1 = `
    SELECT
        ordinal_position,
        column_name,
        data_type,
        is_nullable,
        column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
    ORDER BY ordinal_position;
  `;
  const { data: d1, error: e1 } = await supabase.rpc('execute_sql', { query: q1 });
  if (e1) console.error(e1); else console.table(d1);

  console.log("\n--- 1.2 Quantidade por modelo ---");
  const q2 = `
    SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
            WHERE company_a_id IS NOT NULL
              AND company_b_id IS NOT NULL
        ) AS legacy_company_rows,
        COUNT(*) FILTER (
            WHERE organization_a_id IS NOT NULL
              AND organization_b_id IS NOT NULL
        ) AS organization_rows,
        COUNT(*) FILTER (
            WHERE organization_a_id IS NULL
               OR organization_b_id IS NULL
        ) AS without_complete_organization_pair
    FROM public.conversations;
  `;
  const { data: d2, error: e2 } = await supabase.rpc('execute_sql', { query: q2 });
  if (e2) console.error(e2); else console.table(d2);

  console.log("\n--- 1.3 Registros existentes ---");
  const q3 = `
    SELECT
        id,
        company_a_id,
        company_b_id,
        organization_a_id,
        organization_b_id,
        status,
        created_at
    FROM public.conversations
    ORDER BY created_at;
  `;
  const { data: d3, error: e3 } = await supabase.rpc('execute_sql', { query: q3 });
  if (e3) console.error(e3); else console.table(d3);

  console.log("\n--- 1.4 FKs reais ---");
  const q4 = `
    SELECT
        con.conname AS constraint_name,
        att.attname AS local_column,
        con.confrelid::regclass AS referenced_table,
        referenced_att.attname AS referenced_column,
        con.confdeltype AS delete_action
    FROM pg_constraint con
    JOIN unnest(con.conkey) WITH ORDINALITY AS local_key(attnum, ord)
      ON true
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = local_key.attnum
    JOIN unnest(con.confkey) WITH ORDINALITY AS referenced_key(attnum, ord)
      ON referenced_key.ord = local_key.ord
    JOIN pg_attribute referenced_att
      ON referenced_att.attrelid = con.confrelid
     AND referenced_att.attnum = referenced_key.attnum
    WHERE con.conrelid = 'public.conversations'::regclass
      AND con.contype = 'f'
    ORDER BY con.conname;
  `;
  const { data: d4, error: e4 } = await supabase.rpc('execute_sql', { query: q4 });
  if (e4) console.error(e4); else console.table(d4);

  console.log("\n--- 1.5 Dependências ---");
  const q5 = `
    SELECT 
        dependent_ns.nspname as dependent_schema,
        dependent_view.relname as dependent_view,
        source_ns.nspname as source_schema,
        source_table.relname as source_table,
        pg_attribute.attname as column_name
    FROM pg_depend 
    JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid 
    JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid 
    JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid 
    JOIN pg_attribute ON pg_depend.refobjid = pg_attribute.attrelid 
        AND pg_depend.refobjsubid = pg_attribute.attnum 
    JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent_view.relnamespace
    JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
    WHERE source_table.relname = 'conversations'
      AND pg_attribute.attname IN ('company_a_id', 'company_b_id', 'organization_a_id', 'organization_b_id')
      AND pg_attribute.attnum > 0
    ORDER BY 1,2;
  `;
  const { data: d5, error: e5 } = await supabase.rpc('execute_sql', { query: q5 });
  if (e5) console.error(e5); else console.table(d5);

  const q6 = `
    SELECT tgname as trigger_name,
           tgenabled as status,
           proname as function_name
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE tgrelid = 'public.conversations'::regclass;
  `;
  const { data: d6, error: e6 } = await supabase.rpc('execute_sql', { query: q6 });
  if (e6) console.error(e6); else console.table(d6);

  const q7 = `
    SELECT polname, polcmd, polroles, polqual, polwithcheck
    FROM pg_policy
    WHERE polrelid = 'public.conversations'::regclass;
  `;
  const { data: d7, error: e7 } = await supabase.rpc('execute_sql', { query: q7 });
  if (e7) console.error(e7); else console.table(d7);

  const q8 = `
    SELECT polname, polcmd, polroles, polqual, polwithcheck
    FROM pg_policy
    WHERE polrelid = 'public.messages'::regclass;
  `;
  const { data: d8, error: e8 } = await supabase.rpc('execute_sql', { query: q8 });
  if (e8) console.error(e8); else console.table(d8);

  const q9 = `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'conversations';
  `;
  const { data: d9, error: e9 } = await supabase.rpc('execute_sql', { query: q9 });
  if (e9) console.error(e9); else console.table(d9);

}

runAudit();
