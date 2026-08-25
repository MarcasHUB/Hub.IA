import { ShieldAlert } from 'lucide-react';
export default function SupportAdminView() {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
        <ShieldAlert className="w-6 h-6 text-indigo-600" />
        Painel de Suporte Global
      </h2>
      <p className="text-slate-600">Gestão de chamados de todas as empresas da rede Hub.IA.</p>
      {/* TODO: Integrate with support_tickets and support_messages */}
    </div>
  );
}
