-- Migration para adicionar a coluna deleted_at na tabela operators para o Soft Delete
ALTER TABLE public.operators 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Recarregar schema (opcional)
NOTIFY pgrst, 'reload schema';
