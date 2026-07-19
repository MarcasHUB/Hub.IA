-- ==========================================
-- Migration: Adicionar campos de segurança na tabela invitations (Etapa 2)
-- ==========================================

-- Adiciona os campos com segurança (IF NOT EXISTS)
ALTER TABLE invitations 
    ADD COLUMN IF NOT EXISTS token_hash VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS email_error TEXT;

-- O token não pode ser nulo para novos convites, mas como pode haver dados antigos, 
-- não colocamos NOT NULL direto. Se precisar, podemos fazer um update.
