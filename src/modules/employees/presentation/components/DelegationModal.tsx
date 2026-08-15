import { useState, useEffect } from 'react';
import { X, Calendar, UserCheck, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Operator } from '../../domain/entities/Operator';
import { SupabaseOperatorRepository } from '../../infrastructure/repositories/SupabaseOperatorRepository';
import { SupabaseDelegationRepository } from '../../infrastructure/repositories/SupabaseDelegationRepository';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

interface DelegationModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function DelegationModal({ onClose, onSuccess }: DelegationModalProps) {
  const { data: identity } = useAuthenticatedIdentity();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loadingOps, setLoadingOps] = useState(true);

  const [origemId, setOrigemId] = useState('');
  const [substitutoId, setSubstitutoId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [motivo, setMotivo] = useState('');

  const [segmentosEspelhados, setSegmentosEspelhados] = useState(true);
  const [permissoesEspelhadas, setPermissoesEspelhadas] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const opRepo = new SupabaseOperatorRepository();
  const delRepo = new SupabaseDelegationRepository();

  useEffect(() => {
    async function fetchOperators() {
      try {
        const list = await opRepo.listOperators();
        // Só permitir operadores com perfil ativo
        setOperators(list.filter(op => op.status === 'ativo' || op.status === 'ferias'));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingOps(false);
      }
    }
    fetchOperators();
  }, [identity?.organizationId]);

  const handleSave = async () => {
    setErrorMsg('');

    // Validações obrigatórias
    if (!origemId || !substitutoId || !dataInicio || !dataFim) {
      setErrorMsg('Preencha todos os campos obrigatórios.');
      return;
    }

    if (origemId === substitutoId) {
      setErrorMsg('O operador substituto deve ser diferente do operador de origem.');
      return;
    }

    const start = new Date(dataInicio);
    const end = new Date(dataFim);

    if (end < start) {
      setErrorMsg('A data de término não pode ser anterior à data de início.');
      return;
    }

    setSubmitting(true);
    try {
      const orgId = identity?.organizationId;
      if (!orgId) throw new Error('Identidade organizacional indisponível.');

      await delRepo.createDelegation({
        organization_id: orgId,
        operador_origem_id: origemId,
        operador_substituto_id: substitutoId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        motivo,
        status: 'ativa',
        segmentos_espelhados: segmentosEspelhados,
        permissoes_espelhadas: permissoesEspelhadas,
      });

      // Atualizar status de férias local se aplicável
      const rawOps = localStorage.getItem('supplyhub_operators_v2');
      if (rawOps) {
        const opsList: Operator[] = JSON.parse(rawOps);
        const updated = opsList.map(op => {
          if (op.id === origemId) {
            return { ...op, status: 'ferias' as const };
          }
          if (op.id === substitutoId) {
            return { ...op, status: 'substituido' as const };
          }
          return op;
        });
        localStorage.setItem('supplyhub_operators_v2', JSON.stringify(updated));
      }

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao agendar delegação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Programar Delegação</h3>
            <p className="text-xs text-slate-500 mt-0.5">Espelhamento temporário de permissões para substituições.</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full">
            <X className="h-4.5 w-4.5 text-slate-400" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-7 mt-4 p-3.5 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600 flex gap-2 items-start">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="p-7 space-y-4">
          {/* Operadores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Operador Ausente *</label>
              <select
                value={origemId}
                onChange={e => setOrigemId(e.target.value)}
                disabled={loadingOps}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Selecione o operador</option>
                {operators.map(op => (
                  <option key={op.id} value={op.id}>{op.nome} {op.sobrenome} ({op.cargo || op.perfil})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Operador Substituto *</label>
              <select
                value={substitutoId}
                onChange={e => setSubstitutoId(e.target.value)}
                disabled={loadingOps}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Selecione o substituto</option>
                {operators.map(op => (
                  <option key={op.id} value={op.id}>{op.nome} {op.sobrenome} ({op.cargo || op.perfil})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Período */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Data de Início *
              </label>
              <Input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Data de Término *
              </label>
              <Input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Motivo / Observações</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Férias anuais, Licença médica, Treinamento..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Configurações de herança */}
          <div className="space-y-2 pt-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <UserCheck className="h-3 w-3" /> Políticas de Espelhamento
            </label>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={segmentosEspelhados}
                  onChange={e => setSegmentosEspelhados(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                />
                <span className="text-xs font-semibold text-slate-700">Espelhar Segmentos Autorizados</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permissoesEspelhadas}
                  onChange={e => setPermissoesEspelhadas(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                />
                <span className="text-xs font-semibold text-slate-700">Espelhar Perfil de Acesso Administrativo</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-7 pb-7 border-t border-slate-50 pt-4">
          <Button variant="outline" onClick={onClose} className="h-10 text-xs">Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 text-xs font-bold flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? 'Salvando...' : 'Confirmar Delegação'}
          </Button>
        </div>
      </div>
    </div>
  );
}
