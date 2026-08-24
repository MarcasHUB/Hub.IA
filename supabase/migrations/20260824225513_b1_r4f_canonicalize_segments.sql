-- B1-R.4F Canonicalização de Segmentos

-- 1. Copiar dados legados para a nova tabela
INSERT INTO public.organization_segments (organization_id, segment_id)
SELECT organization_id, segment_id 
FROM public.company_segments
ON CONFLICT (organization_id, segment_id) DO NOTHING;

-- 2. Atualizar funções que referenciam company_segments

CREATE OR REPLACE FUNCTION public.list_public_organizations()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'razao_social', o.razao_social,
    'nome_fantasia', o.nome_fantasia,
    'trade_name', coalesce(o.nome_fantasia, o.name),
    'document', o.cnpj,
    'cnpj', o.cnpj,
    'description', o.description,
    'logo_url', o.logo_url,
    'website', o.website,
    'city', o.city,
    'state', o.state,
    'profile_type', o.profile_type,
    'segment', o.segment,
    'commercial_profile', o.perfil_comercial,
    'perfil_comercial', o.perfil_comercial,
    'company_type', o.tipo_empresa,
    'tipo_empresa', o.tipo_empresa,
    'service_radius', o.raio_atendimento_km,
    'raio_atendimento_km', o.raio_atendimento_km,
    'material_count', (SELECT count(*) FROM public.organization_materials om WHERE om.organization_id = o.id),
    'segment_count', (SELECT count(*) FROM public.organization_segments os WHERE os.organization_id = o.id)
  ) ORDER BY coalesce(o.nome_fantasia, o.name)), '[]'::jsonb)
  FROM private.current_identity() AS i
  CROSS JOIN public.organizations AS o
  WHERE (o.id <> i.organization_id OR private.is_current_platform_admin())
    AND o.status IN ('ativo', 'active')
    AND (NOT coalesce(o.is_platform_internal, false) OR private.is_current_platform_admin());
$$;

-- 3. Marcar company_segments como deprecated nos comentários
COMMENT ON TABLE public.company_segments IS '@deprecated Use public.organization_segments instead';
