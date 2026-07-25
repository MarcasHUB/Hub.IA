-- Redefine a função validate_company_invite para corrigir tipos de retorno e incluir 'segments' e dados da empresa convidante
DROP FUNCTION IF EXISTS public.validate_company_invite(text);

CREATE OR REPLACE FUNCTION public.validate_company_invite(p_token text)
RETURNS TABLE (
  id uuid,
  company varchar(255),
  name varchar(255),
  document varchar(50),
  city varchar(255),
  state varchar(50),
  email varchar(255),
  status varchar(50),
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
    i.id, i.company, i.name, i.document, i.city, i.state, i.email, i.status, i.segments,
    o.logo_url as inviter_logo_url,
    o.name as inviter_name
  FROM public.invitations i
  LEFT JOIN public.organizations o ON i.organization_id = o.id
  WHERE i.token_hash = p_token
  LIMIT 1;
END;
$$;

-- Permite execução pela role authenticated e anon
GRANT EXECUTE ON FUNCTION public.validate_company_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_company_invite(text) TO anon;
