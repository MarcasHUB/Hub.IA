import { supabase } from "@/infrastructure/supabase/client";

export function resolveOrganizationLogoUrl(
  logoUrl: string | null | undefined,
  organizationId?: string,
): string | null {
  if (!logoUrl) {
    return null;
  }

  if (
    logoUrl.startsWith("http") ||
    logoUrl.startsWith("data:") ||
    logoUrl.startsWith("blob:")
  ) {
    return logoUrl;
  }

  // Se já tem organizations/ no inicio, usa direto
  const path = logoUrl.startsWith("organizations/")
    ? logoUrl
    : organizationId
      ? `organizations/${organizationId}/${logoUrl}`
      : logoUrl;

  return supabase.storage.from("organization-logos").getPublicUrl(path).data
    .publicUrl;
}
