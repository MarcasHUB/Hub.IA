import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  LogOut,
  PackagePlus,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';
import { usePrivateSession } from '@/modules/auth/presentation/context/PrivateSessionBoundary';

type RequestStatus =
  | 'pendente'
  | 'em_aprovacao'
  | 'aprovada'
  | 'rejeitada'
  | 'em_cotacao'
  | 'pedido_emitido'
  | 'entregue'
  | 'cancelada';

type Priority = 'baixa' | 'normal' | 'alta' | 'urgente' | 'emergencial';

interface InternalRequest {
  id: string;
  priority: Priority;
  status: RequestStatus;
  expected_date: string | null;
  department: string | null;
  notes: string | null;
  created_at: string;
  internal_request_items?: Array<{ count?: number }> | null;
}

interface DraftItem {
  id: string;
  description: string;
  quantity: string;
  uom: string;
}

const STATUS_LABEL: Record<RequestStatus, string> = {
  pendente: 'Pendente',
  em_aprovacao: 'Em aprovação',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  em_cotacao: 'Em cotação',
  pedido_emitido: 'Pedido emitido',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
};

const PRIORITY_LABEL: Record<Priority, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
  emergencial: 'Emergencial',
};

function newItem(): DraftItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: '1',
    uom: 'UN',
  };
}

