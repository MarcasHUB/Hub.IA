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

Write-Host "Criando módulo Landing Page..."

Create-File "src\modules\landing\presentation\pages\LandingPage.tsx" @'
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Search, BarChart3, Mail, Trophy, Check, X, ArrowRight, Zap, Target, Shield, Box, Factory, Sprout, Tractor, Pickaxe, HardHat, Truck } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg leading-none">S</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">SupplyHub</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="hidden sm:inline-flex text-slate-600" onClick={() => navigate('/login')}>
              Fazer Login
            </Button>
            <Button className="bg-slate-900 text-white hover:bg-indigo-600 transition-colors" onClick={() => navigate('/login')}>
              Começar Agora
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* SEÇÃO 1 - HERO */}
        <section className="relative overflow-hidden bg-white pt-24 pb-32">
          {/* Background Gradients */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100/50 via-white to-white pointer-events-none" />
          
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-12">
            <div className="w-full lg:w-1/2 space-y-8 text-center lg:text-left">
              <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-600 mb-4">
                <span className="flex h-2 w-2 rounded-full bg-indigo-600 mr-2 animate-pulse"></span>
                A revolução no B2B chegou
              </div>
              <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
                O Marketplace <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">Inteligente</span> para Compras Corporativas
              </h1>
              <p className="max-w-2xl text-lg text-slate-600 mx-auto lg:mx-0">
                Conecte fornecedores, produtos e cotações em uma única plataforma e tome decisões com base em dados reais.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Button size="lg" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white h-14 px-8 text-lg rounded-full shadow-lg shadow-indigo-200 transition-transform hover:-translate-y-1" onClick={() => navigate('/login')}>
                  Começar Agora <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full border-slate-300 hover:bg-slate-50" onClick={() => navigate('/login')}>
                  Ver Demonstração
                </Button>
              </div>
            </div>
            
            {/* Hero Image/Mockup */}
            <div className="w-full lg:w-1/2 relative perspective-1000">
              <div className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 p-2 transform rotate-y-[-5deg] rotate-x-[5deg] transition-transform duration-500 hover:rotate-0">
                <div className="absolute -top-4 -right-4 h-24 w-24 bg-gradient-to-br from-cyan-400 to-indigo-500 rounded-full blur-2xl opacity-50"></div>
                <div className="absolute -bottom-4 -left-4 h-32 w-32 bg-gradient-to-tr from-indigo-400 to-purple-500 rounded-full blur-2xl opacity-40"></div>
                <img 
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=1000" 
                  alt="SupplyHub Dashboard Preview" 
                  className="rounded-xl border border-slate-100 relative z-10 w-full h-auto object-cover opacity-90"
                />
                {/* Overlay UI elements to make it look like our app */}
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    <div className="bg-white/90 backdrop-blur rounded-xl shadow-xl p-4 border border-slate-200 w-3/4 translate-y-8 translate-x-4">
                        <div className="flex items-center gap-3 mb-3 border-b border-slate-100 pb-3">
                            <Search className="h-5 w-5 text-indigo-500" />
                            <div className="h-2 w-1/2 bg-slate-200 rounded"></div>
                        </div>
                        <div className="flex justify-between items-center">
                             <div className="h-2 w-1/4 bg-slate-200 rounded"></div>
                             <div className="h-6 w-24 bg-indigo-100 rounded-full"></div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO 2 - BENEFÍCIOS */}
        <section className="bg-slate-50 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Por que escolher o SupplyHub?</h2>
              <p className="mt-4 text-lg text-slate-600">A plataforma definitiva para modernizar sua área de suprimentos.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: Search, title: 'Busca Inteligente', desc: 'Encontre produtos e fornecedores em segundos.' },
                { icon: BarChart3, title: 'Inteligência de Compras', desc: 'Transforme dados em economia real.' },
                { icon: Mail, title: 'Cotações Digitais', desc: 'Elimine e-mails, planilhas e WhatsApp.' },
                { icon: Trophy, title: 'Ranking de Fornecedores', desc: 'Escolha os melhores parceiros com base em desempenho.' },
              ].map((item, idx) => (
                <div key={idx} className="group relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md hover:border-indigo-200">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-slate-900">{item.title}</h3>
                  <p className="text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SEÇÃO 3 - COMO FUNCIONA */}
        <section className="bg-white py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Como Funciona</h2>
              <p className="mt-4 text-lg text-slate-600">Um fluxo simples, contínuo e altamente eficiente.</p>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative">
              {/* Decorative line */}
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10 -translate-y-1/2"></div>
              
              {[
                { step: '1', title: 'Cadastre Fornecedores' },
                { step: '2', title: 'Organize Produtos' },
                { step: '3', title: 'Pesquise e Compare' },
                { step: '4', title: 'Solicite Cotações' },
                { step: '5', title: 'Gere Economia', highlight: true },
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col items-center text-center bg-white px-2 z-10 w-full md:w-auto">
                  <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full border-4 font-bold text-lg ${item.highlight ? 'border-indigo-100 bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'border-white bg-slate-100 text-slate-600'}`}>
                    {item.step}
                  </div>
                  <h4 className={`font-semibold ${item.highlight ? 'text-indigo-600' : 'text-slate-900'}`}>{item.title}</h4>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SEÇÃO 4 - DASHBOARD PREVIEW */}
        <section className="bg-slate-900 py-24 text-white overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Dados que geram resultados</h2>
              <p className="mt-4 text-lg text-slate-400">Tenha o controle absoluto de toda a sua operação de suprimentos.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
              {[
                { label: 'Economia Acumulada', value: 'R$ 1.250.000', color: 'text-green-400' },
                { label: 'Fornecedores', value: '128', color: 'text-white' },
                { label: 'Produtos', value: '3.450', color: 'text-white' },
                { label: 'Cotações', value: '1.284', color: 'text-white' },
              ].map((stat, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-800/50 p-6 text-center backdrop-blur-sm">
                  <p className="text-sm font-medium text-slate-400 mb-2">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Fake Chart Illustration */}
            <div className="w-full max-w-4xl mx-auto h-64 rounded-xl border border-slate-700 bg-gradient-to-b from-slate-800/50 to-transparent p-4 flex items-end gap-2 justify-center opacity-80">
              {[40, 55, 45, 70, 60, 85, 75, 100, 90, 110].map((h, i) => (
                <div key={i} className="w-12 bg-indigo-500 rounded-t-sm transition-all hover:bg-indigo-400" style={{ height: `${h}%` }}></div>
              ))}
            </div>
          </div>
        </section>

        {/* SEÇÃO 5 - DIFERENCIAIS */}
        <section className="bg-white py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Abandone o passado</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-10">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-sm">Método Atual</span>
                </h3>
                <ul className="space-y-4">
                  {[
                    'Uso excessivo de Excel',
                    'Cotações perdidas em E-mail',
                    'Negociações via WhatsApp',
                    'Falta de histórico e auditoria'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-600">
                      <div className="rounded-full bg-red-100 p-1"><X className="h-4 w-4 text-red-600" /></div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl border border-indigo-200 bg-white p-10 shadow-xl shadow-indigo-100/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3"><Shield className="h-24 w-24 text-indigo-50 opacity-50" /></div>
                <h3 className="text-xl font-bold text-indigo-900 mb-6 flex items-center gap-2 relative z-10">
                  <span className="bg-indigo-600 text-white px-2 py-1 rounded text-sm">SupplyHub</span>
                </h3>
                <ul className="space-y-4 relative z-10">
                  {[
                    'Busca Inteligente em catálogo',
                    'Histórico automático de preços',
                    'Comparação automática de matriz',
                    'Inteligência de compras integrada'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-800 font-medium">
                      <div className="rounded-full bg-green-100 p-1"><Check className="h-4 w-4 text-green-600" /></div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO 6 - SEGMENTOS */}
        <section className="bg-slate-50 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Para todos os setores</h2>
              <p className="mt-4 text-lg text-slate-600">O SupplyHub adapta-se à complexidade do seu segmento.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { icon: Factory, name: 'Indústrias' },
                { icon: Tractor, name: 'Agronegócio' },
                { icon: Zap, name: 'Energia' },
                { icon: Pickaxe, name: 'Mineração' },
                { icon: HardHat, name: 'Construção' },
                { icon: Truck, name: 'Logística' },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center justify-center rounded-2xl bg-white p-6 border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group">
                  <item.icon className="h-10 w-10 text-slate-400 group-hover:text-indigo-600 mb-3 transition-colors" />
                  <span className="font-semibold text-slate-900">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SEÇÃO 7 - VISÃO FUTURA */}
        <section className="bg-white py-24 overflow-hidden relative">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3">
             <Target className="h-96 w-96 text-slate-50" />
          </div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl mb-8">Preparado para o futuro</h2>
              <p className="text-lg text-slate-600 mb-8">A nossa arquitetura foi desenhada para escalar com a sua empresa. O que já está no nosso radar:</p>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  'IA para Compras Preditivas',
                  'Integração nativa SAP',
                  'Integração nativa TOTVS',
                  'Portal exclusivo do Fornecedor',
                  'Aplicativo Mobile de Aprovações'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div className="h-6 w-6 rounded bg-indigo-100 flex items-center justify-center shrink-0">
                       <Check className="h-4 w-4 text-indigo-600" />
                    </div>
                    <span className="font-medium text-slate-800">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO 8 - CTA FINAL */}
        <section className="bg-indigo-900 py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl mb-6">
              Pronto para transformar suas compras corporativas?
            </h2>
            <p className="text-xl text-indigo-200 mb-10">
              Junte-se à revolução B2B. Reduza custos, ganhe agilidade e tenha controle total.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="w-full sm:w-auto bg-white text-indigo-900 hover:bg-slate-100 h-14 px-10 text-lg rounded-full shadow-xl">
                Começar Agora
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-10 text-lg rounded-full border-indigo-400 text-white hover:bg-indigo-800" onClick={() => navigate('/login')}>
                Fazer Login
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="h-6 w-6 rounded bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">S</span>
            </div>
            <span className="font-semibold text-slate-900">SupplyHub</span>
          </div>
          <p className="text-sm text-slate-500">© 2026 SupplyHub. Todos os direitos reservados.</p>
        </div>
      </footer>
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
import LandingPage from '../../modules/landing/presentation/pages/LandingPage'; // imported directly for speed

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
    element: <LandingPage />,
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

Write-Host "Script de Landing Page concluído com sucesso."
