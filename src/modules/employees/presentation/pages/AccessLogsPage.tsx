import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, User, Filter,
  RefreshCw, Info, Terminal, Eye
} from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Input } from '@/shared/components/ui/Input';
import { Button } from '@/shared/components/ui/Button';
import { SupabaseLogRepository } from '../../infrastructure/repositories/SupabaseLogRepository';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

export default function AccessLogsPage() {
  const [activeTab, setActiveTab] = useState<'acesso' | 'operacao'>('acesso');

  // Filtros
  const [filterOperator, setFilterOperator] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  // Detalhes do Log (unificado)
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const logRepo = new SupabaseLogRepository();
  const { data: identity } = useAuthenticatedIdentity();
  const orgId = identity?.organizationId || '';

  const { data: logsData, isLoading: loading } = useQuery({
    queryKey: ['logs', orgId],
    queryFn: () => logRepo.listLogs(orgId),
    enabled: Boolean(orgId),
  });

  const accessLogs = logsData?.accessLogs || [];
  const operationLogs = logsData?.operationLogs || [];

  // Filtragem
  const filteredAccess = accessLogs.filter(log => {
    if (filterOperator && !log.operator_nome?.toLowerCase().includes(filterOperator.toLowerCase())) return false;
    if (filterDate && !log.created_at.startsWith(filterDate)) return false;
    if (filterType && log.tipo !== filterType) return false;
    return true;
  });

  const filteredOps = operationLogs.filter(log => {
    if (filterOperator && !log.operator_nome?.toLowerCase().includes(filterOperator.toLowerCase())) return false;
    if (filterDate && !log.created_at.startsWith(filterDate)) return false;
    if (filterEntity && !log.entidade.toLowerCase().includes(filterEntity.toLowerCase())) return false;
    return true;
  });

  // Métricas para Relatórios Futuros
  const totalLogins = accessLogs.filter(l => l.tipo === 'login' && l.resultado === 'sucesso').length;
  const failedLogins = accessLogs.filter(l => l.tipo === 'tentativa_falha').length;
  
  // Operador mais ativo
  const opCount: Record<string, number> = {};
  operationLogs.forEach(l => {
    if (l.operator_nome) opCount[l.operator_nome] = (opCount[l.operator_nome] || 0) + 1;
  });
  const mostActiveOperator = Object.entries(opCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Nenhum';

  return (
    <div className="space-y-6 font-sans">
      {/* Cards de Métricas (Preparação para Relatórios) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Logins com Sucesso</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalLogins}</p>
            <p className="text-[10px] text-slate-400 mt-1">Conexões seguras estabelecidas</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Operador Mais Ativo</p>
            <p className="text-base font-extrabold text-indigo-600 mt-1 line-clamp-1">{mostActiveOperator}</p>
            <p className="text-[10px] text-slate-400 mt-1.5">Maior volume de alterações registradas</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tentativas Bloqueadas/Falhas</p>
            <p className="text-2xl font-extrabold text-red-600 mt-1">{failedLogins}</p>
            <p className="text-[10px] text-slate-400 mt-1">Alertas enviados para a Hub.IA</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => { setActiveTab('acesso'); setErrorFilter(); }}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'acesso' ? 'border-indigo-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Logs de Acesso e Segurança
        </button>
        <button
          onClick={() => { setActiveTab('operacao'); setErrorFilter(); }}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'operacao' ? 'border-indigo-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Logs de Operações (Auditoria)
        </button>
      </div>

      {/* Filtros */}
      <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
        <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <User className="h-3 w-3" /> Operador
            </label>
            <Input
              placeholder="Nome do operador..."
              value={filterOperator}
              onChange={e => setFilterOperator(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Data
            </label>
            <Input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {activeTab === 'acesso' ? (
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Evento
              </label>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="">Todos</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
                <option value="tentativa_falha">Tentativa Falha</option>
                <option value="bloqueio">Bloqueio</option>
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Terminal className="h-3 w-3" /> Entidade
              </label>
              <Input
                placeholder="Ex: produto, delegacao..."
                value={filterEntity}
                onChange={e => setFilterEntity(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          )}

          <Button
            onClick={() => {
              setFilterOperator('');
              setFilterDate('');
              setFilterType('');
              setFilterEntity('');
            }}
            variant="outline"
            className="h-9 text-xs font-bold"
          >
            Limpar Filtros
          </Button>
        </CardContent>
      </Card>

      {/* Tabelas de Logs */}
      <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm font-semibold flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
            Carregando trilha de auditoria...
          </div>
        ) : activeTab === 'acesso' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Data/Hora</th>
                  <th className="px-6 py-3.5">Operador</th>
                  <th className="px-6 py-3.5">Evento</th>
                  <th className="px-6 py-3.5">IP</th>
                  <th className="px-6 py-3.5">Navegador (User-Agent)</th>
                  <th className="px-6 py-3.5">Resultado</th>
                  <th className="px-6 py-3.5 text-center">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccess.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[10px]">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{log.operator_nome}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold border text-[9px] uppercase ${
                        log.tipo === 'login' ? 'bg-green-50 text-green-700 border-green-200' :
                        log.tipo === 'logout' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {log.tipo.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{log.ip || '—'}</td>
                    <td className="px-6 py-4 text-slate-400 truncate max-w-xs" title={log.user_agent}>
                      {log.user_agent || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold uppercase text-[9px] ${log.resultado === 'sucesso' ? 'text-green-600' : 'text-red-650'}`}>
                        {log.resultado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors inline-flex items-center gap-1 font-bold text-[10px]"
                      >
                        <Eye className="h-3.5 w-3.5" /> Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Data/Hora</th>
                  <th className="px-6 py-3.5">Operador Responsável</th>
                  <th className="px-6 py-3.5">Entidade</th>
                  <th className="px-6 py-3.5">Ação</th>
                  <th className="px-6 py-3.5 text-center">Metadados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOps.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[10px]">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{log.operator_nome}</td>
                    <td className="px-6 py-4 font-bold text-indigo-700 uppercase tracking-wide text-[10px]">
                      {log.entidade}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">{log.acao}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors inline-flex items-center gap-1 font-bold text-[10px]"
                      >
                        <Eye className="h-3.5 w-3.5" /> Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* LogDetailsModal Unificado */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-slate-700 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="font-bold flex items-center gap-2 text-slate-900 text-lg">
                <Info className="h-5 w-5 text-indigo-600" /> Detalhes do Registro
              </span>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times; Fechar
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Operador</p>
                <p className="text-sm font-semibold text-slate-900">{selectedLog.operator_nome || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Data/Hora</p>
                <p className="text-sm font-semibold text-slate-900">{new Date(selectedLog.created_at).toLocaleString('pt-BR')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Ação / Evento</p>
                <p className="text-sm font-semibold text-slate-900 uppercase">{(selectedLog.acao || selectedLog.tipo || '').replace('_', ' ')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Origem / Entidade</p>
                <p className="text-sm font-semibold text-slate-900 capitalize">{selectedLog.entidade || 'Acesso ao Sistema'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">IP</p>
                <p className="text-sm font-semibold text-slate-900">{selectedLog.ip || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Navegador (User-Agent)</p>
                <p className="text-sm font-semibold text-slate-900 line-clamp-2" title={selectedLog.user_agent}>{selectedLog.user_agent || '—'}</p>
              </div>
            </div>

            <details className="mt-4 border border-slate-200 rounded-xl overflow-hidden group">
              <summary className="bg-slate-50 p-3 text-xs font-bold text-slate-600 cursor-pointer flex items-center gap-2 group-open:border-b border-slate-200">
                <span>Detalhes Técnicos (JSON)</span>
              </summary>
              <div className="p-4 bg-slate-900 font-mono text-[10px] text-slate-300 max-h-60 overflow-auto">
                {selectedLog.payload_antes || selectedLog.payload_depois ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-500 mb-2 font-bold uppercase">Antes</p>
                      <pre>{JSON.stringify(selectedLog.payload_antes || {}, null, 2)}</pre>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-2 font-bold uppercase">Depois</p>
                      <pre>{JSON.stringify(selectedLog.payload_depois || {}, null, 2)}</pre>
                    </div>
                  </div>
                ) : (
                  <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
                )}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );

  function setErrorFilter() {
    setSelectedLog(null);
  }
}
