CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_token text,
  p_auth_id uuid,
  p_email text,
  p_full_name text,
  p_role text,
  p_org_name text,
  p_org_trade_name text,
  p_org_document text,
  p_org_city text,
  p_org_state text,
  p_org_website text,
  p_segments uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
  v_invite_id uuid;
  v_seg_id uuid;
BEGIN
  -- 1. Cria a organização
  INSERT INTO public.organizations (
    name, document, trade_name, city, state, website
  ) VALUES (
    p_org_name, p_org_document, p_org_trade_name, p_org_city, p_org_state, p_org_website
  ) RETURNING id INTO v_org_id;

  -- 2. Insere os segmentos
  IF p_segments IS NOT NULL AND array_length(p_segments, 1) > 0 THEN
    FOREACH v_seg_id IN ARRAY p_segments
    LOOP
      INSERT INTO public.company_segments (organization_id, segment_id)
      VALUES (v_org_id, v_seg_id);
    END LOOP;
  END IF;

  -- 3. Cria o usuário na tabela pública
  INSERT INTO public.users (
    id, organization_id, email, full_name, role
  ) VALUES (
    p_auth_id, v_org_id, p_email, p_full_name, p_role::user_role
  );

  -- 4. Atualiza o convite para aceito
  UPDATE public.invitations
  SET status = 'aceito', updated_at = NOW()
  WHERE token_hash = p_token;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding TO anon;
