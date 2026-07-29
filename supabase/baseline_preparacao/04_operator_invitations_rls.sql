-- ==========================================
-- Migration: Políticas RLS para operator_invitations
-- ==========================================

-- Habilitar RLS
ALTER TABLE public.operator_invitations ENABLE ROW LEVEL SECURITY;

-- Garante que os campos de status de e-mail existam
ALTER TABLE public.operator_invitations
    ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS email_error TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Remove policies antigas para evitar duplicidade
DROP POLICY IF EXISTS "operator_invitations_org_select" ON public.operator_invitations;
DROP POLICY IF EXISTS "operator_invitations_org_update" ON public.operator_invitations;
DROP POLICY IF EXISTS "operator_invitations_org_insert" ON public.operator_invitations;

-- SELECT: usuário autenticado só pode ler convites da própria organização
CREATE POLICY "operator_invitations_org_select"
ON public.operator_invitations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = operator_invitations.organization_id
    )
);

-- UPDATE: usuário autenticado só pode atualizar convites da própria organização
CREATE POLICY "operator_invitations_org_update"
ON public.operator_invitations
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = operator_invitations.organization_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = operator_invitations.organization_id
    )
);

-- INSERT: usuário autenticado só pode inserir convites na própria organização
CREATE POLICY "operator_invitations_org_insert"
ON public.operator_invitations
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = operator_invitations.organization_id
    )
);
