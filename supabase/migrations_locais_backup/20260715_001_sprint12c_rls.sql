-- ============================================================
-- Sprint 12C — Segurança Multi-Tenant (RLS)
-- Migração: 20260715_001_sprint12c_rls.sql
-- ============================================================

-- Ativar RLS nas tabelas
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegations ENABLE ROW LEVEL SECURITY;

-- ─── SEGMENTS ─────────────────────────────────────────────────
CREATE POLICY "segments_tenant_isolation" 
ON segments 
FOR ALL 
TO authenticated 
USING (
  organization_id = (SELECT organization_id FROM operators WHERE id = auth.uid() LIMIT 1)
);

-- ─── OPERATOR_SEGMENTS ────────────────────────────────────────
CREATE POLICY "operator_segments_tenant_isolation" 
ON operator_segments 
FOR ALL 
TO authenticated 
USING (
  operator_id IN (SELECT id FROM operators WHERE organization_id = (SELECT organization_id FROM operators WHERE id = auth.uid() LIMIT 1))
);

-- ─── DELEGATIONS ──────────────────────────────────────────────
CREATE POLICY "delegations_tenant_isolation" 
ON delegations 
FOR ALL 
TO authenticated 
USING (
  organization_id = (SELECT organization_id FROM operators WHERE id = auth.uid() LIMIT 1)
);
