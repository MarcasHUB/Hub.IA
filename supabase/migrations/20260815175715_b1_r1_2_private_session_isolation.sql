-- B1-R.1.2: falhar fechado quando a identidade atual nao possui leitura de operadores.
-- O tenant continua derivado exclusivamente de auth.uid() via private.current_identity().

CREATE OR REPLACE FUNCTION public.get_my_operators()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_identity record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_identity
  FROM private.current_identity();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH_IDENTITY_INCONSISTENT';
  END IF;

  IF NOT private.has_tenant_capability('operators_read') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(op) || jsonb_build_object(
    'category_ids', coalesce((
      SELECT jsonb_agg(oc.category_id ORDER BY oc.category_id)
      FROM public.operator_categories AS oc
      WHERE oc.operator_id = op.id
    ), '[]'::jsonb)
  ) ORDER BY op.nome, op.sobrenome), '[]'::jsonb)
  INTO v_result
  FROM public.operators AS op
  WHERE op.organization_id = v_identity.organization_id
    AND op.deleted_at IS NULL;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_operators() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_operators() TO authenticated;
