-- B1-R.5 Reconcile Support Schema
-- PURPOSE: Make the schema deterministic for both:
--   (a) production (where M2 was applied manually via execute_sql)
--   (b) clean replay (M2 + this migration)
--
-- All operations are IDEMPOTENT (IF NOT EXISTS / IF EXISTS / DO $body$ ... END).
-- Does NOT modify: 20260824225514, 20260824230000.

-- ============================================================
-- 1. ENSURE read_at COLUMN EXISTS ON support_messages
-- ============================================================
DO $body$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'support_messages' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE public.support_messages ADD COLUMN read_at timestamptz;
  END IF;
END $body$;

-- ============================================================
-- 2. ENSURE SNAPSHOT COLUMNS ARE NOT NULL
-- ============================================================
DO $body$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'support_tickets'
      AND column_name = 'created_by_name_snapshot' AND is_nullable = 'YES'
  ) THEN
    UPDATE public.support_tickets SET created_by_name_snapshot = 'Usuario' WHERE created_by_name_snapshot IS NULL;
    ALTER TABLE public.support_tickets ALTER COLUMN created_by_name_snapshot SET NOT NULL;
  END IF;
END $body$;

DO $body$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'support_messages'
      AND column_name = 'sender_name_snapshot' AND is_nullable = 'YES'
  ) THEN
    UPDATE public.support_messages SET sender_name_snapshot = 'Usuario' WHERE sender_name_snapshot IS NULL;
    ALTER TABLE public.support_messages ALTER COLUMN sender_name_snapshot SET NOT NULL;
  END IF;
END $body$;

-- ============================================================
-- 3. ENSURE CHECK CONSTRAINT: support_tickets_entity_check
-- ============================================================
DO $body$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'support_tickets'
      AND constraint_name = 'support_tickets_entity_check'
  ) THEN
    ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_entity_check CHECK (
      (affected_entity_type IS NULL AND affected_entity_id IS NULL) OR
      (affected_entity_type IS NOT NULL AND affected_entity_id IS NOT NULL
        AND affected_entity_type IN ('quotation_request', 'supplier_quotation'))
    );
  END IF;
END $body$;

-- ============================================================
-- 4. ENSURE sender_type CHECK INCLUDES 'system'
-- ============================================================
DO $body$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name = 'support_messages_sender_type_check'
      AND check_clause LIKE '%system%'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'support_messages'
        AND constraint_name = 'support_messages_sender_type_check'
    ) THEN
      ALTER TABLE public.support_messages DROP CONSTRAINT support_messages_sender_type_check;
    END IF;
    ALTER TABLE public.support_messages ADD CONSTRAINT support_messages_sender_type_check
      CHECK (sender_type IN ('tenant', 'support', 'system'));
  END IF;
END $body$;

-- ============================================================
-- 5. NORMALIZE FK ACTIONS
--    organization_id  -> NO ACTION (not CASCADE)
--    sender_org_id    -> NO ACTION (not CASCADE)
-- ============================================================
DO $body$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = 'support_tickets'
      AND rc.constraint_name = 'support_tickets_organization_id_fkey'
      AND rc.delete_rule = 'CASCADE'
  ) THEN
    ALTER TABLE public.support_tickets DROP CONSTRAINT support_tickets_organization_id_fkey;
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE NO ACTION;
  END IF;
END $body$;

DO $body$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = 'support_messages'
      AND rc.constraint_name = 'support_messages_sender_organization_id_fkey'
      AND rc.delete_rule = 'CASCADE'
  ) THEN
    ALTER TABLE public.support_messages DROP CONSTRAINT support_messages_sender_organization_id_fkey;
    ALTER TABLE public.support_messages
      ADD CONSTRAINT support_messages_sender_organization_id_fkey
      FOREIGN KEY (sender_organization_id) REFERENCES public.organizations(id) ON DELETE NO ACTION;
  END IF;
END $body$;

-- ============================================================
-- 6. DROP LEGACY POLICY NAMES (IF THEY EXIST)
-- ============================================================
DO $body$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'support_tickets' AND p.polname = 'Tenant SELECT tickets') THEN
    DROP POLICY "Tenant SELECT tickets" ON public.support_tickets;
  END IF;
END $body$;
DO $body$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'support_tickets' AND p.polname = 'Platform Admin SELECT tickets') THEN
    DROP POLICY "Platform Admin SELECT tickets" ON public.support_tickets;
  END IF;
END $body$;
DO $body$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'support_messages' AND p.polname = 'Tenant SELECT messages') THEN
    DROP POLICY "Tenant SELECT messages" ON public.support_messages;
  END IF;
END $body$;
DO $body$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'support_messages' AND p.polname = 'Platform Admin SELECT messages') THEN
    DROP POLICY "Platform Admin SELECT messages" ON public.support_messages;
  END IF;
END $body$;

-- ============================================================
-- 7. CREATE CANONICAL POLICY NAMES (idempotent)
-- ============================================================
DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'support_tickets' AND p.polname = 'support_tickets_select_tenant') THEN
    CREATE POLICY support_tickets_select_tenant ON public.support_tickets FOR SELECT
    USING (organization_id = (SELECT organization_id FROM private.current_identity()));
  END IF;
END $body$;

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'support_tickets' AND p.polname = 'support_tickets_select_platform_admin') THEN
    CREATE POLICY support_tickets_select_platform_admin ON public.support_tickets FOR SELECT
    USING (private.is_current_platform_admin());
  END IF;
END $body$;

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'support_messages' AND p.polname = 'support_messages_select_tenant') THEN
    CREATE POLICY support_messages_select_tenant ON public.support_messages FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.organization_id = (SELECT organization_id FROM private.current_identity())
    ));
  END IF;
END $body$;

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'support_messages' AND p.polname = 'support_messages_select_platform_admin') THEN
    CREATE POLICY support_messages_select_platform_admin ON public.support_messages FOR SELECT
    USING (private.is_current_platform_admin());
  END IF;
END $body$;

-- ============================================================
-- 8. RE-ENFORCE TABLE ACL AND RLS (idempotent)
-- ============================================================
REVOKE ALL ON TABLE public.support_tickets FROM anon, authenticated;
REVOKE ALL ON TABLE public.support_messages FROM anon, authenticated;
GRANT SELECT ON TABLE public.support_tickets TO authenticated;
GRANT SELECT ON TABLE public.support_messages TO authenticated;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
