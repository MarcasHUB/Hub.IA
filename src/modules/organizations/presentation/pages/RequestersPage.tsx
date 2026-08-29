import { useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

type Requester = {
  user_id: string;
  full_name: string | null;
  department: string | null;
  cost_center: string | null;
  manager_id: string | null;
  status: string | null;
};

export default function RequestersPage() {
  const { data: identity } = useAuthenticatedIdentity();
  const [rows, setRows] = useState<Requester[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!identity?.organizationId) return;
    supabase
      .from('profiles')
      .select('user_id, full_name, department, cost_center, manager_id, status')
      .eq('organization_id', identity.organizationId)
      .order('full_name')
      .then(({ data, error: queryError }) => {
        if (queryError) setError(queryError.message);
        else setRows((data ?? []) as Requester[]);
      });
  }, [identity?.organizationId]);

  const names = new Map(rows.map(row => [row.user_id, row.full_name || row.user_id]));

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800"><UserCheck className="h-5 w-5 text-indigo-600" /> Solicitantes</h2>
        <p className="mt-1 text-sm text-slate-500">Contexto de compra dos usuários existentes, sem duplicar identidades.</p>
      </div>
      {error ? <p className="m-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : (
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-5 py-3">Nome</th><th className="px-5 py-3">Departamento</th><th className="px-5 py-3">Centro de custo</th><th className="px-5 py-3">Gestor</th><th className="px-5 py-3">Status</th></tr></thead>
          <tbody className="divide-y">{rows.map(row => <tr key={row.user_id}><td className="px-5 py-4 font-semibold text-slate-800">{row.full_name || 'Nome não informado'}</td><td className="px-5 py-4">{row.department || 'Não informado'}</td><td className="px-5 py-4">{row.cost_center || 'Não informado'}</td><td className="px-5 py-4">{row.manager_id ? names.get(row.manager_id) || row.manager_id : 'Não informado'}</td><td className="px-5 py-4">{row.status || 'Não informado'}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}
