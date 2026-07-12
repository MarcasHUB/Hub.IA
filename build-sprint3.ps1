$ErrorActionPreference = 'Stop'
$rootDir = "e:\SupplyHUB"

function Create-File ($path, $content) {
    $fullPath = "$rootDir\$path"
    $dir = Split-Path $fullPath
    if (!(Test-Path $dir)) {
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
    }
    New-Item -Path $fullPath -ItemType File -Force -Value $content | Out-Null
}

Write-Host "Criando módulo Search..."

Create-File "src\modules\search\domain\entities\SearchResult.ts" @'
export class SearchResult {
    constructor(
        public readonly productId: string,
        public readonly productName: string,
        public readonly sku: string,
        public readonly manufacturer: string,
        public readonly categoryName: string,
        public readonly supplierId: string,
        public readonly supplierName: string,
        public readonly priceReference: number,
        public readonly status: string,
        public readonly lastUpdatedAt: Date
    ) {}

    /* 
     * Estrutura preparada para futuras sprints (Inteligência e Cotações):
     *
     * priceHistory: { date: Date, price: number }[]
     * supplierRanking: number (0 - 5 stars or score)
     * productScore: number
     * quotationComparison: boolean (is currently being quoted?)
     */
}
'@

Create-File "src\modules\search\application\dto\SearchDTOs.ts" @'
export interface SearchQueryDTO {
    query: string;
    filters?: {
        categories?: string[];
        suppliers?: string[];
        manufacturers?: string[];
        minPrice?: number;
        maxPrice?: number;
        status?: string[];
    };
    sort?: {
        field: 'price' | 'date' | 'name' | 'supplier';
        order: 'asc' | 'desc';
    };
    page?: number;
    limit?: number;
}
'@

Write-Host "Atualizando UI..."

Create-File "src\kernel\layouts\AppLayout.tsx" @'
import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Outlet, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/shared/components/ui/Input';
import { Button } from '@/shared/components/ui/Button';

export function AppLayout() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Global com Busca Centralizada */}
        <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0">
            
            <div className="flex-1 flex justify-center px-8">
              <form onSubmit={handleSearch} className="w-full max-w-2xl relative flex items-center">
                <Search className="absolute left-3 h-5 w-5 text-slate-400" />
                <Input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar produtos, categorias, SKUs ou fornecedores..." 
                  className="w-full pl-10 h-10 bg-slate-50 border-slate-300 focus-visible:ring-indigo-500 rounded-l-md rounded-r-none"
                />
                <Button type="submit" className="rounded-l-none h-10 bg-indigo-600 hover:bg-indigo-700 text-white">
                  Buscar
                </Button>
              </form>
            </div>

            <div className="flex items-center gap-4 shrink-0">
                <span className="text-sm font-medium text-slate-500 hidden md:inline-block">
                  Logado em: <strong className="text-slate-900">Empresa Global S/A</strong>
                </span>
                <div className="h-8 w-8 rounded-full bg-indigo-900 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    AD
                </div>
            </div>
        </div>
        
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-7xl mx-auto min-h-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
'@

Write-Host "Criando SearchResultsPage..."

Create-File "src\modules\search\presentation\pages\SearchResultsPage.tsx" @'
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { Checkbox } from '@/shared/components/ui/Checkbox'; // Will create this component quickly
import { Select } from '@/shared/components/ui/Select'; // Will create this quickly too
import { Building2, Package, Tag, Clock, ArrowRight } from 'lucide-react';

