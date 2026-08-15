import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { Capability } from '@/core/config/permissions';
import { hasCapability } from '@/core/config/permissions';
import type { CanonicalRole } from '@/core/config/roles';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

export function CapabilityGuard({ capability, children }: { capability: Capability; children: ReactNode }) {
  const location = useLocation();
  const { data: identity, isLoading, isError } = useAuthenticatedIdentity();

  if (isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (isError || !identity) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const role: CanonicalRole | null = identity.isPlatformAdmin
    ? 'platform_admin'
    : identity.operatorProfile;

  if (!hasCapability(role, capability)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function IdentityGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: identity, isLoading, isError } = useAuthenticatedIdentity();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (isError || !identity) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
