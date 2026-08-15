-- supabase/migrations/20260803_hotfix_b5_2_operator_invitation_consistency.sql

-- 1. Resolver conflitos existentes em convites pendentes (viniciuscordebello@hotmail.com e outros)
DO $$
DECLARE
  v_email text;
  v_org_id uuid;
  v_keep_id uuid;
BEGIN
  FOR v_email, v_org_id IN
    SELECT lower(trim(email)), organization_id
    FROM public.operator_invitations
    WHERE status IN ('pendente', 'enviado')
    GROUP BY lower(trim(email)), organization_id
    HAVING count(*) > 1
  LOOP
    -- Pega o convite mais recente
    SELECT id INTO v_keep_id
    FROM public.operator_invitations
    WHERE lower(trim(email)) = v_email
      AND organization_id = v_org_id
      AND status IN ('pendente', 'enviado')
    ORDER BY created_at DESC
    LIMIT 1;

    -- Cancela os outros
    UPDATE public.operator_invitations
    SET status = 'cancelado',
        updated_at = now()
    WHERE lower(trim(email)) = v_email
      AND organization_id = v_org_id
      AND status IN ('pendente', 'enviado')
      AND id != v_keep_id;
  END LOOP;
END;
$$;

-- 2. Criar a constraint de unicidade para convites pendentes/enviados
DROP INDEX IF EXISTS unique_active_invite;
CREATE UNIQUE INDEX unique_active_invite 
ON public.operator_invitations (organization_id, lower(trim(email))) 
WHERE status IN ('pendente', 'enviado');

-- 3. Limpar duplicidades em operator_categories e garantir a unicidade
DO $$
BEGIN
  -- Deleta duplicados mantendo o mais antigo
  DELETE FROM public.operator_categories a USING (
    SELECT MIN(ctid) as ctid, operator_id, category_id
    FROM public.operator_categories
    GROUP BY operator_id, category_id
    HAVING COUNT(*) > 1
  ) b
  WHERE a.operator_id = b.operator_id
    AND a.category_id = b.category_id
    AND a.ctid <> b.ctid;
END;
$$;

ALTER TABLE public.operator_categories DROP CONSTRAINT IF EXISTS operator_categories_operator_id_category_id_key;
ALTER TABLE public.operator_categories ADD CONSTRAINT operator_categories_operator_id_category_id_key UNIQUE (operator_id, category_id);

-- 4. Função Transacional e Idempotente para Aceite de Convite
-- Substitui parte da lógica da Edge Function para garantir atomicidade.
-- A Edge Function continuará criando a senha no Auth, mas chamará esta RPC para o update.
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

  -- 1. Atualizar o operador (garantir idempotência baseada no ID do auth.users)
  UPDATE public.operators
  SET status = 'ativo',
      todas_categorias = COALESCE(v_invite.todas_categorias, false),
      accepted_at = v_now,
      updated_at = v_now
  WHERE id = p_user_id;

  -- 2. Inserir vínculos de categorias de forma idempotente
  IF v_invite.todas_categorias IS NOT TRUE AND array_length(v_invite.category_ids, 1) > 0 THEN
    FOREACH v_cat_id IN ARRAY v_invite.category_ids
    LOOP
      INSERT INTO public.operator_categories (operator_id, category_id)
      VALUES (p_user_id, v_cat_id)
      ON CONFLICT (operator_id, category_id) DO NOTHING;
    END LOOP;
  END IF;

  -- 3. Marcar o convite como aceito
  UPDATE public.operator_invitations
  SET status = 'aceito',
      accepted_at = v_now,
      ip_aceite = p_ip,
      user_agent_aceite = p_user_agent,
      updated_at = v_now
  WHERE id = v_invite.id;

  -- 4. Inserir logs (operation_logs)
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
