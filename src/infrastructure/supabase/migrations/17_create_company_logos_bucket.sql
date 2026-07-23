-- ==========================================
-- Migration 17: Create Company Logos Bucket
-- ==========================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public reading
CREATE POLICY "Public Access for Company Logos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'company-logos' );

-- Policies for authenticated inserts
CREATE POLICY "Auth Insert for Company Logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK ( bucket_id = 'company-logos' );

-- Policies for authenticated updates
CREATE POLICY "Auth Update for Company Logos"
ON storage.objects FOR UPDATE TO authenticated
USING ( bucket_id = 'company-logos' );
