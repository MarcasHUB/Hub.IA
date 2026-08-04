-- Migration HOTFIX B5.3
-- Objetivo: Garantir integridade de tenant no fluxo de convite e aceite.

BEGIN;

-- 1. Saneamento do conflito cruzado (Hub.IA vs Raízen) para viniciuscordebello@hotmail.com
DO $$
DECLARE
  v_email text := 'viniciuscordebello@hotmail.com';
  v_hubia_org uuid := '68a2f0b2-80f7-4868-bbb9-30b531c12db2';
  v_raizen_org uuid := '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1';
  v_user_id uuid;
BEGIN
  -- Identifica o usuário pelo e-mail
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email
  LIMIT 1;

  IF FOUND THEN
    -- Cancelar qualquer outro convite pendente para este usuário que não seja da Hub.IA
    UPDATE public.operator_invitations
    SET status = 'cancelado', updated_at = now()
    WHERE email = v_email AND organization_id != v_hubia_org;

    -- O convite relatado no incidente era da Hub.IA. Vamos garantir que o profile e operator 
    -- estejam apontando para a Hub.IA corretamente, conforme as regras do modelo de single-tenant.
    UPDATE public.profiles
    SET organization_id = v_hubia_org
    WHERE user_id = v_user_id;

    UPDATE public.operators
    SET organization_id = v_hubia_org
    WHERE id = v_user_id;
  END IF;
END;
$$;

-- 2. Limpeza de duplicidades antes de criar a constraint
-- Garantir que não existam e-mails duplicados na mesma organização para registros não deletados.
DO $$
BEGIN
  DELETE FROM public.operators a USING (
    SELECT MIN(ctid) as ctid, organization_id, LOWER(TRIM(email))
    FROM public.operators
    WHERE deleted_at IS NULL
    GROUP BY organization_id, LOWER(TRIM(email))
    HAVING COUNT(*) > 1
  ) b
  WHERE a.organization_id = b.organization_id 
    AND LOWER(TRIM(a.email)) = b.lower 
    AND a.deleted_at IS NULL
    AND a.ctid <> b.ctid;
END;
$$;

-- 3. Criar constraint de unicidade de e-mail por organização
CREATE UNIQUE INDEX IF NOT EXISTS unique_operator_email_org 
ON public.operators (organization_id, LOWER(TRIM(email))) 
WHERE deleted_at IS NULL;

-- 4. Atualizar a RPC transacional de aceite para usar o tenant do convite
CREATE OR REPLACE FUNCTION public.accept_operator_invitation_transactional(
  p_token text,
  p_user_id uuid,
  p_ip text,
  p_user_agent text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite RECORD;
  v_now timestamptz := now();
  v_cat_id uuid;
  v_existing_profile_org uuid;
BEGIN
  -- Bloqueia a linha do convite para evitar concorrência (SELECT FOR UPDATE)
  SELECT * INTO v_invite
  FROM public.operator_invitations
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF v_invite.status = 'aceito' THEN
    RAISE EXCEPTION 'Este convite já foi utilizado.';
  END IF;

  IF v_invite.status != 'pendente' THEN
    RAISE EXCEPTION 'Convite inválido (status: %).', v_invite.status;
  END IF;

  IF v_invite.expires_at < v_now THEN
    UPDATE public.operator_invitations SET status = 'expirado', updated_at = v_now WHERE id = v_invite.id;
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;

  -- Verifica se o usuário já possui um tenant diferente
  SELECT organization_id INTO v_existing_profile_org
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF FOUND AND v_existing_profile_org IS NOT NULL AND v_existing_profile_org != v_invite.organization_id THEN
    -- Opcional: Se ele tiver um perfil ativo em outra organização (e o operator também).
    -- Como a regra atual é single tenant principal, bloqueamos o aceite.
    RAISE EXCEPTION 'Esta conta já está vinculada a outra empresa. Entre com outro e-mail ou solicite uma transferência administrativa.';
  END IF;

  -- 1. Atualizar ou garantir que o profile aponte para a organização do convite
  UPDATE public.profiles
  SET organization_id = v_invite.organization_id,
      updated_at = v_now
  WHERE user_id = p_user_id;

  -- 2. Atualizar o operador com o organization_id do convite
  UPDATE public.operators
  SET status = 'ativo',
      organization_id = v_invite.organization_id,
      todas_categorias = COALESCE(v_invite.todas_categorias, false),
      accepted_at = v_now,
      updated_at = v_now
  WHERE id = p_user_id;

  -- 3. Inserir vínculos de categorias de forma idempotente
  IF v_invite.todas_categorias IS NOT TRUE AND array_length(v_invite.category_ids, 1) > 0 THEN
    FOREACH v_cat_id IN ARRAY v_invite.category_ids
    LOOP
      INSERT INTO public.operator_categories (operator_id, category_id)
      VALUES (p_user_id, v_cat_id)
      ON CONFLICT (operator_id, category_id) DO NOTHING;
    END LOOP;
  END IF;

  -- 4. Marcar o convite como aceito
  UPDATE public.operator_invitations
  SET status = 'aceito',
      accepted_at = v_now,
      ip_aceite = p_ip,
      user_agent_aceite = p_user_agent,
      updated_at = v_now
  WHERE id = v_invite.id;

  -- 5. Inserir logs (operation_logs)
  INSERT INTO public.operation_logs (operator_id, organization_id, entidade, acao, payload_depois)
  VALUES (
    p_user_id, 
    v_invite.organization_id, 
    'operator_invitation', 
    'aceitou', 
    jsonb_build_object('email', v_invite.email, 'ip', p_ip, 'user_agent', p_user_agent)
  );

  RETURN true;
END;
$$;

-- 5. Assertions de integridade obrigatórias (Blindagem B5.3)
DO $$
DECLARE
  v_hubia_org uuid := '68a2f0b2-80f7-4868-bbb9-30b531c12db2';
  v_raizen_org uuid := '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1';
  v_adm_global_email text := 'viniciuscordebello@gmail.com';
  v_everton_email text := 'everton.cordebello@raizen.com';
  v_icloud_email text := 'viniciuscordebello@icloud.com';
  v_org uuid;
BEGIN
  -- ADM GLOBAL continua na Hub.IA?
  SELECT organization_id INTO v_org FROM public.operators WHERE email = v_adm_global_email LIMIT 1;
  IF v_org != v_hubia_org THEN RAISE EXCEPTION 'Regressão de identidade detectada: ADM GLOBAL não está na Hub.IA'; END IF;

  -- Everton continua na Raízen?
  SELECT organization_id INTO v_org FROM public.operators WHERE email = v_everton_email LIMIT 1;
  IF v_org != v_raizen_org THEN RAISE EXCEPTION 'Regressão de identidade detectada: Everton não está na Raízen'; END IF;

  -- iCloud continua na Raízen?
  SELECT organization_id INTO v_org FROM public.operators WHERE email = v_icloud_email LIMIT 1;
  IF v_org != v_raizen_org THEN RAISE EXCEPTION 'Regressão de identidade detectada: iCloud não está na Raízen'; END IF;

END;
$$;

COMMIT;
