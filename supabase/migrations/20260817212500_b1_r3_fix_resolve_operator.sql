-- Fix min(uuid) in resolve_operator_invitation_identity (B1-R.3.5)
CREATE OR REPLACE FUNCTION public.resolve_operator_invitation_identity(
  p_caller_id uuid,
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_organization_id uuid;
  v_user_id uuid;
  v_operator_count integer;
BEGIN
  SELECT op.organization_id INTO v_caller_organization_id
  FROM public.operators AS op
  WHERE op.id = p_caller_id
    AND op.deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_UNAVAILABLE';
  END IF;

  SELECT count(*)
  INTO v_operator_count
  FROM public.operators AS op
  WHERE lower(op.email) = lower(trim(p_email))
    AND op.deleted_at IS NULL;

  IF v_operator_count = 1 THEN
    SELECT op.id INTO v_user_id
    FROM public.operators AS op
    WHERE lower(op.email) = lower(trim(p_email))
      AND op.deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_operator_count > 1 OR (
    v_operator_count = 1 AND NOT EXISTS (
      SELECT 1 FROM public.operators op
      WHERE op.id = v_user_id
        AND op.organization_id = v_caller_organization_id
        AND op.deleted_at IS NULL
    )
  ) THEN
    -- Prevent cross tenant usage of operators
    RAISE EXCEPTION 'OPERATOR_CROSS_TENANT_CONFLICT';
  END IF;

  IF v_operator_count = 0 THEN
    SELECT u.id INTO v_user_id
    FROM auth.users AS u
    WHERE lower(u.email) = lower(trim(p_email));
    
    IF FOUND THEN 
       -- Reject if auth user exists but is not an operator in this org
       RAISE EXCEPTION 'OPERATOR_CROSS_TENANT_CONFLICT'; 
    END IF;
  END IF;

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_operator_invitation_identity(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_operator_invitation_identity(uuid, text) TO service_role;
