import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';
import { Button } from '@/shared/components/ui/Button';

type Approval = { id: string; status: string; requested_at: string; requester_user_id: string; quotation_requests: Array<{ title: string }>; quotation_decisions: Array<{ financial_impact: number | null; financial_impact_percent: number | null; override_reason: string | null; justification: string | null }> };

export default function QuotationApprovalsPage() {
  const { data: identity } = useAuthenticatedIdentity();
  const [rows, setRows] = useState<Approval[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!identity?.organizationId) return;
    const { data, error: queryError } = await supabase.from('quotation_approvals').select('id, status, requested_at, requester_user_id, quotation_requests(title), quotation_decisions(financial_impact, financial_impact_percent, override_reason, justification)').eq('organization_id', identity.organizationId).order('requested_at', { ascending: false });
    if (queryError) setError(queryError.message); else setRows((data ?? []) as Approval[]);
  }, [identity?.organizationId]);
  useEffect(() => { void load(); }, [load]);
  const review = async (approval: Approval, status: 'approved' | 'rejected') => {
    const comment = window.prompt(status === 'rejected' ? 'Informe o motivo da rejeição:' : 'Comentário da aprovação (opcional):', '') ?? '';
    if (status === 'rejected' && !comment.trim()) return;
    const { error: updateError } = await supabase.rpc('review_quotation_approval', { p_approval_id: approval.id, p_outcome: status, p_comment: comment.trim() || null });
    if (updateError) setError(updateError.message); else void load();
  };
  return <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-6"><h2 className="text-xl font-bold text-slate-800">Aprovações de divergência</h2><p className="mt-1 text-sm text-slate-500">Decisões diferentes da recomendação Hub.IA aguardam segregação de função.</p></div>{error && <p className="m-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="divide-y">{rows.length === 0 && !error ? <p className="p-10 text-center text-sm text-slate-500">Nenhuma solicitação de aprovação persistida.</p> : rows.map(row => { const decision = row.quotation_decisions?.[0]; return <div key={row.id} className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-bold text-slate-900">{row.quotation_requests?.[0]?.title || row.id}</p><p className="mt-1 text-xs text-slate-500">{new Date(row.requested_at).toLocaleString('pt-BR')} · Status: {row.status}</p><p className="mt-3 text-sm text-slate-700"><strong>Motivo:</strong> {decision?.override_reason || 'não informado'}</p><p className="mt-1 text-sm text-slate-700"><strong>Justificativa:</strong> {decision?.justification || 'não informada'}</p><p className="mt-1 text-sm text-slate-700"><strong>Impacto:</strong> {decision?.financial_impact == null ? 'não calculado' : Number(decision.financial_impact).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} {decision?.financial_impact_percent == null ? '' : `(${Number(decision.financial_impact_percent).toFixed(2)}%)`}</p></div>{row.status === 'pending' && <div className="flex gap-2"><Button onClick={() => void review(row, 'approved')} className="gap-1 bg-green-600 text-white"><CheckCircle2 className="h-4 w-4" /> Aprovar</Button><Button variant="outline" onClick={() => void review(row, 'rejected')} className="gap-1 text-red-700"><XCircle className="h-4 w-4" /> Rejeitar</Button></div>}</div></div>; })}</div></div>;
}
