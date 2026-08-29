import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Plus, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/infrastructure/supabase/client';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';
import { Button } from '@/shared/components/ui/Button';

type Tab = 'sent' | 'received' | 'drafts' | 'internal';
type QuotationRow = {
  id: string;
  title: string;
  status: string;
  request_type: 'BID' | 'DIRECT' | null;
  requester_name_snapshot: string | null;
  organization_id: string;
  target_organization_id: string | null;
  due_date: string | null;
  created_at: string;
  quotation_items: Array<{ count: number }>;
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  pending_quote: 'Aguardando propostas',
  closed: 'Finalizada',
  cancelled: 'Cancelada',
};

export default function QuotationsListPage() {
  const navigate = useNavigate();
  const { data: identity } = useAuthenticatedIdentity();
  const organizationId = identity?.organizationId || '';
  const [tab, setTab] = useState<Tab>('sent');
  const [rows, setRows] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('quotation_requests')
      .select('id, title, status, request_type, requester_name_snapshot, organization_id, target_organization_id, due_date, created_at, quotation_items(count)')
      .or(`organization_id.eq.${organizationId},target_organization_id.eq.${organizationId}`)
      .order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else setRows((data ?? []) as QuotationRow[]);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => rows.filter(row => {
    if (tab === 'received') return row.target_organization_id === organizationId;
    if (tab === 'drafts') return row.organization_id === organizationId && row.status === 'draft';
    if (tab === 'internal') return false;
    return row.organization_id === organizationId && row.status !== 'draft';
  }), [organizationId, rows, tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900"><FileText className="h-6 w-6 text-indigo-600" /> Cotações</h1><p className="mt-1 text-sm text-slate-500">Requisições e propostas persistidas no ambiente comercial.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" /> Atualizar</Button><Button onClick={() => navigate('/products')} className="bg-indigo-600 text-white"><Plus className="mr-2 h-4 w-4" /> Nova Cotação</Button></div>
      </div>

      <div className="flex overflow-x-auto rounded-xl border bg-white p-1">
        {([['sent', 'Enviadas'], ['received', 'Recebidas'], ['drafts', 'Rascunhos'], ['internal', 'Solicitações Internas']] as Array<[Tab, string]>).map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`rounded-lg px-4 py-2 text-xs font-bold ${tab === value ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{label}</button>)}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Cotações indisponíveis: {error}</div>}
      {loading ? <div className="rounded-xl border bg-white p-12 text-center text-sm text-slate-500">Carregando cotações reais...</div> : visible.length === 0 ? <div className="rounded-xl border bg-white p-12 text-center"><FileText className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Nenhum registro nesta visão.</p><p className="mt-1 text-xs text-slate-500">A lista permanece vazia até existir um registro correspondente no Supabase.</p></div> : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-5 py-3">Código</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Solicitante</th><th className="px-5 py-3">Itens</th><th className="px-5 py-3">Data</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y">{visible.map(row => <tr key={row.id} onClick={() => navigate(`/quotations/${row.id}/compare`)} className="cursor-pointer hover:bg-indigo-50/40"><td className="px-5 py-4 font-bold text-indigo-700">{row.title}</td><td className="px-5 py-4">{row.request_type || 'Legado'}</td><td className="px-5 py-4">{row.requester_name_snapshot || 'Não registrado'}</td><td className="px-5 py-4">{row.quotation_items?.[0]?.count ?? 0}</td><td className="px-5 py-4">{new Date(row.created_at).toLocaleDateString('pt-BR')}</td><td className="px-5 py-4"><span className="rounded-full border px-2 py-1 text-[10px] font-bold">{STATUS_LABEL[row.status] || row.status}</span></td></tr>)}</tbody></table>
        </div>
      )}
    </div>
  );
}
