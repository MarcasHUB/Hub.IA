-- Cria função SECURITY DEFINER para buscar dados do convite na Onboarding Wizard
CREATE OR REPLACE FUNCTION public.validate_company_invite(p_token text)
RETURNS TABLE (
  id uuid,
  company text,
  name text,
  document text,
  city text,
  state text,
  email text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id, i.company, i.name, i.document, i.city, i.state, i.email, i.status
  FROM public.invitations i
  WHERE i.token_hash = p_token
  LIMIT 1;
END;
$$;

-- Permite execução pela role authenticated e anon
GRANT EXECUTE ON FUNCTION public.validate_company_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_company_invite(text) TO anon;
