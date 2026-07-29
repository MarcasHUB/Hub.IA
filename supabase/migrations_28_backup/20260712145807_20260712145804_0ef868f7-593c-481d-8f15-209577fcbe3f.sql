
-- Colunas faltantes em companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS hub_classification text,
  ADD COLUMN IF NOT EXISTS profile_type text,
  ADD COLUMN IF NOT EXISTS company_visibility text DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS primary_cnae text,
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS business_activity text,
  ADD COLUMN IF NOT EXISTS business_description text,
  ADD COLUMN IF NOT EXISTS purchase_interests jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS products_supplied jsonb DEFAULT '[]'::jsonb;

-- Tabela global_invites (convites emitidos pelo super admin)
CREATE TABLE IF NOT EXISTS public.global_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text,
  email text NOT NULL,
  phone text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_invites TO authenticated;
GRANT ALL ON public.global_invites TO service_role;

ALTER TABLE public.global_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage global invites"
  ON public.global_invites
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
;
