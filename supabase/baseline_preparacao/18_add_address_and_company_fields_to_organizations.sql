-- Migration 18: Add address and company fields to organizations

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS address_zip_code text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_neighborhood text,
  ADD COLUMN IF NOT EXISTS address_reference text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS profile_completion integer DEFAULT 0;
