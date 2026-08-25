-- =============================================================
-- B1-R.5 -- RECONCILE SUPPORT SCHEMA
-- Drift correction after manual apply of 20260824230000
-- Safe to run on production (idempotent guards) AND on clean replay
-- =============================================================

-- ---------------------------------------------------------------
-- 1. ADD read_at TO support_messages (missing from production)
-- ---------------------------------------------------------------
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- ---------------------------------------------------------------
-- 2. ADD entity_check constraint to support_tickets (missing from production)
-- ---------------------------------------------------------------
ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_entity_check;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_entity_check CHECK (
    (affected_entity_type IS NULL AND affected_entity_id IS NULL)
    OR (
      affected_entity_type IS NOT NULL
      AND affected_entity_id IS NOT NULL
      AND affected_entity_type IN ('quotation_request', 'supplier_quotation')
    )
  );

-- ---------------------------------------------------------------
-- 3. FIX sender_type constraint: add 'system' (currently only tenant/support)
-- ---------------------------------------------------------------
ALTER TABLE public.support_messages
  DROP CONSTRAINT IF EXISTS support_messages_sender_type_check;

ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_sender_type_check
  CHECK (sender_type IN ('tenant', 'support', 'system'));

-- ---------------------------------------------------------------
-- 4. FIX support_tickets.organization_id FK: CASCADE -> NO ACTION
-- ---------------------------------------------------------------
ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_organization_id_fkey;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES public.organizations(id)
  ON DELETE NO ACTION;

-- ---------------------------------------------------------------
-- 5. FIX support_messages.sender_organization_id FK: CASCADE -> NO ACTION
-- ---------------------------------------------------------------
ALTER TABLE public.support_messages
  DROP CONSTRAINT IF EXISTS support_messages_sender_organization_id_fkey;

ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_sender_organization_id_fkey
  FOREIGN KEY (sender_organization_id)
  REFERENCES public.organizations(id)
  ON DELETE NO ACTION;

-- ---------------------------------------------------------------
-- 6. ENSURE snapshot columns are NOT NULL
--    (already NOT NULL in production, idempotent for clean replay)
-- ---------------------------------------------------------------
UPDATE public.support_tickets SET created_by_name_snapshot = 'Sistema' WHERE created_by_name_snapshot IS NULL;
UPDATE public.support_messages SET sender_name_snapshot = 'Sistema' WHERE sender_name_snapshot IS NULL;

ALTER TABLE public.support_tickets
  ALTER COLUMN created_by_name_snapshot SET NOT NULL;

ALTER TABLE public.support_messages
  ALTER COLUMN sender_name_snapshot SET NOT NULL;

-- ---------------------------------------------------------------
-- 7. CANONICALIZE RLS POLICY NAMES
-- ---------------------------------------------------------------

-- support_tickets policies
DROP POLICY IF EXISTS "Admin Global pode ver todos os tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Tenant pode ver seus proprios tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Tenant pode ver seus próprios tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Platform Admin SELECT tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Tenant SELECT tickets" ON public.support_tickets;

CREATE POLICY "support_tickets_select_platform_admin"
  ON public.support_tickets FOR SELECT
  USING (private.is_current_platform_admin());

CREATE POLICY "support_tickets_select_tenant"
  ON public.support_tickets FOR SELECT
  USING (
    organization_id = (SELECT organization_id FROM private.current_identity())
  );

-- support_messages policies
DROP POLICY IF EXISTS "Admin Global pode ver todas as mensagens" ON public.support_messages;
DROP POLICY IF EXISTS "Tenant pode ver mensagens de seus tickets" ON public.support_messages;
DROP POLICY IF EXISTS "Platform Admin SELECT messages" ON public.support_messages;
DROP POLICY IF EXISTS "Tenant SELECT messages" ON public.support_messages;

CREATE POLICY "support_messages_select_platform_admin"
  ON public.support_messages FOR SELECT
  USING (private.is_current_platform_admin());

CREATE POLICY "support_messages_select_tenant"
  ON public.support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.organization_id = (SELECT organization_id FROM private.current_identity())
    )
  );

-- ---------------------------------------------------------------
-- 8. RE-ASSERT ACL (idempotent -- ensures consistent state on replay)
-- ---------------------------------------------------------------
REVOKE ALL ON TABLE public.support_tickets FROM anon, authenticated;
REVOKE ALL ON TABLE public.support_messages FROM anon, authenticated;
GRANT SELECT ON TABLE public.support_tickets TO authenticated;
GRANT SELECT ON TABLE public.support_messages TO authenticated;
