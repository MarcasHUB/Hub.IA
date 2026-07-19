-- ==========================================
-- Migration: Políticas RLS para operator_invitations
-- ==========================================

-- Habilitar RLS (caso não esteja habilitado)
ALTER TABLE operator_invitations ENABLE ROW LEVEL SECURITY;

-- Garante que os campos de status de e-mail existam
ALTER TABLE operator_invitations
    ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS email_error TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Remove as políticas antigas para evitar duplicidade (ignora erro se não existir)
DO $$
BEGIN
    DROP POLICY IF EXISTS "operator_invitations_org_select" ON operator_invitations;
    DROP POLICY IF EXISTS "operator_invitations_org_update" ON operator_invitations;
    DROP POLICY IF EXISTS "operator_invitations_org_insert" ON operator_invitations;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Policy de SELECT: Usuário autenticado só pode selecionar convites onde organization_id seja igual à do usuário
CREATE POLICY "operator_invitations_org_select"
ON operator_invitations
FOR SELECT
USING (
    organization_id = (
        SELECT organization_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1
    )
);

-- Policy de UPDATE: Usuário autenticado só pode atualizar convites da sua organização
CREATE POLICY "operator_invitations_org_update"
ON operator_invitations
FOR UPDATE
USING (
    organization_id = (
        SELECT organization_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1
    )
);

-- Policy de INSERT (Opcional, já que é feito via Edge Function com role admin, mas bom ter)
CREATE POLICY "operator_invitations_org_insert"
ON operator_invitations
FOR INSERT
WITH CHECK (
    organization_id = (
        SELECT organization_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1
    )
);
