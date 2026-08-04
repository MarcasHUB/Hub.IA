WITH org_stats AS (
  SELECT 
    o.id as organization_id,
    o.cnpj,
    o.razao_social,
    o.nome_fantasia,
    o.status,
    o.business_model,
    (SELECT COUNT(*) FROM public.operators op WHERE op.organization_id = o.id) as operadores_count,
    (SELECT COUNT(*) FROM public.profiles p WHERE p.organization_id = o.id) as profiles_count,
    (SELECT COUNT(*) FROM public.products pr WHERE pr.organization_id = o.id) as products_count,
    (SELECT COUNT(*) FROM public.empresa_parceiros c WHERE c.organization_id = o.id OR c.partner_id = o.id) as conexoes_count,
    (SELECT COUNT(*) FROM public.invitations i WHERE i.organization_id = o.id) as convites_count,
    (SELECT COUNT(*) FROM public.conversations cv WHERE cv.company_a_id = o.id OR cv.company_b_id = o.id) as conversas_count
  FROM public.organizations o
)
SELECT json_agg(org_stats) FROM org_stats;
