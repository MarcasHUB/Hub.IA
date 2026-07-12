import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { TrendingDown, AlertCircle, BarChart3, PieChart, Activity } from 'lucide-react';
import { env } from '@/kernel/config/env';

export default function IntelligenceDashboardPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Top Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-indigo-600" />
            Procurement Intelligence
          </h2>
          <p className="text-slate-500">Analytics e inteligência de compras corporativas.</p>
        </div>
        
        {/* Environment Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200 shadow-sm">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${env.useMockData ? 'bg-orange-400' : 'bg-green-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${env.useMockData ? 'bg-orange-500' : 'bg-green-500'}`}></span>
          </span>
          <span className="text-xs font-semibold text-slate-700">
            {env.useMockData ? 'Modo Demonstração (Mocks)' : 'Ambiente Real (Supabase)'}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white border-indigo-950 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-indigo-100">Economia Acumulada YTD</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">R$ 1.284.350</div>
            <p className="text-xs text-indigo-200 mt-1">-14,2% vs Orçamento Base</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Tempo Médio de Resposta (SLA)</CardTitle>
            <Activity className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">4.2 <span className="text-lg text-slate-500 font-medium">horas</span></div>
            <p className="text-xs text-green-600 flex items-center mt-1"><TrendingDown className="h-3 w-3 mr-1"/> 12% mais rápido que o mês passado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Taxa de Conversão de Cotações</CardTitle>
            <PieChart className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">78%</div>
            <p className="text-xs text-slate-500 mt-1">Das propostas resultam em compra</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Supplier Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ranking de Fornecedores (Top 5)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Brasil Cabos', score: '98/100', rank: 'A', onTime: '99%' },
                { name: 'Fixação Industrial', score: '94/100', rank: 'A', onTime: '95%' },
                { name: 'Segurança Total EPIs', score: '88/100', rank: 'B', onTime: '90%' },
                { name: 'Eletro Tudo B2B', score: '85/100', rank: 'B', onTime: '88%' },
                { name: 'Manutenção Express S/A', score: '72/100', rank: 'C', onTime: '80%' },
              ].map((sup, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{sup.name}</p>
                      <p className="text-xs text-slate-500">Entrega no prazo: {sup.onTime}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={sup.rank === 'A' ? 'success' : sup.rank === 'B' ? 'secondary' : 'outline'}>
                      Rank {sup.rank}
                    </Badge>
                    <span className="text-xs font-bold text-slate-700">{sup.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Evolução de Preços / Alertas */}
        <div className="space-y-6">
          <Card className="border-red-200">
            <CardHeader className="bg-red-50/50 border-b border-red-100 pb-4">
              <CardTitle className="text-lg text-red-900 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Alertas de Inflação (Produtos)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {[
                  { name: 'Cabo de Cobre Nu 50mm', diff: '+18.5%', reason: 'Alta do Cobre (LME)' },
                  { name: '�"leo Lubrificante Hidráulico', diff: '+12.0%', reason: 'Derivados de Petróleo' }
                ].map((alert, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-slate-900">{alert.name}</p>
                      <p className="text-xs text-slate-500">{alert.reason}</p>
                    </div>
                    <span className="text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                      {alert.diff}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Distribuição de Spend por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Fake Bar Chart */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600"><span>Elétrica / Fios e Cabos</span><span>45% (R$ 850k)</span></div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-600 w-[45%]"></div></div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600"><span>Manutenção / Rolamentos</span><span>25% (R$ 480k)</span></div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-400 w-[25%]"></div></div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600"><span>EPIs e Segurança</span><span>15% (R$ 280k)</span></div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-400 w-[15%]"></div></div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600"><span>Outros</span><span>15% (R$ 280k)</span></div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-300 w-[15%]"></div></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}