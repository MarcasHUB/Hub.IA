import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, MonitorX, Smartphone } from 'lucide-react';
import type { Capability } from '@/core/config/permissions';
import { canIdentity } from '@/core/config/permissions';
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

  if (!canIdentity(identity, capability)) {
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
  if (!identity.isActive || identity.accessChannel === 'disabled') {
    return <Navigate to="/login?reason=access_disabled" replace />;
  }
  if (identity.accessChannel === 'mobile') {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}

export function MobileIdentityGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: identity, isLoading, isError } = useAuthenticatedIdentity();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (isError || !identity) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!identity.isActive || identity.accessChannel === 'disabled') {
    return <Navigate to="/login?reason=access_disabled" replace />;
  }
  if (identity.accessChannel === 'web') {
    return <Navigate to="/dashboard" replace />;
  }

  if (identity.accessChannel === 'mobile') {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const iPadDesktopMode = /Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
    const isPhoneOrTablet = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || iPadDesktopMode;

    if (!isPhoneOrTablet) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <MonitorX className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-xl font-black text-slate-900">Acesso exclusivo pelo App Campo</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Este usuário está configurado como Mobile/PWA. Abra o SupplyHub em um celular ou tablet para acessar suas solicitações.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-indigo-700">
              <Smartphone className="h-4 w-4" /> supplyhub.ia.br/pwa-choice
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
