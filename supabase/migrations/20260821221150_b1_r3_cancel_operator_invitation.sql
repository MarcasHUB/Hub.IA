-- B1-R.3.3: restore secure cancellation of a pending operator invitation.
-- The caller tenant is derived exclusively from private.current_identity().

CREATE OR REPLACE FUNCTION public.cancel_operator_invitation(
  p_email text,
  p_operator_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_identity record;
  v_operator public.operators%ROWTYPE;
  v_invitation public.operator_invitations%ROWTYPE;
  v_normalized_email text := lower(trim(p_email));
  v_pending_invitation_count integer;
  v_cancelled_at timestamptz := now();
BEGIN
  SELECT *
  INTO v_identity
  FROM private.current_identity();

  IF NOT FOUND
     OR NOT private.has_tenant_capability('operators_manage') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT op.*
  INTO v_operator
  FROM public.operators AS op
  WHERE op.id = p_operator_id
    AND op.organization_id = v_identity.organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_NOT_FOUND';
  END IF;

  IF v_operator.status <> 'pendente' THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_NOT_PENDING';
  END IF;

  IF v_normalized_email IS NULL
     OR v_normalized_email = ''
     OR lower(trim(v_operator.email)) IS DISTINCT FROM v_normalized_email THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_EMAIL_MISMATCH';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    WHERE ur.user_id = v_operator.id
  ) THEN
    RAISE EXCEPTION 'OPERATOR_IDENTITY_INCONSISTENT';
  END IF;

  SELECT count(*)
  INTO v_pending_invitation_count
  FROM public.operator_invitations AS oi
  WHERE oi.organization_id = v_identity.organization_id
    AND lower(trim(oi.email)) = v_normalized_email
    AND oi.status = 'pendente';

  IF v_pending_invitation_count = 0 THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_NOT_PENDING';
  ELSIF v_pending_invitation_count > 1 THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_IDENTITY_INCONSISTENT';
  END IF;

  SELECT oi.*
  INTO v_invitation
  FROM public.operator_invitations AS oi
  WHERE oi.organization_id = v_identity.organization_id
    AND lower(trim(oi.email)) = v_normalized_email
    AND oi.status = 'pendente'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_NOT_PENDING';
  END IF;

  UPDATE public.operator_invitations
  SET status = 'cancelado',
      cancelled_at = v_cancelled_at,
      updated_at = v_cancelled_at
  WHERE id = v_invitation.id
    AND status = 'pendente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_NOT_PENDING';
  END IF;

  UPDATE public.operators
  SET status = 'cancelado',
      updated_at = v_cancelled_at
  WHERE id = v_operator.id
    AND organization_id = v_identity.organization_id
    AND status = 'pendente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_NOT_PENDING';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_operator_invitation(text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_operator_invitation(text, uuid)
  TO authenticated;
