-- Migration consolidada apos remote baseline
-- Delta restante: soft delete para materiais

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
