import { supabase } from '@/infrastructure/supabase/client';

export const ORGANIZATION_LOGO_BUCKET = 'organization-logos';

export function resolveOrganizationLogoUrl(
  logoPath?: string | null,
): string | null {
  if (!logoPath) return null;

  if (
    logoPath.startsWith('http://') ||
    logoPath.startsWith('https://') ||
    logoPath.startsWith('blob:')
  ) {
    return logoPath;
  }

  return supabase.storage
    .from(ORGANIZATION_LOGO_BUCKET)
    .getPublicUrl(logoPath).data.publicUrl;
}
