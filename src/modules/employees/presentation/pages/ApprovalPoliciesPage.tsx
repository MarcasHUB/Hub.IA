import React, { useState } from 'react';
import { Shield, AlertTriangle, Users, UserCheck } from 'lucide-react';

type UserRole = 'Operador' | 'Gestor' | 'Administrador';

type ApprovalPolicy = {
  id: string;
  name: string;
  threshold: string;
  requiresApprover: UserRole;
  enabled: boolean;
};

const INITIAL_POLICIES: ApprovalPolicy[] = [
  { id: 'pol-1', name: 'Compras até R$ 5.000', threshold: 'R$ 5.000', requiresApprover: 'Operador', enabled: true },
  { id: 'pol-2', name: 'Compras de R$ 5.001 a R$ 25.000', threshold: 'R$ 25.000', requiresApprover: 'Gestor', enabled: true },
  { id: 'pol-3', name: 'Compras acima de R$ 25.000', threshold: 'Acima de R$ 25.000', requiresApprover: 'Administrador', enabled: true },
];

function RoleBadge({ role }: { role: UserRole }) {
  if (role === 'Administrador') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200"><Shield className="h-3 w-3" /> Administrador</span>;
  }
  if (role === 'Gestor') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200"><UserCheck className="h-3 w-3" /> Gestor</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"><Users className="h-3 w-3" /> Operador</span>;
}

export default function ApprovalPoliciesPage() {
  const [policies, setPolicies] = useState<ApprovalPolicy[]>(INITIAL_POLICIES);

  const handleTogglePolicy = (id: string) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-indigo-800">Políticas de Aprovação por Valor</p>
          <p className="text-xs text-indigo-600 mt-0.5">Defina os limites financeiros de aprovação por perfil de usuário. Cotações que ultrapassarem o limite definido exigirão aprovação do perfil correspondente.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Faixa de Valor</th>
              <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Limite</th>
              <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Aprovador Requerido</th>
              <th className="px-6 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Ativo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {policies.map(pol => (
              <tr key={pol.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-semibold text-slate-800 text-xs">{pol.name}</td>
                <td className="px-6 py-4 font-bold text-indigo-700 text-xs font-mono">{pol.threshold}</td>
                <td className="px-6 py-4"><RoleBadge role={pol.requiresApprover} /></td>
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    <button
                      onClick={() => handleTogglePolicy(pol.id)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${pol.enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${pol.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-bold text-amber-800">Importante</p>
          <p className="text-[11px] text-amber-700 mt-0.5">As políticas de aprovação serão aplicadas em tempo real a partir do próximo envio de cotação. Valores já em andamento não são afetados retroativamente.</p>
        </div>
      </div>
    </div>
  );
}
