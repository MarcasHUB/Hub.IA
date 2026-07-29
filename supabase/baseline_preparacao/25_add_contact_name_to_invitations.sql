-- Adiciona as colunas contact_name e message na tabela invitations, caso não existam
ALTER TABLE public.invitations
ADD COLUMN IF NOT EXISTS contact_name varchar(255),
ADD COLUMN IF NOT EXISTS message text;
