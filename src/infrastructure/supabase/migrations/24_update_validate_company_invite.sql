-- Redefine a função validate_company_invite com CAST explícito para evitar problemas de tipo (varchar vs text)
DROP FUNCTION IF EXISTS public.validate_company_invite(text);

CREATE OR REPLACE FUNCTION public.validate_company_invite(p_token text)
RETURNS TABLE (
  id uuid,
  company text,
  name text,
  document text,
  city text,
  state text,
  email text,
  status text,
  segments text[],
  inviter_logo_url text,
  inviter_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.company::text,
    i.name::text,
    i.document::text,
    i.city::text,
    i.state::text,
    i.email::text,
    i.status::text,
    i.segments,
    o.logo_url::text as inviter_logo_url,
    o.name::text as inviter_name
  FROM public.invitations i
  LEFT JOIN public.organizations o ON i.organization_id = o.id
  WHERE i.token_hash = p_token
  LIMIT 1;
END;
$$;

-- Permite execução pela role authenticated e anon
GRANT EXECUTE ON FUNCTION public.validate_company_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_company_invite(text) TO anon;
