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

Write-Host "Criando LoginPage..."
Create-File "src\modules\auth\presentation\pages\LoginPage.tsx" @'
import React from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate login
    navigate('/dashboard');
  };

  return (
    <div className="w-full">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">SupplyHub</h1>
        <p className="mt-2 text-sm text-slate-500">Entre com suas credenciais para acessar a plataforma.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail Corporativo</Label>
          <Input id="email" type="email" placeholder="voce@empresa.com" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <a href="#" className="text-sm font-medium text-slate-900 hover:underline">
              Esqueceu a senha?
            </a>
          </div>
          <Input id="password" type="password" required />
        </div>

        <Button type="submit" className="w-full">
          Entrar no Sistema
        </Button>
      </form>
    </div>
  );
}
'@

Write-Host "Criando DashboardPage..."
Create-File "src\modules\dashboard\presentation\pages\DashboardPage.tsx" @'
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Users, Package, FileText, TrendingDown } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard de Compras</h2>
        <p className="text-slate-500">Bem-vindo de volta! Aqui está o resumo das suas operações.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Fornecedores</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">128</div>
            <p className="text-xs text-slate-500">117 ativos no momento</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Categorias Atendidas</CardTitle>
            <Package className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-slate-500">+2 no último mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cotações Realizadas</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,284</div>
            <p className="text-xs text-slate-500">+18% vs mês anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Economia Potencial</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">R$ 184.350</div>
            <p className="text-xs text-slate-500">Preço médio reduzido em 12,4%</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
'@

Write-Host "Criando SuppliersPages..."
Create-File "src\modules\suppliers\presentation\pages\SuppliersListPage.tsx" @'
import React from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { Plus, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const mockSuppliers = [
  { id: '1', name: 'Tech Solutions Ltda', document: '12.345.678/0001-90', category: 'TI & Software', status: 'APPROVED' },
  { id: '2', name: 'Construtora Horizonte', document: '98.765.432/0001-10', category: 'Infraestrutura', status: 'APPROVED' },
  { id: '3', name: 'Logística Rápida S/A', document: '45.123.890/0001-55', category: 'Transporte', status: 'PENDING' },
];

export default function SuppliersListPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fornecedores</h2>
          <p className="text-slate-500">Gerencie a base de fornecedores homologados.</p>
        </div>
        <Button onClick={() => navigate('/suppliers/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Fornecedor
        </Button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razão Social</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Categoria Principal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockSuppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>{supplier.document}</TableCell>
                <TableCell>{supplier.category}</TableCell>
                <TableCell>
                  <Badge variant={supplier.status === 'APPROVED' ? 'success' : 'secondary'}>
                    {supplier.status === 'APPROVED' ? 'Homologado' : 'Pendente'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
'@

Create-File "src\modules\suppliers\presentation\pages\SupplierFormPage.tsx" @'
import React from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { useNavigate } from 'react-router-dom';

export default function SupplierFormPage() {
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/suppliers');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cadastrar Fornecedor</h2>
        <p className="text-slate-500">Preencha os dados básicos para iniciar a homologação.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document">CNPJ / CPF</Label>
              <Input id="document" placeholder="00.000.000/0001-00" required />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Razão Social</Label>
            <Input id="name" placeholder="Empresa Fictícia Ltda" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria Principal</Label>
            <Input id="category" placeholder="Ex: Equipamentos de TI" />
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={() => navigate('/suppliers')}>
            Cancelar
          </Button>
          <Button type="submit">
            Salvar Fornecedor
          </Button>
        </div>
      </form>
    </div>
  );
}
'@

Write-Host "Configurando Router e Atualizando App.tsx..."

Create-File "src\kernel\router\index.tsx" @'
import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';

// Lazy loading pages
const LoginPage = React.lazy(() => import('../../modules/auth/presentation/pages/LoginPage'));
const DashboardPage = React.lazy(() => import('../../modules/dashboard/presentation/pages/DashboardPage'));
const SuppliersListPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/SuppliersListPage'));
const SupplierFormPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/SupplierFormPage'));

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
    ]
  }
]);

// Dummy Outlet since we didn't import it in AuthLayout properly, wait no, let's fix AuthLayout to have Outlet, but actually AuthLayout accepts children. Let's create an intermediary for Auth routes.
import { Outlet } from 'react-router-dom';
'@

Create-File "src\App.tsx" @'
import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/kernel/router';

export default function App() {
  return <RouterProvider router={router} />;
}
'@

Write-Host "Páginas geradas com sucesso."