const mockResults = [
  { id: '1', name: 'Cabo Flexível 35mm 1kV', sku: 'CAB-35-FLX', supplier: 'Brasil Cabos', category: 'Elétrica / Cabos', manufacturer: 'Sil', price: 18.50, status: 'Active', updatedAt: '2026-07-01' },
  { id: '2', name: 'Cabo Flexível 35mm 750V', sku: 'CAB-35-750', supplier: 'Eletro Tudo B2B', category: 'Elétrica / Cabos', manufacturer: 'Prysmian', price: 19.20, status: 'Active', updatedAt: '2026-07-03' },
  { id: '3', name: 'Cabo Nu 35mm Aterramento', sku: 'CAB-35-NU', supplier: 'Brasil Cabos', category: 'Elétrica / Cabos', manufacturer: 'Sil', price: 15.90, status: 'Active', updatedAt: '2026-07-05' },
];

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
      
      {/* Sidebar de Filtros */}
      <aside className="w-full md:w-64 shrink-0 space-y-6">
        <div>
          <h3 className="font-semibold text-slate-900 mb-4">Filtros</h3>
          
          <div className="space-y-4">
            {/* Categoria */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Categoria</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /> Elétrica / Cabos</label>
                <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /> Ferramentas</label>
                <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /> EPI</label>
              </div>
            </div>

            {/* Fabricante */}
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Fabricante</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /> Sil</label>
                <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /> Prysmian</label>
              </div>
            </div>

            {/* Preço */}
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Faixa de Preço</h4>
              <div className="flex gap-2 items-center">
                <input type="number" placeholder="Min" className="w-full h-8 px-2 text-sm border border-slate-300 rounded" />
                <span className="text-slate-400">-</span>
                <input type="number" placeholder="Max" className="w-full h-8 px-2 text-sm border border-slate-300 rounded" />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Resultados */}
      <div className="flex-1 w-full space-y-4">
        
        {/* Topbar: Title & Ordering */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Resultados para "{query}"
            </h2>
            <p className="text-sm text-slate-500">3 produtos encontrados em 2 fornecedores.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Ordenar por:</span>
            <select className="h-9 border border-slate-300 bg-white rounded-md text-sm px-3 focus:ring-indigo-500 focus:border-indigo-500">
              <option>Relevância</option>
              <option>Menor Preço</option>
              <option>Maior Preço</option>
              <option>Mais Recente</option>
              <option>Nome A-Z</option>
            </select>
          </div>
        </div>

        {/* Lista Rica de Produtos (Marketplace Style) */}
        <div className="space-y-3">
          {mockResults.map((item) => (
            <Card key={item.id} className="hover:border-indigo-200 transition-colors group">
              <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center gap-6">
                
                {/* Info Principal */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                      {item.name}
                    </h3>
                    <Badge variant={item.status === 'Active' ? 'success' : 'secondary'} className="h-5">
                      {item.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> SKU: {item.sku}</span>
                    <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {item.category} • {item.manufacturer}</span>
                  </div>
                  <div className="text-sm text-slate-600 font-medium flex items-center gap-1 mt-2">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    Vendido por: <span className="text-indigo-600 hover:underline cursor-pointer">{item.supplier}</span>
                  </div>
                </div>

                {/* Preço e Call to Action */}
                <div className="flex flex-col items-end gap-3 min-w-[200px] border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-1">Preço Referência</p>
                    <p className="text-2xl font-bold text-slate-900">R$ {item.price.toFixed(2)}</p>
                    <p className="text-xs text-slate-400 flex items-center justify-end gap-1 mt-1">
                      <Clock className="h-3 w-3" /> Atualizado em {item.updatedAt}
                    </p>
                  </div>
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                    Cotar Agora <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>

              </CardContent>
            </Card>
          ))}
        </div>

      </div>
    </div>
  );
}
'@

Write-Host "Atualizando Dashboard..."

Create-File "src\modules\dashboard\presentation\pages\DashboardPage.tsx" @'
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Users, Package, FileText, TrendingDown, Clock, Search } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-slate-500">Visão geral da sua inteligência de compras.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fornecedores</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">128</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Produtos</CardTitle>
            <Package className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3.450</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pesquisas Realizadas</CardTitle>
            <Search className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.284</div>
            <p className="text-xs text-slate-500">+12% hoje</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cotações</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">850</div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-900">Economia</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">R$ 184K</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-indigo-600" />
              Produtos Mais Pesquisados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Cabo 35mm', vol: '156 buscas' },
                { name: 'Luva Nitrílica', vol: '98 buscas' },
                { name: 'Parafuso Sextavado', vol: '74 buscas' },
                { name: 'Chapa Inox', vol: '45 buscas' },
                { name: 'Graxa Industrial', vol: '32 buscas' },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <span className="font-medium text-slate-900">{item.name}</span>
                  <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">{item.vol}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
                    <span className="font-medium text-slate-900">{item.name}</span>
                    <span className="text-sm text-slate-500">{item.supplier}</span>
                  </div>
                  <div className="text-sm text-slate-400">
                    {item.date}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
'@

Write-Host "Atualizando Router..."

Create-File "src\kernel\router\index.tsx" @'
import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';

const LoginPage = React.lazy(() => import('../../modules/auth/presentation/pages/LoginPage'));
const DashboardPage = React.lazy(() => import('../../modules/dashboard/presentation/pages/DashboardPage'));
const SuppliersListPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/SuppliersListPage'));
const SupplierFormPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/SupplierFormPage'));
const ProductsListPage = React.lazy(() => import('../../modules/products/presentation/pages/ProductsListPage'));
const ProductFormPage = React.lazy(() => import('../../modules/products/presentation/pages/ProductFormPage'));
const SearchResultsPage = React.lazy(() => import('../../modules/search/presentation/pages/SearchResultsPage'));

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="p-8 flex justify-center text-slate-500">Carregando...</div>}>
    {children}
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    element: <AuthLayout><Outlet /></AuthLayout>,
    children: [
      {
        path: '/login',
        element: <SuspenseWrapper><LoginPage /></SuspenseWrapper>,
      }
    ]
  },
  {
    element: <AppLayout />,
    children: [
      {
        path: '/dashboard',
        element: <SuspenseWrapper><DashboardPage /></SuspenseWrapper>,
      },
      {
        path: '/suppliers',
        element: <SuspenseWrapper><SuppliersListPage /></SuspenseWrapper>,
      },
      {
        path: '/suppliers/new',
        element: <SuspenseWrapper><SupplierFormPage /></SuspenseWrapper>,
      },
      {
        path: '/products',
        element: <SuspenseWrapper><ProductsListPage /></SuspenseWrapper>,
      },
      {
        path: '/products/new',
        element: <SuspenseWrapper><ProductFormPage /></SuspenseWrapper>,
      },
      {
        path: '/search',
        element: <SuspenseWrapper><SearchResultsPage /></SuspenseWrapper>,
      },
    ]
  }
]);
'@

Write-Host "Script de Busca concluído com sucesso."
