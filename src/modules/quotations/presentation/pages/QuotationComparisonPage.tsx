import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, FileText, PackageOpen, ShieldAlert, Trophy } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/infrastructure/supabase/client';
import {
  loadQuotationOverview,
  type QuotationItemDetails,
  type QuotationRequestDetails,
  type SupplierQuotationSummary,
} from '@/modules/quotations/infrastructure/repositories/SupabaseQuotationReadRepository';
import {
  buildSupplierMatrix,
  type SupplierMatrixCell,
} from '@/modules/quotations/presentation/viewModels/quotationComparisonViewModel';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';

type PriceRow = { supplier_quotation_id: string; quotation_item_id: string; unit_price: number | null; lead_time_days: number | null; status: string | null; refusal_reason: string | null; refusal_notes: string | null };
type RecommendationRow = { id: string; recommended_supplier_id: string; recommended_supplier_quotation_id: string; score: number; estimated_total_cost: number; reasons: string[]; risk_flags: string[]; model_version: string; policy_version: string; suppliers: Array<{ trade_name: string | null; legal_name: string }> };
type DecisionRow = { id: string; decision_type: string; approval_status: string | null };

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Não foi possível carregar a comparação.';
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function MatrixCellContent({ cell }: { cell: SupplierMatrixCell }) {
  if (cell.state === 'quoted') {
    return <><p className="text-base font-extrabold text-slate-900">{formatCurrency(cell.unitPrice)}</p><p className="mt-1 text-[11px] text-slate-500">{cell.leadTimeDays == null ? 'Prazo não informado' : `${cell.leadTimeDays} dias`}</p><p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-emerald-600">{cell.status}</p></>;
  }

  if (cell.state === 'refused') {
    return <><p className="text-xs font-bold text-rose-700">{cell.label}</p>{cell.refusalReason && <p className="mt-1 text-[11px] text-rose-600">{cell.refusalReason}</p>}{cell.refusalNotes && <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{cell.refusalNotes}</p>}{cell.status && <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-rose-500">{cell.status}</p>}</>;
  }

  return <><p className="text-xs font-semibold text-slate-500">{cell.label}</p>{cell.status && <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">{cell.status}</p>}</>;
}

export default function QuotationComparisonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState<QuotationRequestDetails | null>(null);
  const [items, setItems] = useState<QuotationItemDetails[]>([]);
  const [proposals, setProposals] = useState<SupplierQuotationSummary[]>([]);
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
    try {
      const [overview, recommendationResult, decisionResult] = await Promise.all([
        loadQuotationOverview(id),
        supabase.from('quotation_ai_recommendations').select('id, recommended_supplier_id, recommended_supplier_quotation_id, score, estimated_total_cost, reasons, risk_flags, model_version, policy_version, suppliers:recommended_supplier_id(trade_name, legal_name)').eq('quotation_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('quotation_decisions').select('id, decision_type, approval_status').eq('request_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle(),
      ]);
      const firstError = recommendationResult.error || decisionResult.error;
      if (firstError) throw firstError;

      const nextProposals = overview.recipients;
      const proposalIds = nextProposals.map(proposal => proposal.id);
      let nextPrices: PriceRow[] = [];
      if (proposalIds.length > 0) {
        const priceResult = await supabase.from('supplier_quotation_items').select('supplier_quotation_id, quotation_item_id, unit_price, lead_time_days, status, refusal_reason, refusal_notes').in('supplier_quotation_id', proposalIds);
        if (priceResult.error) throw priceResult.error;
        nextPrices = (priceResult.data ?? []) as PriceRow[];
      }
      setRequest(overview.request);
      setItems(overview.items);
      setProposals(nextProposals);
      setPrices(nextPrices);
      setRecommendation((recommendationResult.data as RecommendationRow | null) ?? null);
      setDecision((decisionResult.data as DecisionRow | null) ?? null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const supplierMatrix = useMemo(() => buildSupplierMatrix(items, proposals, prices), [items, proposals, prices]);
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
    <div className="space-y-6 max-w-7xl mx-auto relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Comparação de Propostas</h2>
          <p className="text-slate-500 text-sm">Cotação #{request.title} — {items.length} {items.length === 1 ? 'item' : 'itens'} · Solicitante: {request.requester_name_snapshot || 'não registrado'}</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/quotations')}>Voltar</Button>
      </div>

      <Card className="border-0 shadow-md bg-indigo-900">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full flex items-center justify-center shrink-0 bg-indigo-800">
              <Trophy className="h-6 w-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-indigo-200">Recomendação da Inteligência Hub.IA</p>
              {recommendation ? (
                <>
                  <h3 className="font-bold text-xl text-white">Fornecedor Recomendado: {recommendation.suppliers?.[0]?.trade_name || recommendation.suppliers?.[0]?.legal_name}</h3>
                  <p className="text-sm text-indigo-200 mt-0.5">{recommendation.reasons?.length ? recommendation.reasons.join(' · ') : 'Recomendação persistida sem justificativa textual.'}</p>
                  <p className="text-[10px] text-indigo-300 mt-2">Score persistido: {Number(recommendation.score).toFixed(1)} · Custo estimado: {formatCurrency(recommendation.estimated_total_cost)} · Modelo {recommendation.model_version} · Política {recommendation.policy_version}</p>
                </>
              ) : (
                <>
                  <h3 className="font-bold text-xl text-white">Aguardando análise real</h3>
                  <p className="text-sm text-indigo-200 mt-0.5">Nenhuma recomendação é exibida até existir snapshot versionado produzido sobre propostas reais.</p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-2xl border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <PackageOpen className="h-4 w-4 text-indigo-600" /> Itens da Cotação
            </h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            {items.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Nenhum item foi registrado para esta cotação.</p> : (
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-slate-400 text-[10px] uppercase font-bold border-b border-slate-100">
                  <tr><th className="px-6 py-3">Produto</th><th className="px-6 py-3">Fabricante / Código</th><th className="px-6 py-3 text-center">Qtd</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3"><p className="font-semibold text-slate-700">{item.product_name_snapshot || item.product_id}</p><p className="mt-0.5 text-[10px] text-slate-400">{item.category_name_snapshot || 'Categoria não registrada'} · SKU {item.internal_sku_snapshot || 'não registrado'}</p></td>
                      <td className="px-6 py-3 text-xs text-slate-500"><p>{item.manufacturer_name_snapshot || 'Não registrado'}</p><p className="mt-0.5 font-mono text-[10px]">{item.manufacturer_code_snapshot || 'Código não registrado'}</p></td>
                      <td className="px-6 py-3 text-center font-bold text-slate-600">{item.quantity} {item.unit_snapshot || item.unit || 'UN'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><FileText className="h-4 w-4 text-indigo-600" /> Observações</h3>
            </div>
            <CardContent className="p-5"><p className="text-xs text-slate-500 leading-relaxed">{request.notes || 'Nenhuma observação registrada.'}</p></CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Clock className="h-4 w-4 text-indigo-600" /> Histórico</h3>
            </div>
            <CardContent className="p-5"><p className="text-xs text-slate-500 leading-relaxed">Histórico detalhado ainda não disponível.</p></CardContent>
          </Card>
        </div>
      </div>

      {proposals.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-12 text-center">
            <AlertCircle className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">Nenhuma proposta persistida.</p>
            <p className="mt-1 text-xs text-slate-500">Valores, prazos, fornecedores e scores não serão simulados. Os itens da cotação permanecem visíveis acima.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full min-w-max text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold min-w-[280px]">Produto (Qtd)</th>
                {supplierMatrix.proposals.map(proposal => (
                  <th key={proposal.id} className="px-6 py-4 font-semibold text-center border-l border-slate-200 min-w-[220px]">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <span>{proposal.supplier_name}</span>
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">{proposal.status}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {supplierMatrix.rows.map(({ item, cells }) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4"><p className="font-semibold text-slate-900">{item.product_name_snapshot || item.product_id}</p><p className="text-xs text-slate-400 mt-0.5">{item.quantity} {item.unit_snapshot || item.unit || 'UN'} · SKU {item.internal_sku_snapshot || 'não registrado'}</p></td>
                  {cells.map(cell => <td key={cell.supplierQuotationId} className="px-6 py-4 text-center border-l border-slate-200"><MatrixCellContent cell={cell} /></td>)}
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                <td className="px-6 py-4 text-right text-xs font-extrabold uppercase tracking-wide text-slate-500">Valor Global:</td>
                {supplierMatrix.proposals.map(proposal => <td key={proposal.id} className="px-6 py-4 text-center text-base border-l border-slate-200 text-slate-900">{formatCurrency(proposal.total_amount)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {recommendation && proposals.some(proposal => proposal.status === 'submitted') && (
        <Card><CardContent className="space-y-4 p-6"><div><h3 className="font-bold text-slate-900">Decisão comercial</h3><p className="mt-1 text-xs text-slate-500">A recomendação é consultiva. Divergências exigem justificativa e aprovação segregada.</p></div>{decision && decision.approval_status !== 'rejected' ? <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /><div><p className="text-sm font-bold text-emerald-900">Decisão registrada</p><p className="mt-1 text-xs text-emerald-700">Tipo: {decision.decision_type} · aprovação: {decision.approval_status || 'não aplicável'}. A cotação não foi finalizada automaticamente.</p></div></div> : <>{decision?.approval_status === 'rejected' && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" /><div><p className="text-sm font-bold text-amber-900">Decisão anterior rejeitada</p><p className="mt-1 text-xs text-amber-700">O histórico foi preservado. Registre uma nova decisão para esta cotação.</p></div></div>}<div className="grid gap-3 md:grid-cols-2">{proposals.filter(proposal => proposal.status === 'submitted').map(proposal => <button key={proposal.id} onClick={() => setSelectedSupplierId(proposal.supplier_id)} className={`rounded-xl border p-4 text-left ${selectedSupplierId === proposal.supplier_id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}><p className="font-bold text-slate-900">{proposal.supplier_name}</p><p className="mt-1 text-xs text-slate-500">{proposal.total_amount == null ? 'Total não registrado' : Number(proposal.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>{proposal.supplier_id === recommendation.recommended_supplier_id && <p className="mt-2 text-[10px] font-bold uppercase text-indigo-600">Recomendado</p>}</button>)}</div>{isOverride && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-2 text-sm font-bold text-amber-900"><ShieldAlert className="h-5 w-5" /> Divergência da recomendação</div><select value={overrideReason} onChange={event => setOverrideReason(event.target.value)} className="h-10 w-full rounded-lg border border-amber-300 bg-white px-3 text-sm"><option value="">Selecione o motivo *</option><option value="prazo">Prazo</option><option value="qualidade">Qualidade</option><option value="relacionamento_comercial">Relacionamento comercial</option><option value="risco">Risco</option><option value="condicao_pagamento">Condição de pagamento</option><option value="outro">Outro</option></select><textarea value={justification} onChange={event => setJustification(event.target.value)} placeholder="Justificativa obrigatória *" className="min-h-24 w-full rounded-lg border border-amber-300 p-3 text-sm" />{financialDifference != null && <p className="text-xs text-amber-800">Diferença financeira: {financialDifference.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. O backend recalculará o valor ao registrar.</p>}</div>}<Button onClick={() => void recordDecision()} disabled={!selectedSupplierId || savingDecision || (isOverride && (!overrideReason || !justification.trim()))} className="bg-indigo-600 text-white">{savingDecision ? 'Registrando...' : isOverride ? 'Enviar para aprovação' : 'Registrar decisão'}</Button></>}</CardContent></Card>
      )}
    </div>
  );
}
