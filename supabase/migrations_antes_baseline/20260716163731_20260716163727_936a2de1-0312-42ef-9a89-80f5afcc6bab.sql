
-- 1) Counter table
CREATE TABLE IF NOT EXISTS public.quotation_number_counters (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, year)
);

GRANT SELECT ON public.quotation_number_counters TO authenticated;
GRANT ALL ON public.quotation_number_counters TO service_role;

ALTER TABLE public.quotation_number_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view own org counters" ON public.quotation_number_counters;
CREATE POLICY "Members can view own org counters"
  ON public.quotation_number_counters
  FOR SELECT
  TO authenticated
  USING (organization_id = public.current_org_id());

DROP TRIGGER IF EXISTS update_quotation_number_counters_updated_at ON public.quotation_number_counters;
CREATE TRIGGER update_quotation_number_counters_updated_at
  BEFORE UPDATE ON public.quotation_number_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Unique index on (organization_id, title)
CREATE UNIQUE INDEX IF NOT EXISTS quotation_requests_org_title_uidx
  ON public.quotation_requests (organization_id, title);

-- 3) next_orc_number() - atomic per (org, year)
CREATE OR REPLACE FUNCTION public.next_orc_number(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
  v_num integer;
BEGIN
  INSERT INTO public.quotation_number_counters (organization_id, year, last_number)
  VALUES (p_org_id, v_year, 1)
  ON CONFLICT (organization_id, year)
  DO UPDATE SET last_number = public.quotation_number_counters.last_number + 1,
                updated_at = now()
  RETURNING last_number INTO v_num;

  RETURN 'ORC-' || v_year::text || '-' || lpad(v_num::text, 5, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_orc_number(uuid) FROM PUBLIC;

-- 4) create_quotation_request(): number + row in one tx
CREATE OR REPLACE FUNCTION public.create_quotation_request(
  p_notes text DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_priority_level text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  status quotation_status,
  created_at timestamptz,
  organization_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.current_org_id();
  v_user uuid := auth.uid();
  v_title text;
  v_new public.quotation_requests%ROWTYPE;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a uma organização.';
  END IF;

  v_title := public.next_orc_number(v_org);

  INSERT INTO public.quotation_requests (
    organization_id, title, status, notes, due_date, priority_level, created_by
  ) VALUES (
    v_org, v_title, 'draft'::quotation_status, p_notes, p_due_date, p_priority_level, v_user
  )
  RETURNING * INTO v_new;

  PERFORM public.insert_audit_log(
    'quotation_created',
    'quotation_request',
    v_new.id,
    jsonb_build_object('title', v_new.title),
    v_org
  );

  RETURN QUERY SELECT v_new.id, v_new.title, v_new.status, v_new.created_at, v_new.organization_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_quotation_request(text, date, text) TO authenticated;

-- 5) create_orc_revision(): validate head, copy items, cancel parent, audit-only substitution
CREATE OR REPLACE FUNCTION public.create_orc_revision(p_quotation_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  status quotation_status,
  created_at timestamptz,
  organization_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.current_org_id();
  v_user uuid := auth.uid();
  v_target public.quotation_requests%ROWTYPE;
  v_root_title text;
  v_head public.quotation_requests%ROWTYPE;
  v_next_rev int;
  v_new_title text;
  v_new public.quotation_requests%ROWTYPE;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a uma organização.';
  END IF;

  -- Lock target
  SELECT * INTO v_target
  FROM public.quotation_requests
  WHERE id = p_quotation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;

  IF v_target.organization_id <> v_org THEN
    RAISE EXCEPTION 'Orçamento pertence a outra organização.';
  END IF;

  IF v_target.status IN ('draft'::quotation_status, 'cancelled'::quotation_status, 'closed'::quotation_status) THEN
    RAISE EXCEPTION 'Não é possível criar revisão de um orçamento com status %.', v_target.status;
  END IF;

  -- Root title (strip .revN if present)
  v_root_title := regexp_replace(v_target.title, '\.rev[0-9]+$', '');

  -- Find current head across root + revisions, locked
  SELECT * INTO v_head
  FROM public.quotation_requests
  WHERE organization_id = v_org
    AND (title = v_root_title OR title ~ ('^' || regexp_replace(v_root_title, '([\\.\+\*\?\(\)\[\]\{\}\|\^\$])', '\\\1', 'g') || '\.rev[0-9]+$'))
  ORDER BY
    CASE WHEN title = v_root_title THEN 0
         ELSE (regexp_replace(title, '^.*\.rev([0-9]+)$', '\1'))::int
    END DESC
  LIMIT 1
  FOR UPDATE;

  IF v_head.id <> p_quotation_id THEN
    RAISE EXCEPTION 'Este orçamento já foi substituído por uma revisão mais recente.';
  END IF;

  -- Compute next revision number
  IF v_head.title = v_root_title THEN
    v_next_rev := 1;
  ELSE
    v_next_rev := (regexp_replace(v_head.title, '^.*\.rev([0-9]+)$', '\1'))::int + 1;
  END IF;

  v_new_title := v_root_title || '.rev' || v_next_rev::text;

  -- Insert new revision
  INSERT INTO public.quotation_requests (
    organization_id, title, status, notes, due_date, priority_level, created_by
  ) VALUES (
    v_org,
    v_new_title,
    'draft'::quotation_status,
    v_head.notes,
    v_head.due_date,
    v_head.priority_level,
    v_user
  )
  RETURNING * INTO v_new;

  -- Copy items
  INSERT INTO public.quotation_items (quotation_request_id, product_id, quantity, unit)
  SELECT v_new.id, product_id, quantity, unit
  FROM public.quotation_items
  WHERE quotation_request_id = v_head.id;

  -- Cancel previous head WITHOUT touching notes
  UPDATE public.quotation_requests
  SET status = 'cancelled'::quotation_status,
      updated_at = now()
  WHERE id = v_head.id;

  -- Audit log: supersede
  PERFORM public.insert_audit_log(
    'quotation_superseded',
    'quotation_request',
    v_head.id,
    jsonb_build_object(
      'superseded_by_id', v_new.id,
      'superseded_by_title', v_new.title,
      'previous_title', v_head.title
    ),
    v_org
  );

  -- Audit log: new revision
  PERFORM public.insert_audit_log(
    'quotation_revision_created',
    'quotation_request',
    v_new.id,
    jsonb_build_object(
      'supersedes_id', v_head.id,
      'supersedes_title', v_head.title,
      'title', v_new.title,
      'revision', v_next_rev
    ),
    v_org
  );

  RETURN QUERY SELECT v_new.id, v_new.title, v_new.status, v_new.created_at, v_new.organization_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_orc_revision(uuid) TO authenticated;
;
