CREATE OR REPLACE FUNCTION "public"."complete_onboarding"("p_token" "text", "p_auth_id" "uuid", "p_email" "text", "p_full_name" "text", "p_role" "text", "p_org_name" "text", "p_org_trade_name" "text", "p_org_document" "text", "p_org_city" "text", "p_org_state" "text", "p_org_website" "text", "p_segments" "uuid"[]) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_org_id uuid;
  v_seg_id uuid;
  v_slug   text;
  v_nome text;
  v_sobrenome text;
BEGIN
  -- Separa nome e sobrenome
  v_nome := split_part(p_full_name, ' ', 1);
  v_sobrenome := nullif(substring(p_full_name from length(v_nome) + 2), '');
  IF v_sobrenome IS NULL THEN v_sobrenome := ''; END IF;

  -- Gera slug único: "RAIZEN ENERGIA S.A" → "raizen-energia-s-a-1753415345"
  v_slug := lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || floor(extract(epoch from now()))::text;

  -- 1. Cria a organização com os nomes reais das colunas
  INSERT INTO public.organizations (
    name, slug, razao_social, nome_fantasia, cnpj, city, state, website, status
  ) VALUES (
    p_org_name, v_slug, p_org_name, p_org_trade_name, p_org_document,
    p_org_city, p_org_state, p_org_website, 'ativo'
  ) RETURNING id INTO v_org_id;

  -- 2. Insere os segmentos vinculando ao UUID real da org
  IF p_segments IS NOT NULL AND array_length(p_segments, 1) > 0 THEN
    FOREACH v_seg_id IN ARRAY p_segments LOOP
      INSERT INTO public.company_segments (organization_id, segment_id)
      VALUES (v_org_id, v_seg_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- 3. Cria o perfil do usuário na tabela profiles vinculando à organização
  INSERT INTO public.profiles (user_id, organization_id, full_name, email)
  VALUES (p_auth_id, v_org_id, p_full_name, p_email)
  ON CONFLICT (user_id) DO UPDATE SET
    organization_id = v_org_id,
    full_name = p_full_name;

  -- 4. Cria o operador administrador
  INSERT INTO public.operators (
    id, organization_id, email, nome, sobrenome, cargo, perfil, status
  ) VALUES (
    p_auth_id, v_org_id, p_email, v_nome, v_sobrenome, 'Administrador Empresarial', 'administrador', 'ativo'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 5. Atualiza o convite para aceito (move de Convites Pendentes para Parceiros)
  UPDATE public.invitations
  SET status = 'aceito', updated_at = NOW()
  WHERE token_hash = p_token;

  RETURN TRUE;
END;
$$;
