import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight, Plus,
  Clock, Trash2, RefreshCw
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Delegation } from '../../domain/entities/Delegation';
import { SupabaseDelegationRepository } from '../../infrastructure/repositories/SupabaseDelegationRepository';
import { SupabaseOperatorRepository } from '../../infrastructure/repositories/SupabaseOperatorRepository';
import { DelegationModal } from '../components/DelegationModal';

type FilterType = 'all' | 'active' | 'future' | 'ended';

export default function DelegationsPage({ organizationId }: { organizationId?: string }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>('all');
  const [showModal, setShowModal] = useState(false);

  const delRepo = new SupabaseDelegationRepository();
  const opRepo = new SupabaseOperatorRepository();

  const orgId = organizationId || localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';

  const { data: operators = [], isLoading: loadingOps } = useQuery({
    queryKey: ['operators', orgId],
    queryFn: () => opRepo.listOperators(orgId),
  });

  const { data: delegations = [], isLoading: loadingDels } = useQuery({
    queryKey: ['delegations', orgId],
    queryFn: () => delRepo.listDelegations(orgId),
  });

  const loading = loadingOps || loadingDels;

  const cancelMutation = useMutation({
    mutationFn: (id: string) => delRepo.cancelDelegation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegations', orgId] });
    }
  });

  const getOperatorName = (id: string) => {
    const op = operators.find(o => o.id === id);
    return op ? `${op.nome} ${op.sobrenome}` : 'Desconhecido';
  };

  const getDaysRemaining = (endStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endStr);
    end.setHours(0, 0, 0, 0);
    const diff = end.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days < 0 ? 0 : days;
  };

  const getDelegationCategory = (del: Delegation): FilterType => {
    if (del.status === 'cancelada' || del.status === 'encerrada') return 'ended';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(del.data_inicio);
    start.setHours(0, 0, 0, 0);
    const end = new Date(del.data_fim);
    end.setHours(0, 0, 0, 0);

    if (today > end) return 'ended';
    if (today < start) return 'future';
    return 'active';
  };

  const handleCancel = (id: string) => {
    if (confirm('Deseja realmente cancelar esta delegação de permissões?')) {
      cancelMutation.mutate(id);
    }
  };

  const filtered = delegations.filter(del => {
    const cat = getDelegationCategory(del);
    if (filter === 'all') return true;
    return cat === filter;
  });

  return (
    <div className="space-y-6 font-sans">
      {showModal && (
        <DelegationModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            queryClient.invalidateQueries({ queryKey: ['delegations', orgId] });
          }}
        />
      )}

      {/* Filtros e Ações */}
      <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
        <CardContent className="p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'active', label: 'Ativas' },
              { id: 'future', label: 'Futuras' },
              { id: 'ended', label: 'Encerradas/Canceladas' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as FilterType)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  filter === f.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 text-sm font-bold flex items-center gap-2 shrink-0 w-full sm:w-auto rounded-xl"
          >
            <Plus className="h-4 w-4" /> Programar Delegação
          </Button>
        </CardContent>
      </Card>

      {/* CONTEÚDO */}
      <div>
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm font-semibold flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
            Carregando delegações...
          </div>
        ) : filtered.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-slate-300 bg-white">
            <CardContent className="p-12 text-center">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <ArrowLeftRight className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-600">Nenhuma delegação encontrada</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Crie uma delegação para transferir temporariamente segmentos e atribuições entre operadores.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(del => {
              const cat = getDelegationCategory(del);
              const daysLeft = getDaysRemaining(del.data_fim);

              return (
                <Card
                  key={del.id}
                  className={`rounded-2xl border shadow-sm transition-all ${
                    cat === 'active'
                      ? 'border-indigo-200 bg-white hover:shadow-md'
                      : 'border-slate-200 bg-slate-50/50 opacity-80'
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center gap-1.5 text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                          cat === 'active'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : cat === 'future'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {cat === 'active' ? 'Ativa' : cat === 'future' ? 'Futura' : 'Encerrada'}
                        </span>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Período: {new Date(del.data_inicio).toLocaleDateString('pt-BR')} a {new Date(del.data_fim).toLocaleDateString('pt-BR')}
                        </h4>
                      </div>

                      {cat === 'active' && (
                        <div className="flex items-center gap-1 text-[10px] font-extrabold text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-lg">
                          <Clock className="h-3 w-3" /> {daysLeft} dias restantes
                        </div>
                      )}
                    </div>

                    {/* Espelhamento de nomes */}
                    <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl mb-4">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Operador Ausente</p>
                        <p className="text-xs font-bold text-slate-800">{getOperatorName(del.operador_origem_id)}</p>
                      </div>
                      <ArrowLeftRight className="h-4 w-4 text-slate-400" />
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Substituto</p>
                        <p className="text-xs font-bold text-slate-800">{getOperatorName(del.operador_substituto_id)}</p>
                      </div>
                    </div>

                    {del.motivo && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                        <strong>Motivo:</strong> {del.motivo}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="flex gap-2">
                        {del.segmentos_espelhados && (
                          <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                            Segmentos Espelhados
                          </span>
                        )}
                        {del.permissoes_espelhadas && (
                          <span className="text-[9px] font-bold bg-violet-50 text-violet-700 px-2 py-0.5 rounded">
                            Perfil Espelhado
                          </span>
                        )}
                      </div>

                      {cat !== 'ended' && del.status !== 'cancelada' && (
                        <button
                          onClick={() => handleCancel(del.id)}
                          className="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Cancelar
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
