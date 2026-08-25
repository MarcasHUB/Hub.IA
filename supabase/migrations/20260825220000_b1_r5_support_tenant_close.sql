-- Migration b1_r5_support_tenant_close

CREATE OR REPLACE FUNCTION public.support_close_ticket(
  p_ticket_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_ticket record;
BEGIN
  -- 1. Identify organization
  v_org_id := public.support_current_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organização não encontrada para o tenant';
  END IF;

  -- 2. Fetch and lock ticket
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado ou indisponível.';
  END IF;

  -- 3. Verify ownership (DO NOT REVEAL CROSS-TENANT IDS)
  IF v_ticket.organization_id != v_org_id THEN
    RAISE EXCEPTION 'Chamado não encontrado ou indisponível.';
  END IF;

  -- 4. Check if already closed (Idempotent success)
  IF v_ticket.status = 'closed' THEN
    RETURN;
  END IF;

  -- 5. Perform update
  UPDATE public.support_tickets
  SET status = 'closed',
      updated_at = now()
  WHERE id = p_ticket_id;

  -- 6. Audit logging (using existing structure)
  INSERT INTO public.audit_logs (
    action_type, user_id, organization_id, entity_type, entity_id, metadata
  ) VALUES (
    'SUPPORT_TICKET_CLOSED_BY_TENANT', auth.uid(), v_org_id, 'support_ticket', p_ticket_id,
    jsonb_build_object(
      'previous_status', v_ticket.status, 
      'new_status', 'closed'
    )
  );

END;
$$;

REVOKE ALL ON FUNCTION public.support_close_ticket(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.support_close_ticket(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.support_close_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.support_close_ticket(uuid) TO service_role;