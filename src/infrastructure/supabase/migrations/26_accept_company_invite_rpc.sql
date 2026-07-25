-- Cria função para aceitar o convite ignorando RLS (útil durante o onboarding onde o usuário ainda não está logado na org)
CREATE OR REPLACE FUNCTION public.accept_company_invite(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.invitations
  SET status = 'aceito',
      updated_at = NOW()
  WHERE token_hash = p_token;
  
  RETURN FOUND;
END;
$$;

-- Permite execução pela role authenticated e anon
GRANT EXECUTE ON FUNCTION public.accept_company_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_company_invite(text) TO anon;
