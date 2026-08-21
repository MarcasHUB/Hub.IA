-- Migration for Operator Invite Hash Schema B1-R.3
-- Ensures token_hash exists, backfills legacy tokens securely, and updates accept-invite RPC.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='operator_invitations' AND column_name='token_hash') THEN
    ALTER TABLE public.operator_invitations ADD COLUMN token_hash text;
  END IF;
END $$;

-- Enable pgcrypto if it's not enabled (safe in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Backfill legacy token hashes securely for pending invites
UPDATE public.operator_invitations
SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL 
  AND token IS NOT NULL 
  AND status = 'pendente';

-- Create unique index on token_hash for pending invites to prevent duplicates and accelerate lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_invitations_token_hash 
ON public.operator_invitations(token_hash) 
WHERE status = 'pendente';

-- Drop the legacy function that takes p_token
DROP FUNCTION IF EXISTS public.accept_operator_invitation_transactional(text, uuid, text, text);

-- Recreate function expecting p_token_hash
CREATE OR REPLACE FUNCTION public.accept_operator_invitation_transactional(
  p_token_hash text,
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
  v_invite public.operator_invitations%ROWTYPE;
  v_app_role public.app_role;
  v_user_email text;
BEGIN
  SELECT * INTO v_invite
  FROM public.operator_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'OPERATOR_INVITE_NOT_FOUND'; END IF;
  IF v_invite.status = 'aceito' THEN RETURN true; END IF;
  IF v_invite.status <> 'pendente' THEN RAISE EXCEPTION 'OPERATOR_INVITE_NOT_PENDING'; END IF;
  IF v_invite.expires_at <= now() THEN RAISE EXCEPTION 'OPERATOR_INVITE_EXPIRED'; END IF;

  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = p_user_id;
  IF v_user_email IS DISTINCT FROM lower(v_invite.email) THEN
    RAISE EXCEPTION 'OPERATOR_INVITE_EMAIL_MISMATCH';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
      AND organization_id IS NOT NULL
      AND organization_id <> v_invite.organization_id
  ) OR EXISTS (
    SELECT 1 FROM public.operators
    WHERE id = p_user_id
      AND organization_id <> v_invite.organization_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND organization_id <> v_invite.organization_id
  ) THEN
    RAISE EXCEPTION 'OPERATOR_CROSS_TENANT_CONFLICT';
  END IF;

  v_app_role := CASE v_invite.perfil
    WHEN 'administrador' THEN 'admin'::public.app_role
    WHEN 'comprador' THEN 'buyer'::public.app_role
    WHEN 'gestor' THEN 'supplier_manager'::public.app_role
    WHEN 'solicitante' THEN 'requester'::public.app_role
    WHEN 'auditor' THEN 'auditor'::public.app_role
    ELSE NULL
  END;

  IF v_app_role IS NULL THEN RAISE EXCEPTION 'OPERATOR_ROLE_INVALID'; END IF;

  INSERT INTO public.profiles (user_id, organization_id, full_name, email, updated_at)
  VALUES (p_user_id, v_invite.organization_id, v_invite.nome, v_invite.email, now())
  ON CONFLICT (user_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = coalesce(nullif(public.profiles.full_name, ''), EXCLUDED.full_name),
    email = EXCLUDED.email,
    updated_at = now();

  UPDATE public.operators
  SET status = 'ativo',
      organization_id = v_invite.organization_id,
      accepted_at = now(),
      updated_at = now(),
      deleted_at = NULL
  WHERE id = p_user_id
    AND organization_id = v_invite.organization_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'OPERATOR_IDENTITY_INCOMPLETE'; END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id
    AND organization_id = v_invite.organization_id;

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (p_user_id, v_invite.organization_id, v_app_role);

  UPDATE public.operator_invitations
  SET status = 'aceito',
      accepted_at = now(),
      updated_at = now(),
      ip_aceite = left(p_ip, 128),
      user_agent_aceite = left(p_user_agent, 512)
  WHERE id = v_invite.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_operator_invitation_transactional(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_operator_invitation_transactional(text, uuid, text, text) TO service_role;
