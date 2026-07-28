import fs from 'fs';

const migrationPath = 'src/infrastructure/supabase/migrations/28_phase2_architecture.sql';
let sql = fs.readFileSync(migrationPath, 'utf8');

const grants = `
-- GRANTS FOR API
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_cnaes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certifications TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_certificacoes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_estados_atendidos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_segments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_catalogo TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_parceiros TO anon, authenticated;
`;

if (!sql.includes('-- GRANTS FOR API')) {
  sql += grants;
  fs.writeFileSync(migrationPath, sql);
}

// I will just print the SQL so I can run it via MCP, or I can call it manually.
console.log("Migration file updated.");