export default function MobileRequesterPage() {
  const navigate = useNavigate();
  const { data: identity } = useAuthenticatedIdentity();
  const { transitionTo } = usePrivateSession();
  const [requests, setRequests] = useState<InternalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [priority, setPriority] = useState<Priority>('normal');
  const [expectedDate, setExpectedDate] = useState('');
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([newItem()]);

  const loadRequests = async () => {
    if (!identity?.userId) return;
    setLoading(true);
    setError('');

    const { data, error: requestError } = await supabase
      .from('internal_requests')
      .select('id, priority, status, expected_date, department, notes, created_at, internal_request_items(count)')
      .eq('requester_id', identity.userId)
      .order('created_at', { ascending: false });

    if (requestError) {
      setError('Não foi possível carregar suas solicitações.');
      setRequests([]);
    } else {
      setRequests((data || []) as InternalRequest[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadRequests();
  }, [identity?.userId]);

  const stats = useMemo(() => {
    const open = requests.filter((request) =>
      ['pendente', 'em_aprovacao', 'aprovada', 'em_cotacao', 'pedido_emitido'].includes(request.status),
    ).length;
    const waiting = requests.filter((request) => ['pendente', 'em_aprovacao'].includes(request.status)).length;
    const done = requests.filter((request) => request.status === 'entregue').length;
    return { open, waiting, done };
  }, [requests]);

  const resetForm = () => {
    setPriority('normal');
    setExpectedDate('');
    setDepartment('');
    setNotes('');
    setItems([newItem()]);
  };

  const closeForm = () => {
    if (saving) return;
    setShowNewRequest(false);
    resetForm();
    setError('');
  };

  const updateItem = (id: string, field: keyof Omit<DraftItem, 'id'>, value: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const addItem = () => setItems((current) => [...current, newItem()]);

  const removeItem = (id: string) => {
    setItems((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)));
  };

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!identity) return;

    const validItems = items
      .map((item) => ({
        ...item,
        description: item.description.trim(),
        quantityNumber: Number(item.quantity.replace(',', '.')),
        uom: item.uom.trim().toUpperCase(),
      }))
      .filter((item) => item.description && Number.isFinite(item.quantityNumber) && item.quantityNumber > 0 && item.uom);

    if (validItems.length !== items.length) {
      setError('Preencha a descrição, quantidade e unidade de todos os itens.');
      return;
    }

    setSaving(true);
    setError('');

    const { data: created, error: createError } = await supabase
      .from('internal_requests')
      .insert({
        organization_id: identity.organizationId,
        requester_id: identity.userId,
        requested_by_name: identity.fullName,
        priority,
        expected_date: expectedDate || null,
        department: department.trim() || null,
        notes: notes.trim() || null,
      })
      .select('id')
      .single();

    if (createError || !created?.id) {
      setSaving(false);
      setError('Não foi possível criar a solicitação. Verifique os dados e tente novamente.');
      return;
    }

    const { error: itemsError } = await supabase.from('internal_request_items').insert(
      validItems.map((item) => ({
        request_id: created.id,
        description: item.description,
        quantity: item.quantityNumber,
        uom: item.uom,
      })),
    );

    if (itemsError) {
      await supabase.from('internal_requests').delete().eq('id', created.id).eq('requester_id', identity.userId);
      setSaving(false);
      setError('A solicitação não foi concluída porque um ou mais itens não puderam ser salvos.');
      return;
    }

    setSaving(false);
    setShowNewRequest(false);
    resetForm();
    await loadRequests();
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    await transitionTo(null);
    navigate('/login', { replace: true });
  };

  const firstName = identity?.fullName?.split(' ')[0] || 'Solicitante';

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">SupplyHub.IA</p>
            <h1 className="text-sm font-extrabold text-slate-900">{identity?.organizationName || 'Minha empresa'}</h1>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-5">
        <section className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl">
          <p className="text-xs font-semibold text-slate-300">Olá, {firstName}</p>
          <div className="mt-1 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight">O que você precisa?</h2>
              <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-slate-400">
                Abra uma solicitação de material e acompanhe o fluxo até a entrega.
              </p>
            </div>
            <div className="rounded-2xl bg-indigo-500/20 p-3 text-indigo-300">
              <PackagePlus className="h-7 w-7" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowNewRequest(true)}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-sm font-extrabold text-white shadow-lg shadow-indigo-950/30 active:scale-[0.99]"
          >
            <Plus className="h-5 w-5" />
            Nova solicitação
          </button>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <ClipboardList className="h-4 w-4 text-indigo-600" />
            <p className="mt-3 text-xl font-black">{stats.open}</p>
            <p className="text-[10px] font-semibold text-slate-500">Em andamento</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <Clock3 className="h-4 w-4 text-amber-500" />
            <p className="mt-3 text-xl font-black">{stats.waiting}</p>
            <p className="text-[10px] font-semibold text-slate-500">Aguardando</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="mt-3 text-xl font-black">{stats.done}</p>
            <p className="text-[10px] font-semibold text-slate-500">Entregues</p>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black">Minhas solicitações</h3>
              <p className="text-xs text-slate-500">Acompanhe o status das solicitações abertas por você.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadRequests()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
              aria-label="Atualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {error && !showNewRequest && (
            <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Carregando solicitações...
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
              <h4 className="mt-3 text-sm font-extrabold">Nenhuma solicitação ainda</h4>
              <p className="mt-1 text-xs text-slate-500">Use o botão acima para criar a primeira.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {new Date(request.created_at).toLocaleDateString('pt-BR')}
                      </p>
                      <h4 className="mt-1 truncate text-sm font-extrabold">
                        {request.department || 'Solicitação de material'}
                      </h4>
                    </div>
                    <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-extrabold text-slate-700">
                      {STATUS_LABEL[request.status]}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>{request.internal_request_items?.[0]?.count ?? 0} item(ns)</span>
                    <span>{PRIORITY_LABEL[request.priority]}</span>
                  </div>
                  {request.expected_date && (
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Necessidade: {new Date(request.expected_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-end text-[11px] font-extrabold text-indigo-600">
                    Acompanhar <ChevronRight className="h-4 w-4" />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto grid h-20 max-w-lg grid-cols-3 px-6">
          <button type="button" className="flex flex-col items-center justify-center gap-1 text-indigo-600">
            <ClipboardList className="h-5 w-5" />
            <span className="text-[10px] font-extrabold">Início</span>
          </button>
          <button type="button" onClick={() => setShowNewRequest(true)} className="flex flex-col items-center justify-center gap-1 text-slate-500">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md">
              <Plus className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-extrabold">Solicitar</span>
          </button>
          <button type="button" className="flex flex-col items-center justify-center gap-1 text-slate-500">
            <UserRound className="h-5 w-5" />
            <span className="text-[10px] font-extrabold">Perfil</span>
          </button>
        </div>
      </nav>

      {showNewRequest && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/60 sm:items-center sm:justify-center sm:p-4">
          <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Nova solicitação</p>
                <h3 className="mt-1 text-xl font-black">Informe o que você precisa</h3>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submitRequest} className="space-y-5">
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 text-xs font-bold text-slate-700">
                  Prioridade
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as Priority)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500"
                  >
                    {Object.entries(PRIORITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-bold text-slate-700">
                  Data necessária
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(event) => setExpectedDate(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500"
                  />
                </label>
              </div>

              <label className="block space-y-1.5 text-xs font-bold text-slate-700">
                Área / departamento
                <input
                  type="text"
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  placeholder="Ex.: Manutenção, Qualidade, Produção"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500"
                />
              </label>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-800">Itens solicitados</p>
                    <p className="text-[10px] text-slate-500">Adicione um ou mais materiais.</p>
                  </div>
                  <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-extrabold text-indigo-600">
                    <Plus className="h-4 w-4" /> Item
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Item {index + 1}</span>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(item.id)} className="text-slate-400" aria-label="Remover item">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <input
                        required
                        value={item.description}
                        onChange={(event) => updateItem(item.id, 'description', event.target.value)}
                        placeholder="Descrição do material"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500"
                      />
                      <div className="mt-2 grid grid-cols-[1fr_100px] gap-2">
                        <input
                          required
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(event) => updateItem(item.id, 'quantity', event.target.value)}
                          placeholder="Qtd."
                          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500"
                        />
                        <input
                          required
                          value={item.uom}
                          onChange={(event) => updateItem(item.id, 'uom', event.target.value)}
                          placeholder="UN"
                          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm uppercase outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label className="block space-y-1.5 text-xs font-bold text-slate-700">
                Observações
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Detalhes importantes para a compra..."
                  className="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-500"
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-indigo-600 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {saving ? 'Enviando...' : 'Enviar solicitação'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
