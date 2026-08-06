export function resolveOrganizationLogoUrl(logoUrl: string | null | undefined, organizationId?: string): string | null {
  if (!logoUrl) {
    return null;
  }

  // Se já for uma URL completa (ex: http, https, data:image), retorna direto
  if (logoUrl.startsWith('http') || logoUrl.startsWith('data:')) {
    return logoUrl;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  if (logoUrl.startsWith('organizations/')) {
    return `${supabaseUrl}/storage/v1/object/public/organization-logos/${logoUrl}`;
  }

  if (organizationId) {
    return `${supabaseUrl}/storage/v1/object/public/organization-logos/organizations/${organizationId}/${logoUrl}`;
  }
  
  return null;
}
