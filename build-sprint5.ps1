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

Write-Host "Atualizando .env.example..."

Create-File ".env.example" @'
VITE_SUPABASE_URL=YOUR_SUPABASE_URL_HERE
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE
VITE_USE_MOCK_DATA=true
'@

Write-Host "Criando Configuração Kernel (Env)..."

Create-File "src\kernel\config\env.ts" @'
export const env = {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    useMockData: import.meta.env.VITE_USE_MOCK_DATA === 'true'
};
'@

Write-Host "Gerando Migration Oficial Supabase..."

Create-File "src\infrastructure\supabase\migrations\00_initial_schema.sql" @'
-- SUPPLYHUB - SPRINT 5 INITIAL SCHEMA

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'buyer', 'manager', 'supplier');
CREATE TYPE product_status AS ENUM ('Draft', 'Active', 'Inactive');
CREATE TYPE quotation_status AS ENUM ('Draft', 'Open', 'Closed', 'Cancelled');
CREATE TYPE supplier_quotation_status AS ENUM ('Pending', 'Sent', 'Rejected');

-- 2. ORGANIZATIONS (TENANTS)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    document VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'buyer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUPPLIERS
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    document VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PRODUCTS
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100) NOT NULL,
    uom VARCHAR(20) NOT NULL,
    manufacturer VARCHAR(150),
    price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    status product_status DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. QUOTATION REQUESTS
CREATE TABLE quotation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status quotation_status DEFAULT 'Draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. QUOTATION ITEMS
CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotation_requests(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(15,3) NOT NULL,
    uom VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SUPPLIER QUOTATIONS (BIDS)
CREATE TABLE supplier_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotation_requests(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    price DECIMAL(15,2) NOT NULL,
    delivery_days INT NOT NULL,
    comments TEXT,
    status supplier_quotation_status DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROW LEVEL SECURITY (RLS)

-- Função para obter o tenant_id do usuário logado
CREATE OR REPLACE FUNCTION get_auth_tenant_id() RETURNS UUID AS $$
    SELECT organization_id FROM users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Ativar RLS em todas as tabelas tenant-bound
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quotations ENABLE ROW LEVEL SECURITY;

-- Criar Políticas (Policies) isolando os dados por Tenant
CREATE POLICY tenant_isolation_policy_suppliers ON suppliers USING (tenant_id = get_auth_tenant_id());
CREATE POLICY tenant_isolation_policy_categories ON categories USING (tenant_id = get_auth_tenant_id());
CREATE POLICY tenant_isolation_policy_products ON products USING (tenant_id = get_auth_tenant_id());
CREATE POLICY tenant_isolation_policy_quotations ON quotation_requests USING (tenant_id = get_auth_tenant_id());
-- quotation_items e supplier_quotations herdam a segurança através da junção indireta com o pedido de cotação ou simplesmente verificando o parent.
-- Por segurança profunda:
CREATE POLICY tenant_isolation_policy_items ON quotation_items USING (
    quotation_id IN (SELECT id FROM quotation_requests WHERE tenant_id = get_auth_tenant_id())
);
CREATE POLICY tenant_isolation_policy_bids ON supplier_quotations USING (
    quotation_id IN (SELECT id FROM quotation_requests WHERE tenant_id = get_auth_tenant_id())
);
'@

Write-Host "Criando Procurement Intelligence Dashboard..."

Create-File "src\modules\intelligence\presentation\pages\IntelligenceDashboardPage.tsx" @'
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { TrendingDown, TrendingUp, AlertCircle, BarChart3, PieChart, Activity } from 'lucide-react';
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
                  { name: 'Óleo Lubrificante Hidráulico', diff: '+12.0%', reason: 'Derivados de Petróleo' }
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
'@

Write-Host "Atualizando Sidebar e Router..."

Create-File "src\kernel\layouts\Sidebar.tsx" @'
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import { Building2, Package, Search, Settings, FileText, LayoutDashboard, BarChart3, Users } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Pesquisa Global', href: '/search', icon: Search },
  { name: 'Cotações', href: '/quotations', icon: FileText },
  { name: 'Inteligência', href: '/intelligence', icon: BarChart3 },
  { name: 'Produtos', href: '/products', icon: Package },
  { name: 'Fornecedores', href: '/suppliers', icon: Users },
  { name: 'Organizações', href: '/organizations', icon: Building2 },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center border-b border-slate-200 px-6 shrink-0">
        <span className="text-xl font-bold tracking-tight text-indigo-700">SupplyHub</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-4">
          {navigation.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    isActive ? "text-indigo-700" : "text-slate-400 group-hover:text-slate-500"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-slate-200 p-4">
        <Link
          to="/settings"
          className="group flex items-center rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <Settings className="mr-3 h-5 w-5 text-slate-400 group-hover:text-slate-500" />
          Configurações
        </Link>
      </div>
    </div>
  );
}
'@

Create-File "src\kernel\router\index.tsx" @'
import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';

const LoginPage = React.lazy(() => import('../../modules/auth/presentation/pages/LoginPage'));
const DashboardPage = React.lazy(() => import('../../modules/dashboard/presentation/pages/DashboardPage'));
const IntelligenceDashboardPage = React.lazy(() => import('../../modules/intelligence/presentation/pages/IntelligenceDashboardPage'));
const SuppliersListPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/SuppliersListPage'));
const SupplierFormPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/SupplierFormPage'));
const ProductsListPage = React.lazy(() => import('../../modules/products/presentation/pages/ProductsListPage'));
const ProductFormPage = React.lazy(() => import('../../modules/products/presentation/pages/ProductFormPage'));
const SearchResultsPage = React.lazy(() => import('../../modules/search/presentation/pages/SearchResultsPage'));
const QuotationsListPage = React.lazy(() => import('../../modules/quotations/presentation/pages/QuotationsListPage'));
const NewQuotationPage = React.lazy(() => import('../../modules/quotations/presentation/pages/NewQuotationPage'));
const QuotationComparisonPage = React.lazy(() => import('../../modules/quotations/presentation/pages/QuotationComparisonPage'));

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
        path: '/intelligence',
        element: <SuspenseWrapper><IntelligenceDashboardPage /></SuspenseWrapper>,
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
      {
        path: '/quotations',
        element: <SuspenseWrapper><QuotationsListPage /></SuspenseWrapper>,
      },
      {
        path: '/quotations/new',
        element: <SuspenseWrapper><NewQuotationPage /></SuspenseWrapper>,
      },
      {
        path: '/quotations/:id/compare',
        element: <SuspenseWrapper><QuotationComparisonPage /></SuspenseWrapper>,
      },
    ]
  }
]);
'@

Write-Host "Script Sprint 5 concluído!"
