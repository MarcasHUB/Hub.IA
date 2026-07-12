import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Users, Package, FileText, TrendingDown, Clock, Search, Calendar } from 'lucide-react';

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

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      
      {/* HEADER BANNER - Azul Escuro */}
      <div className="bg-slate-900 rounded-[2rem] mx-4 sm:mx-6 mt-6 mb-2 px-6 pt-8 pb-12 shadow-xl">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                Dashboard de Compras
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
        <Card className="rounded-3xl border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all duration-150">
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
        <Card className="rounded-3xl border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all duration-150">
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
        <Card className="rounded-3xl border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all duration-150">
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
        <Card className="rounded-3xl border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all duration-150">
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
        <Card className="rounded-3xl border-green-200 bg-white hover:shadow-sm transition-all duration-150">
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
        <div className="max-w-[1600px] mx-auto grid gap-6 md:grid-cols-2 relative z-10">
        <Card className="rounded-3xl border-slate-200 shadow-sm">
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

        <Card className="rounded-3xl border-slate-200 shadow-sm">
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
  );
}
