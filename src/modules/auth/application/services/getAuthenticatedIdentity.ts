import { supabase } from '@/infrastructure/supabase/client';
import type { TenantOperatorProfile } from '@/core/config/roles';

export interface AuthenticatedIdentity {
  userId: string;
  organizationId: string;
  fullName: string;
  avatarUrl: string | null;
  isPlatformAdmin: boolean;
  operatorProfile: TenantOperatorProfile | null;
  appRole: string | null;
  organizationName: string;
  organizationLogoUrl: string | null;
}

interface IdentityContextRow {
  user_id: string;
  organization_id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_super_admin: boolean;
  operator_profile: string | null;
  app_role: string | null;
  organization_name: string | null;
  organization_logo_url: string | null;
}

export async function getAuthenticatedIdentity(expectedUserId?: string): Promise<AuthenticatedIdentity> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('AUTH_SESSION_INVALID');

  const { data: rawData, error } = await supabase.rpc('get_current_identity_context');
  const data = (Array.isArray(rawData) ? rawData[0] : rawData) as IdentityContextRow | null;

  if (
    error
    || !data
    || data.user_id !== userData.user.id
    || (expectedUserId && data.user_id !== expectedUserId)
  ) {
    throw new Error('AUTH_IDENTITY_INCONSISTENT');
  }

  return {
    userId: data.user_id,
    organizationId: data.organization_id,
    fullName: data.full_name || userData.user.email || 'Usuário',
    avatarUrl: data.avatar_url || null,
    isPlatformAdmin: Boolean(data.is_super_admin),
    operatorProfile: (data.operator_profile as TenantOperatorProfile | null) || null,
    appRole: data.app_role || null,
    organizationName: data.organization_name || 'Empresa',
    organizationLogoUrl: data.organization_logo_url || null,
  };
}
