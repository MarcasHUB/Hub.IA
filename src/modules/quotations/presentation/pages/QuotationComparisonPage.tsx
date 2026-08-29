import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, PackageOpen, ShieldAlert } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/infrastructure/supabase/client';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';

type RequestRow = { id: string; title: string; status: string; notes: string | null; created_at: string; requester_name_snapshot: string | null };
type ItemRow = { id: string; product_id: string; quantity: number; unit: string; product_name_snapshot: string | null; internal_sku_snapshot: string | null };
type ProposalRow = { id: string; supplier_id: string; status: string; total_amount: number | null; submitted_at: string | null; suppliers: Array<{ trade_name: string | null; legal_name: string }> };
type PriceRow = { supplier_quotation_id: string; quotation_item_id: string; unit_price: number | null; lead_time_days: number | null; status: string | null };
type RecommendationRow = { id: string; recommended_supplier_id: string; recommended_supplier_quotation_id: string; score: number; estimated_total_cost: number; reasons: string[]; risk_flags: string[]; model_version: string; policy_version: string; suppliers: Array<{ trade_name: string | null; legal_name: string }> };
type DecisionRow = { id: string; decision_type: string; approval_status: string | null };

export default function QuotationComparisonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [recommendation, setRecommendation] = useState<RecommendationRow | null>(null);
  const [decision, setDecision] = useState<DecisionRow | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [justification, setJustification] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    const [requestResult, itemsResult, proposalResult, recommendationResult, decisionResult] = await Promise.all([
      supabase.from('quotation_requests').select('id, title, status, notes, created_at, requester_name_snapshot').eq('id', id).single(),
      supabase.from('quotation_items').select('id, product_id, quantity, unit, product_name_snapshot, internal_sku_snapshot').eq('request_id', id).order('created_at'),
      supabase.from('supplier_quotations').select('id, supplier_id, status, total_amount, submitted_at, suppliers(trade_name, legal_name)').eq('request_id', id).order('created_at'),
      supabase.from('quotation_ai_recommendations').select('id, recommended_supplier_id, recommended_supplier_quotation_id, score, estimated_total_cost, reasons, risk_flags, model_version, policy_version, suppliers:recommended_supplier_id(trade_name, legal_name)').eq('quotation_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('quotation_decisions').select('id, decision_type, approval_status').eq('request_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const firstError = requestResult.error || itemsResult.error || proposalResult.error || recommendationResult.error || decisionResult.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    const nextProposals = (proposalResult.data ?? []) as ProposalRow[];
    const proposalIds = nextProposals.map(proposal => proposal.id);
    let nextPrices: PriceRow[] = [];
    if (proposalIds.length > 0) {
      const priceResult = await supabase.from('supplier_quotation_items').select('supplier_quotation_id, quotation_item_id, unit_price, lead_time_days, status').in('supplier_quotation_id', proposalIds);
      if (priceResult.error) setError(priceResult.error.message);
      else nextPrices = (priceResult.data ?? []) as PriceRow[];
    }
    setRequest(requestResult.data as RequestRow);
    setItems((itemsResult.data ?? []) as ItemRow[]);
    setProposals(nextProposals);
    setPrices(nextPrices);
    setRecommendation((recommendationResult.data as RecommendationRow | null) ?? null);
    setDecision((decisionResult.data as DecisionRow | null) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const priceMap = useMemo(() => new Map(prices.map(price => [`${price.supplier_quotation_id}:${price.quotation_item_id}`, price])), [prices]);
  const selectedProposal = proposals.find(proposal => proposal.supplier_id === selectedSupplierId);
  const isOverride = Boolean(recommendation && selectedSupplierId && selectedSupplierId !== recommendation.recommended_supplier_id);
  const financialDifference = selectedProposal?.total_amount == null || recommendation == null ? null : Number(selectedProposal.total_amount) - Number(recommendation.estimated_total_cost);

  const recordDecision = async () => {
    if (!id || !selectedSupplierId || !recommendation) return;
    if (isOverride && (!overrideReason.trim() || !justification.trim())) { setError('Motivo e justificativa são obrigatórios para divergir da recomendação.'); return; }
    setSavingDecision(true);
    setError('');
    const { data, error: decisionError } = await supabase.rpc('record_quotation_decision', {
      p_request_id: id,
      p_winner_supplier_id: selectedSupplierId,
      p_override_reason: isOverride ? overrideReason.trim() : null,
      p_justification: justification.trim() || null,
    });
    if (decisionError) setError(decisionError.message);
    else setDecision(data as DecisionRow);
    setSavingDecision(false);
  };
  if (loading) return <div className="rounded-xl border bg-white p-12 text-center text-sm text-slate-500">Carregando comparação persistida...</div>;
  if (error || !request) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Comparação indisponível: {error || 'Cotação não encontrada.'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between"><div><h1 className="text-2xl font-extrabold text-slate-900">Comparação de Propostas</h1><p className="mt-1 text-sm text-slate-500">Cotação {request.title} · {items.length} itens · Solicitante: {request.requester_name_snapshot || 'não registrado'}</p></div><Button variant="outline" onClick={() => navigate('/quotations')}>Voltar</Button></div>

      <Card className="border-indigo-200 bg-indigo-950 text-white"><CardContent className="p-6"><p className="text-xs font-bold uppercase tracking-wider text-indigo-300">Recomendação Hub.IA</p>{recommendation ? <><h2 className="mt-2 text-lg font-bold">{recommendation.suppliers?.[0]?.trade_name || recommendation.suppliers?.[0]?.legal_name}</h2><p className="mt-1 text-sm text-indigo-200">Score {Number(recommendation.score).toFixed(1)} · custo estimado {Number(recommendation.estimated_total_cost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p><p className="mt-2 text-xs text-indigo-300">Modelo {recommendation.model_version} · política {recommendation.policy_version}</p></> : <><h2 className="mt-2 text-lg font-bold">Aguardando análise real</h2><p className="mt-1 text-sm text-indigo-200">Nenhuma recomendação é exibida até existir snapshot versionado produzido sobre propostas reais.</p></>}</CardContent></Card>

      <Card><CardContent className="p-5"><h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><FileText className="h-4 w-4 text-indigo-600" /> Observações</h3><p className="mt-3 text-sm text-slate-600">{request.notes || 'Nenhuma observação registrada.'}</p></CardContent></Card>

      {proposals.length === 0 ? <div className="rounded-xl border bg-white p-12 text-center"><AlertCircle className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700">Nenhuma proposta persistida.</p><p className="mt-1 text-xs text-slate-500">Valores, prazos e scores não serão simulados.</p></div> : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50"><tr><th className="px-5 py-4"><span className="flex items-center gap-2"><PackageOpen className="h-4 w-4" /> Material</span></th>{proposals.map(proposal => <th key={proposal.id} className="border-l px-5 py-4 text-center">{proposal.suppliers?.[0]?.trade_name || proposal.suppliers?.[0]?.legal_name}<span className="mt-1 block text-[10px] font-normal uppercase text-slate-400">{proposal.status}</span></th>)}</tr></thead><tbody className="divide-y">{items.map(item => <tr key={item.id}><td className="px-5 py-4"><p className="font-semibold text-slate-800">{item.product_name_snapshot || item.product_id}</p><p className="mt-1 text-xs text-slate-500">{item.quantity} {item.unit} · SKU {item.internal_sku_snapshot || 'não registrado'}</p></td>{proposals.map(proposal => { const price = priceMap.get(`${proposal.id}:${item.id}`); return <td key={proposal.id} className="border-l px-5 py-4 text-center">{price?.unit_price != null ? <><p className="font-bold text-slate-900">{Number(price.unit_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p><p className="mt-1 text-xs text-slate-500">{price.lead_time_days == null ? 'Prazo não informado' : `${price.lead_time_days} dias`}</p></> : <span className="text-xs text-slate-400">Não cotado</span>}</td>; })}</tr>)}<tr className="bg-slate-50 font-bold"><td className="px-5 py-4 text-right text-xs uppercase text-slate-500">Total persistido</td>{proposals.map(proposal => <td key={proposal.id} className="border-l px-5 py-4 text-center">{proposal.total_amount == null ? '—' : Number(proposal.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>)}</tr></tbody></table></div>
      )}

      {recommendation && proposals.some(proposal => proposal.status === 'submitted') && (
        <Card><CardContent className="space-y-4 p-6"><div><h3 className="font-bold text-slate-900">Decisão comercial</h3><p className="mt-1 text-xs text-slate-500">A recomendação é consultiva. Divergências exigem justificativa e aprovação segregada.</p></div>{decision && decision.approval_status !== 'rejected' ? <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /><div><p className="text-sm font-bold text-emerald-900">Decisão registrada</p><p className="mt-1 text-xs text-emerald-700">Tipo: {decision.decision_type} · aprovação: {decision.approval_status || 'não aplicável'}. A cotação não foi finalizada automaticamente.</p></div></div> : <>{decision?.approval_status === 'rejected' && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" /><div><p className="text-sm font-bold text-amber-900">Decisão anterior rejeitada</p><p className="mt-1 text-xs text-amber-700">O histórico foi preservado. Registre uma nova decisão para esta cotação.</p></div></div>}<div className="grid gap-3 md:grid-cols-2">{proposals.filter(proposal => proposal.status === 'submitted').map(proposal => <button key={proposal.id} onClick={() => setSelectedSupplierId(proposal.supplier_id)} className={`rounded-xl border p-4 text-left ${selectedSupplierId === proposal.supplier_id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}><p className="font-bold text-slate-900">{proposal.suppliers?.[0]?.trade_name || proposal.suppliers?.[0]?.legal_name}</p><p className="mt-1 text-xs text-slate-500">{proposal.total_amount == null ? 'Total não registrado' : Number(proposal.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>{proposal.supplier_id === recommendation.recommended_supplier_id && <p className="mt-2 text-[10px] font-bold uppercase text-indigo-600">Recomendado</p>}</button>)}</div>{isOverride && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-2 text-sm font-bold text-amber-900"><ShieldAlert className="h-5 w-5" /> Divergência da recomendação</div><select value={overrideReason} onChange={event => setOverrideReason(event.target.value)} className="h-10 w-full rounded-lg border border-amber-300 bg-white px-3 text-sm"><option value="">Selecione o motivo *</option><option value="prazo">Prazo</option><option value="qualidade">Qualidade</option><option value="relacionamento_comercial">Relacionamento comercial</option><option value="risco">Risco</option><option value="condicao_pagamento">Condição de pagamento</option><option value="outro">Outro</option></select><textarea value={justification} onChange={event => setJustification(event.target.value)} placeholder="Justificativa obrigatória *" className="min-h-24 w-full rounded-lg border border-amber-300 p-3 text-sm" />{financialDifference != null && <p className="text-xs text-amber-800">Diferença financeira: {financialDifference.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. O backend recalculará o valor ao registrar.</p>}</div>}<Button onClick={() => void recordDecision()} disabled={!selectedSupplierId || savingDecision || (isOverride && (!overrideReason || !justification.trim()))} className="bg-indigo-600 text-white">{savingDecision ? 'Registrando...' : isOverride ? 'Enviar para aprovação' : 'Registrar decisão'}</Button></>}</CardContent></Card>
      )}
    </div>
  );
}
