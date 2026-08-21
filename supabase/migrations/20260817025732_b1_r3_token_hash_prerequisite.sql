-- Pré-requisito de schema para token_hash (B1-R.3.4)
-- Necessário pois a migration 20260816233500_b1_r3_operator_invite_rpcs.sql tenta gravar nesta coluna antes da migration final de hash.

ALTER TABLE public.operator_invitations
ADD COLUMN IF NOT EXISTS token_hash text;
