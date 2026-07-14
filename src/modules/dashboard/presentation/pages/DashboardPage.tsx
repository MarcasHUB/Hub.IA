import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import {
  Users, Package, FileText, TrendingDown, Clock, Search, Calendar,
  Sparkles, CheckSquare, X, Eye, RefreshCw
} from 'lucide-react';
import { SupabaseSignalRepository, HubIASignal, SignalCriticidade } from '../../infrastructure/repositories/SupabaseSignalRepository';

type DateRange = '30' | '60' | '90';

interface DashboardStats {
  fornecedores: string;
  fornecedoresDesc: string;
  produtos: string;
  produtosDesc: string;
  pesquisas: string;
  pesquisasDesc: string;
  cotacoes: string;
  cotacoesDesc: string;
  economia: string;
  economiaDesc: string;
}

const STATS_BY_RANGE: Record<DateRange, DashboardStats> = {
  '30': {
    fornecedores: '12',
    fornecedoresDesc: '+3 novas conexões este mês',
    produtos: '85',
    produtosDesc: '+15 cadastros recentes',
    pesquisas: '1.284',
    pesquisasDesc: '+12% de aumento vs mês ant.',
    cotacoes: '24',
    cotacoesDesc: '18 BID / 6 direcionadas',
    economia: 'R$ 42K',
    economiaDesc: 'Média de 14.5% de saving'
  },
  '60': {
    fornecedores: '22',
    fornecedoresDesc: '+8 novas conexões período',
    produtos: '190',
    produtosDesc: '+42 cadastros período',
    pesquisas: '2.450',
    pesquisasDesc: '+18% consultas ativas',
    cotacoes: '48',
    cotacoesDesc: '35 BID / 13 direcionadas',
    economia: 'R$ 88K',
    economiaDesc: 'Média de 15.2% de saving'
  },
  '90': {
    fornecedores: '35',
    fornecedoresDesc: '+15 novas conexões período',
    produtos: '320',
    produtosDesc: '+95 cadastros período',
    pesquisas: '3.820',
    pesquisasDesc: '+22% consultas acumuladas',
    cotacoes: '85',
    cotacoesDesc: '60 BID / 25 direcionadas',
    economia: 'R$ 184K',
    economiaDesc: 'Média de 16.1% de saving'
  }
};

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>('30');
  const stats = STATS_BY_RANGE[range];

  const [signals, setSignals] = useState<HubIASignal[]>([]);
  const [counters, setCounters] = useState({ criticos: 0, abertos: 0, resolvidos: 0 });
  const [loading, setLoading] = useState(true);

  const sigRepo = new SupabaseSignalRepository();
  const orgId = localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';

  async function loadSignals() {
    setLoading(true);
    try {
      const active = await sigRepo.listActiveSignals(orgId);
      setSignals(active);
      const counts = await sigRepo.getCounters(orgId);
      setCounters(counts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSignals();
  }, []);

  const handleAction = async (id: string, status: 'lido' | 'resolvido' | 'ignorado') => {
    await sigRepo.updateSignalStatus(id, status);
    loadSignals();
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      
      {/* HEADER BANNER - Azul Escuro */}
      <div className="bg-slate-900 rounded-2xl mx-6 mt-6 mb-4 px-8 pt-8 pb-12 shadow-md">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                Dashboard de Gestão
              </h1>
              <p className="text-slate-400 mt-1 text-sm max-w-2xl">
                Visão geral do desempenho e inteligência de suprimentos.
              </p>
            </div>
            
            {/* Seletor de período */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Calendar className="h-4 w-4 text-slate-400" />
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as DateRange)}
                className="h-9 px-3 rounded-xl border border-slate-700 text-xs font-bold text-white bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
              >
                <option value="30">Últimos 30 dias</option>
                <option value="60">Últimos 60 dias</option>
                <option value="90">Últimos 90 dias</option>
              </select>
            </div>
          </div>


          {/* Grid de KPIs dentro do Banner Azul */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        
        {/* Fornecedores */}
        <Card className="rounded-2xl border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all duration-150">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5">
            <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fornecedores</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-extrabold text-slate-900">{stats.fornecedores}</div>
            <p className="text-[10px] text-slate-500 leading-snug">{stats.fornecedoresDesc}</p>
          </CardContent>
        </Card>
        
        {/* Produtos */}
        <Card className="rounded-2xl border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all duration-150">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5">
            <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Produtos</CardTitle>
            <Package className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-extrabold text-slate-900">{stats.produtos}</div>
            <p className="text-[10px] text-slate-500 leading-snug">{stats.produtosDesc}</p>
          </CardContent>
        </Card>

        {/* Pesquisas */}
        <Card className="rounded-2xl border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all duration-150">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5">
            <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pesquisas</CardTitle>
            <Search className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-extrabold text-slate-900">{stats.pesquisas}</div>
            <p className="text-[10px] text-slate-500 leading-snug">{stats.pesquisasDesc}</p>
          </CardContent>
        </Card>

        {/* Cotações */}
        <Card className="rounded-2xl border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all duration-150">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5">
            <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cotações</CardTitle>
            <FileText className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-extrabold text-slate-900">{stats.cotacoes}</div>
            <p className="text-[10px] text-slate-500 leading-snug">{stats.cotacoesDesc}</p>
          </CardContent>
        </Card>

        {/* Economia */}
        <Card className="rounded-2xl border-green-200 bg-white hover:shadow-sm transition-all duration-150">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5">
            <CardTitle className="text-xs font-bold text-green-700 uppercase tracking-wider">Economia (Saving)</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-extrabold text-green-700">{stats.economia}</div>
            <p className="text-[10px] text-green-600 leading-snug">{stats.economiaDesc}</p>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>

      {/* Conteúdo Detalhado (abaixo do banner) */}
      <div className="flex-1 overflow-auto p-6 -mt-6">
        <div className="max-w-[1600px] mx-auto space-y-6 relative z-10">
          
          {/* HUB.IA ANALYTICA (Painel Inteligente) */}
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-900 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
                <CardTitle className="text-white text-sm font-extrabold flex items-center gap-2">
                  Hub.IA Analytica
                  <span className="bg-indigo-500/25 text-indigo-300 text-[9px] px-2 py-0.5 rounded border border-indigo-500/30 uppercase tracking-widest font-black">
                    IA Inteligente
                  </span>
                </CardTitle>
              </div>

              {/* Contadores da governança */}
              <div className="flex items-center gap-4 text-[10px] font-extrabold text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  Críticos: <strong className="text-red-400">{counters.criticos}</strong>
                </span>
                <span className="h-3 w-px bg-slate-800" />
                <span>Abertos: <strong className="text-white">{counters.abertos}</strong></span>
                <span className="h-3 w-px bg-slate-800" />
                <span className="text-green-400">Resolvidos: <strong>{counters.resolvidos}</strong></span>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {loading ? (
                <p className="text-xs text-slate-400 font-semibold flex items-center gap-2 py-4">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-500" /> Carregando insights da Hub.IA...
                </p>
              ) : signals.length === 0 ? (
                <div className="py-6 text-center text-slate-400 space-y-1">
                  <p className="text-xs font-bold text-slate-600">Conformidade Operacional 100%</p>
                  <p className="text-[10px] text-slate-400">Nenhum alerta de governança pendente de resolução.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {signals.map(sig => {
                    const borders: Record<SignalCriticidade, string> = {
                      critico: 'border-l-4 border-l-red-500 bg-red-50/20 border-red-200',
                      alto: 'border-l-4 border-l-amber-500 bg-amber-50/20 border-amber-200',
                      medio: 'border-l-4 border-l-indigo-500 bg-indigo-50/20 border-indigo-200',
                      informativo: 'border-l-4 border-l-slate-400 bg-slate-50/20 border-slate-200',
                    };

                    const criticidades: Record<SignalCriticidade, string> = {
                      critico: 'text-red-700 bg-red-100 border-red-200',
                      alto: 'text-amber-700 bg-amber-100 border-amber-200',
                      medio: 'text-indigo-700 bg-indigo-100 border-indigo-200',
                      informativo: 'text-slate-600 bg-slate-100 border-slate-200',
                    };

                    return (
                      <div
                        key={sig.id}
                        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border mb-2 transition-all ${borders[sig.criticidade]}`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${criticidades[sig.criticidade]}`}>
                              {sig.criticidade}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                              {sig.categoria}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                            {sig.descricao}
                          </p>
                        </div>

                        {/* Ações de Descarte/Resolução */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            onClick={() => handleAction(sig.id, 'lido')}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1 text-[9px] font-bold"
                            title="Marcar como lido"
                          >
                            <Eye className="h-3.5 w-3.5" /> Lido
                          </button>
                          <button
                            onClick={() => handleAction(sig.id, 'resolvido')}
                            className="p-1.5 hover:bg-green-55/10 rounded-lg text-green-650 hover:text-green-700 transition-colors flex items-center gap-1 text-[9px] font-extrabold"
                            title="Marcar como resolvido"
                          >
                            <CheckSquare className="h-3.5 w-3.5" /> Resolver
                          </button>
                          <button
                            onClick={() => handleAction(sig.id, 'ignorado')}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 hover:text-red-750 transition-colors flex items-center gap-1 text-[9px] font-bold"
                            title="Ignorar alerta"
                          >
                            <X className="h-3.5 w-3.5" /> Ignorar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Search className="h-5 w-5 text-indigo-600" />
              Produtos Mais Procurados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Cabo Flexível 35mm', vol: '156 buscas' },
                { name: 'Luva Nitrílica P', vol: '98 buscas' },
                { name: 'Parafuso Sextavado M8', vol: '74 buscas' },
                { name: 'Chave de Impacto Pneumática', vol: '45 buscas' },
                { name: 'Caixas de Papelão', vol: '32 buscas' },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <span className="font-semibold text-xs text-slate-850">{item.name}</span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{item.vol}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Clock className="h-5 w-5 text-indigo-600" />
              Últimos Produtos Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Cabo Flexível 35mm', supplier: 'Brasil Cabos', date: 'Hoje, 14:30' },
                { name: 'Parafuso Sextavado M8', supplier: 'Fixação Industrial', date: 'Hoje, 10:15' },
                { name: 'Luva Nitrílica P', supplier: 'Segurança Total', date: 'Ontem, 16:45' }
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs text-slate-850">{item.name}</span>
                    <span className="text-[10px] text-slate-450 mt-0.5">{item.supplier}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {item.date}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
      </div>

    </div>
  );
}
