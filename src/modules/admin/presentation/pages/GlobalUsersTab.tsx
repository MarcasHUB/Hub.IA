import { ShieldAlert } from 'lucide-react';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

export default function GlobalUsersTab() {
  const { data: identity, isLoading } = useAuthenticatedIdentity();

  if (isLoading) return <div className="p-6 text-slate-500">Validando autoridade global...</div>;
  if (!identity?.isPlatformAdmin) {
    return <div className="p-6 text-red-700">Acesso negado.</div>;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <div className="flex items-center gap-2 font-bold"><ShieldAlert className="h-5 w-5" /> Governança de administradores globais</div>
      <p className="mt-2 text-sm">
        A autoridade global é mantida exclusivamente em platform_admins. A alteração direta de profiles.is_super_admin foi removida desta interface.
      </p>
    </div>
  );
}
