import { useCallback, useEffect, useState } from 'react';
import { Building2, CalendarDays, FileText, PackageOpen, UserRound } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  loadQuotationOverview,
  type QuotationOverview,
} from '@/modules/quotations/infrastructure/repositories/SupabaseQuotationReadRepository';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  pending_quote: 'Aguardando propostas',
  closed: 'Finalizada',
  cancelled: 'Cancelada',
};

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Não foi possível carregar a cotação.';
}

function formatDate(value: string | null): string {
  if (!value) return 'Não informada';
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  return new Date(value).toLocaleDateString('pt-BR');
}

export default function QuotationDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<QuotationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setOverview(await loadQuotationOverview(id));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="rounded-xl border bg-white p-12 text-center text-sm text-slate-500">Carregando detalhes persistidos...</div>;
  if (error || !overview) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Detalhes indisponíveis: {error || 'Cotação não encontrada.'}</div>;

  const { request, items, recipients } = overview;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Detalhes da cotação</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">{request.title}</h1>
          <p className="mt-1 text-sm text-slate-500">Dados persistidos da solicitação, dos itens e dos destinatários.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/quotations')}>Voltar</Button>
          <Button onClick={() => navigate(`/quotations/${request.id}/compare`)} className="bg-indigo-600 text-white">Comparar propostas</Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-[10px] font-bold uppercase text-slate-400">Tipo</p><p className="mt-1 text-sm font-semibold text-slate-800">{request.request_type || 'Legado'}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-slate-400">Status</p><p className="mt-1 text-sm font-semibold text-slate-800">{STATUS_LABEL[request.status] || request.status}</p></div>
          <div><p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400"><UserRound className="h-3 w-3" /> Solicitante</p><p className="mt-1 text-sm font-semibold text-slate-800">{request.requester_name_snapshot || 'Não registrado'}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-slate-400">Prioridade</p><p className="mt-1 text-sm font-semibold text-slate-800">{request.priority_level || 'Não informada'}</p></div>
          <div><p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400"><CalendarDays className="h-3 w-3" /> Criada em</p><p className="mt-1 text-sm font-semibold text-slate-800">{formatDate(request.created_at)}</p></div>
          <div><p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400"><CalendarDays className="h-3 w-3" /> Data limite</p><p className="mt-1 text-sm font-semibold text-slate-800">{formatDate(request.due_date)}</p></div>
          <div className="sm:col-span-2"><p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400"><FileText className="h-3 w-3" /> Observações</p><p className="mt-1 text-sm text-slate-700">{request.notes || 'Nenhuma observação registrada.'}</p></div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b bg-slate-50 px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><PackageOpen className="h-4 w-4 text-indigo-600" /> Itens da cotação</h2>
        </div>
        <CardContent className="p-0">
          {items.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Nenhum item foi registrado para esta cotação.</p> : (
            <div className="divide-y">
              {items.map(item => (
                <article key={item.id} className="p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">{item.product_name_snapshot || item.product_id}</h3>
                      <p className="mt-1 text-xs text-slate-500">Categoria: {item.category_name_snapshot || 'Não registrada'}</p>
                    </div>
                    <p className="text-sm font-bold text-indigo-700">{item.quantity} {item.unit || item.unit_snapshot || 'UN'}</p>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-[10px] font-bold uppercase text-slate-400">Fabricante</dt><dd className="mt-1 text-slate-700">{item.manufacturer_name_snapshot || 'Não registrado'}</dd></div>
                    <div><dt className="text-[10px] font-bold uppercase text-slate-400">Código do fabricante</dt><dd className="mt-1 text-slate-700">{item.manufacturer_code_snapshot || 'Não registrado'}</dd></div>
                    <div><dt className="text-[10px] font-bold uppercase text-slate-400">Código interno da empresa</dt><dd className="mt-1 text-slate-700">{item.internal_sku_snapshot || 'Não informado'}</dd></div>
                    <div><dt className="text-[10px] font-bold uppercase text-slate-400">Unidade do snapshot</dt><dd className="mt-1 text-slate-700">{item.unit_snapshot || item.unit || 'Não registrada'}</dd></div>
                  </dl>
                  <p className="mt-4 text-sm text-slate-600">{item.description_snapshot || 'Sem descrição registrada.'}</p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b bg-slate-50 px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Building2 className="h-4 w-4 text-indigo-600" /> Destinatários</h2>
        </div>
        <CardContent className="p-0">
          {recipients.length === 0 ? <p className="p-8 text-center text-sm font-medium text-slate-600">Nenhum destinatário foi registrado para esta cotação.</p> : (
            <div className="divide-y">
              {recipients.map(recipient => (
                <div key={recipient.id} className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-semibold text-slate-900">{recipient.supplier_name}</p><p className="mt-1 text-xs text-slate-500">Proposta {recipient.id}</p></div>
                  <div className="text-left sm:text-right"><p className="text-xs font-bold uppercase text-slate-600">{recipient.status}</p><p className="mt-1 text-xs text-slate-400">{recipient.submitted_at ? `Enviada em ${formatDate(recipient.submitted_at)}` : 'Ainda não enviada'}</p></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
