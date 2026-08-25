CREATE OR REPLACE FUNCTION public.admin_list_organizations_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NOT private.is_current_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'trade_name', coalesce(o.nome_fantasia, o.name),
      'cnpj', o.cnpj,
      'logo_url', o.logo_url,
      'status', o.status,
      'profile_completion', coalesce(o.profile_completion, 0),
      'segment', (
        SELECT coalesce(jsonb_agg(s.nome ORDER BY s.nome), '[]'::jsonb)
        FROM public.organization_segments os
        JOIN public.segments s ON os.segment_id = s.id
        WHERE os.organization_id = o.id
      ),
      'operatorCount', (
        SELECT count(*)
        FROM public.operators op
        WHERE op.organization_id = o.id AND op.deleted_at IS NULL
      )
    ) ORDER BY coalesce(o.nome_fantasia, o.name))
    FROM public.organizations AS o
  ), '[]'::jsonb);
END;
$$;
