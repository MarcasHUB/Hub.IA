-- B1-R.3.7: Fix email delivery status tracking for operator_invitations

-- Adicionar as colunas necessárias de rastreamento de e-mail de forma idempotente e segura
ALTER TABLE public.operator_invitations
ADD COLUMN IF NOT EXISTS email_delivery_status text,
ADD COLUMN IF NOT EXISTS email_error text;

-- Criar a RPC para o SupabaseOperatorRepository registrar a tentativa/entrega
CREATE OR REPLACE FUNCTION public.mark_operator_invitation_email_delivery(
  p_token_hash text,
  p_status text,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.operator_invitations%ROWTYPE;
  v_caller_org_id uuid;
BEGIN
  -- Validar identidade canônica
  SELECT organization_id INTO v_caller_org_id 
  FROM public.get_current_identity_context() 
  LIMIT 1;

  IF v_caller_org_id IS NULL THEN
    RAISE EXCEPTION 'OPERATOR_UNAUTHORIZED';
  END IF;

  -- Localizar convite
  SELECT * INTO v_invite
  FROM public.operator_invitations
  WHERE token_hash = p_token_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_NOT_FOUND';
  END IF;

  -- Impedir cross-tenant
  IF v_invite.organization_id <> v_caller_org_id THEN
    RAISE EXCEPTION 'OPERATOR_CROSS_TENANT_CONFLICT';
  END IF;

  -- Atualizar colunas recém-garantidas
  UPDATE public.operator_invitations
  SET email_delivery_status = p_status,
      email_error = p_error,
      updated_at = now()
  WHERE id = v_invite.id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_operator_invitation_email_delivery(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_operator_invitation_email_delivery(text, text, text) TO authenticated;
