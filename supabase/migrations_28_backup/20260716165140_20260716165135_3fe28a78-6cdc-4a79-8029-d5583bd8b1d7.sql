-- Fix column name in create_orc_revision (quotation_items FK is request_id, not quotation_request_id)
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

  SELECT * INTO v_target FROM public.quotation_requests WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;
  IF v_target.organization_id <> v_org THEN
    RAISE EXCEPTION 'Orçamento pertence a outra organização.';
  END IF;
  IF v_target.status IN ('draft'::quotation_status, 'cancelled'::quotation_status, 'closed'::quotation_status) THEN
    RAISE EXCEPTION 'Não é possível criar revisão de um orçamento com status %.', v_target.status;
  END IF;

  v_root_title := regexp_replace(v_target.title, '\.rev[0-9]+$', '');

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

  IF v_head.title = v_root_title THEN
    v_next_rev := 1;
  ELSE
    v_next_rev := (regexp_replace(v_head.title, '^.*\.rev([0-9]+)$', '\1'))::int + 1;
  END IF;

  v_new_title := v_root_title || '.rev' || v_next_rev::text;

  INSERT INTO public.quotation_requests (
    organization_id, title, status, notes, due_date, priority_level, created_by
  ) VALUES (
    v_org, v_new_title, 'draft'::quotation_status,
    v_head.notes, v_head.due_date, v_head.priority_level, v_user
  )
  RETURNING * INTO v_new;

  -- FIX: column is request_id, not quotation_request_id
  INSERT INTO public.quotation_items (request_id, product_id, quantity, unit)
  SELECT v_new.id, product_id, quantity, unit
  FROM public.quotation_items
  WHERE request_id = v_head.id;

  UPDATE public.quotation_requests
  SET status = 'cancelled'::quotation_status, updated_at = now()
  WHERE id = v_head.id;

  PERFORM public.insert_audit_log(
    'quotation_superseded', 'quotation_request', v_head.id,
    jsonb_build_object('superseded_by_id', v_new.id, 'superseded_by_title', v_new.title, 'previous_title', v_head.title),
    v_org
  );
  PERFORM public.insert_audit_log(
    'quotation_revision_created', 'quotation_request', v_new.id,
    jsonb_build_object('supersedes_id', v_head.id, 'supersedes_title', v_head.title, 'title', v_new.title, 'revision', v_next_rev),
    v_org
  );

  RETURN QUERY SELECT v_new.id, v_new.title, v_new.status, v_new.created_at, v_new.organization_id;
END;
$$;;
