import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Inbox } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/infrastructure/supabase/client';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';

type RequestRow = { id: string; title: string; due_date: string | null; notes: string | null; requester_name_snapshot: string | null };
type ItemRow = { id: string; quantity: number; unit: string; product_name_snapshot: string | null; manufacturer_code_snapshot: string | null };
type ProposalRow = { id: string; request_id: string; status: string };
type Offer = { unitPrice: string; leadTimeDays: string };

export default function QuotationResponsePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [proposal, setProposal] = useState<ProposalRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [offers, setOffers] = useState<Record<string, Offer>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [requestResult, itemsResult, proposalResult] = await Promise.all([
      supabase.from('quotation_requests').select('id, title, due_date, notes, requester_name_snapshot').eq('id', id).single(),
      supabase.from('quotation_items').select('id, quantity, unit, product_name_snapshot, manufacturer_code_snapshot').eq('request_id', id).order('created_at'),
      supabase.from('supplier_quotations').select('id, request_id, status').eq('request_id', id).limit(1).maybeSingle(),
    ]);
    const firstError = requestResult.error || itemsResult.error || proposalResult.error;
    if (firstError) setError(firstError.message);
    else if (!proposalResult.data) setError('Esta cotação não possui uma proposta atribuída à sua identidade de fornecedor.');
    else {
      const nextItems = (itemsResult.data ?? []) as ItemRow[];
      setRequest(requestResult.data as RequestRow);
      setProposal(proposalResult.data as ProposalRow);
      setItems(nextItems);
      setOffers(Object.fromEntries(nextItems.map(item => [item.id, { unitPrice: '', leadTimeDays: '' }])));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  const total = useMemo(() => items.reduce((sum, item) => sum + Number(offers[item.id]?.unitPrice || 0) * Number(item.quantity), 0), [items, offers]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!proposal || items.some(item => Number(offers[item.id]?.unitPrice) <= 0 || Number(offers[item.id]?.leadTimeDays) < 0)) { setError('Informe preço e prazo válidos para todos os itens.'); return; }
    setSaving(true);
    setError('');
    const rows = items.map(item => ({ supplier_quotation_id: proposal.id, quotation_item_id: item.id, unit_price: Number(offers[item.id].unitPrice), lead_time_days: Number(offers[item.id].leadTimeDays), status: 'quoted' }));
    const itemResult = await supabase.from('supplier_quotation_items').upsert(rows, { onConflict: 'supplier_quotation_id,quotation_item_id' });
    if (itemResult.error) setError(itemResult.error.message);
    else {
      const proposalResult = await supabase.from('supplier_quotations').update({ status: 'submitted', total_amount: total, submitted_at: new Date().toISOString() }).eq('id', proposal.id);
      if (proposalResult.error) setError(proposalResult.error.message); else setSuccess(true);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-12 text-center text-sm text-slate-500">Carregando solicitação real...</div>;
  if (error && !request) return <div className="flex flex-col items-center py-20 text-center"><AlertTriangle className="h-12 w-12 text-red-400" /><p className="mt-4 font-bold text-slate-900">Cotação indisponível</p><p className="mt-1 max-w-lg text-sm text-slate-500">{error}</p><Button onClick={() => navigate('/quotations')} className="mt-4">Voltar</Button></div>;
  if (!request || !proposal) return null;

  return <div className="mx-auto max-w-3xl space-y-6"><button onClick={() => navigate('/quotations')} className="flex items-center gap-1 text-xs font-bold text-slate-500"><ArrowLeft className="h-4 w-4" /> Voltar para Cotações</button><div className="flex items-center justify-between rounded-2xl border bg-white p-6"><div><Badge>Responder Cotação Recebida</Badge><h2 className="mt-2 text-xl font-extrabold text-slate-900">{request.title}</h2><p className="mt-1 text-xs text-slate-500">Solicitante: {request.requester_name_snapshot || 'não registrado'}</p></div><Inbox className="h-10 w-10 text-violet-500" /></div>{success ? <div className="rounded-2xl border bg-white p-8 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-green-500" /><h3 className="mt-3 text-lg font-bold">Proposta persistida</h3><p className="mt-2 text-sm text-slate-500">Total enviado: {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p><Button onClick={() => navigate('/quotations')} className="mt-5">Concluir</Button></div> : <form onSubmit={event => void submit(event)} className="overflow-hidden rounded-2xl border bg-white"><div className="border-b bg-slate-50 p-6"><p className="text-sm text-slate-600">{request.notes || 'Sem observações adicionais.'}</p>{request.due_date && <p className="mt-2 text-xs font-semibold text-slate-500">Entrega desejada: {new Date(`${request.due_date}T00:00:00`).toLocaleDateString('pt-BR')}</p>}</div><div className="space-y-4 p-6">{items.map(item => <div key={item.id} className="rounded-xl border p-4"><p className="font-bold text-slate-800">{item.product_name_snapshot || item.id}</p><p className="mt-1 text-xs text-slate-500">Solicitado: {item.quantity} {item.unit} · Cód. fabricante: {item.manufacturer_code_snapshot || 'não registrado'}</p><div className="mt-4 grid grid-cols-2 gap-4"><div><label className="mb-1 block text-xs font-bold text-slate-500">Preço unitário *</label><Input type="number" min="0.01" step="0.01" value={offers[item.id]?.unitPrice || ''} onChange={event => setOffers(current => ({ ...current, [item.id]: { ...current[item.id], unitPrice: event.target.value } }))} /></div><div><label className="mb-1 block text-xs font-bold text-slate-500">Prazo em dias *</label><Input type="number" min="0" value={offers[item.id]?.leadTimeDays || ''} onChange={event => setOffers(current => ({ ...current, [item.id]: { ...current[item.id], leadTimeDays: event.target.value } }))} /></div></div></div>)}{error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}</div><div className="flex items-center justify-between border-t bg-slate-50 px-6 py-4"><p className="font-bold text-slate-800">Total: {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p><Button type="submit" disabled={saving} className="bg-violet-600 text-white">{saving ? 'Enviando...' : 'Enviar Proposta'}</Button></div></form>}</div>;
}
