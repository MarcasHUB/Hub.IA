-- Add updated_at column to operator_invitations (B1-R.3.6)
ALTER TABLE public.operator_invitations
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
