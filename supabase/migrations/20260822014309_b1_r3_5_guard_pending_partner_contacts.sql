-- B1-R.3.5: preserve the existing partner list contract while preventing
-- pending relationships from receiving private commercial contacts.
CREATE OR REPLACE FUNCTION public.list_partner_connections()
RETURNS TABLE (
  connection_id uuid,
  partner_organization_id uuid,
  partner_name text,
  partner_document text,
  partner_segment text,
  partner_city text,
  partner_state text,
  partner_email text,
  partner_phone text,
  partner_website text,
  partner_commercial_profile text,
  partner_company_type text,
  partner_service_radius integer,
  connection_status text,
  requester_approval_status text,
  direction text,
  can_review_internal boolean,
  can_respond boolean,
  connected_at timestamptz,
  message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH identity AS (
    SELECT * FROM private.current_identity()
  ), visible_connections AS (
    SELECT
      cr.*,
      i.organization_id AS caller_org_id,
      i.operator_profile AS caller_profile,
      CASE WHEN cr.requester_company_id = i.organization_id
           THEN cr.target_company_id ELSE cr.requester_company_id END AS partner_id
    FROM public.connection_requests AS cr
    CROSS JOIN identity AS i
    WHERE cr.requester_company_id = i.organization_id
       OR (
         cr.target_company_id = i.organization_id
         AND (
           cr.status = 'accepted'
           OR cr.requester_approval_status IN ('approved', 'not_required')
         )
       )
  )
  SELECT
    vc.id,
    o.id,
    coalesce(nullif(trim(o.nome_fantasia), ''), nullif(trim(o.razao_social), ''), o.name),
    o.cnpj,
    CASE
      WHEN jsonb_typeof(o.segment) = 'string' THEN trim(both '"' from o.segment::text)
      ELSE NULL
    END,
    o.city,
    o.state,
    CASE WHEN vc.status = 'accepted' THEN coalesce(o.email_corporativo, o.business_email) ELSE NULL END,
    CASE WHEN vc.status = 'accepted' THEN coalesce(o.telefone, o.phone) ELSE NULL END,
    o.website,
    o.perfil_comercial,
    o.tipo_empresa,
    o.raio_atendimento_km,
    vc.status,
    vc.requester_approval_status,
    CASE WHEN vc.requester_company_id = vc.caller_org_id THEN 'sent' ELSE 'received' END,
    vc.requester_company_id = vc.caller_org_id
      AND vc.caller_profile = 'administrador'
      AND vc.status = 'pending'
      AND vc.requester_approval_status = 'pending',
    vc.target_company_id = vc.caller_org_id
      AND vc.caller_profile IN ('administrador', 'gestor')
      AND vc.status = 'pending'
      AND vc.requester_approval_status IN ('approved', 'not_required'),
    coalesce(vc.responded_at, vc.created_at),
    vc.message
  FROM visible_connections AS vc
  JOIN public.organizations AS o ON o.id = vc.partner_id
  WHERE vc.status IN ('pending', 'accepted')
  ORDER BY vc.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_partner_connections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_partner_connections() TO authenticated;
