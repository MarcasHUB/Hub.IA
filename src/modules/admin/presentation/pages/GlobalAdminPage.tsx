import { Link, useLocation } from 'react-router-dom';
import { Shield, ShieldAlert, Building2, Layers, Smartphone, Loader2, Award } from 'lucide-react';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

import OrganizationsListPage from '../../../organizations/presentation/pages/OrganizationsListPage';
import ProductsListPage from '../../../products/presentation/pages/ProductsListPage';
import { CategoriesPage } from '../../../categories/presentation/pages/CategoriesPage';
import SegmentsPage from '../../../employees/presentation/pages/SegmentsPage';
import SupportAdminView from '../../../support/presentation/components/SupportAdminView';
import CertificationsPage from './CertificationsPage';

const ADMIN_SECTIONS = [
  {
    title: 'Cadastros Master',
    items: [
      { id: 'empresas', label: 'Empresas', icon: Building2, href: '/admin/empresas' },
      { id: 'materiais', label: 'Materiais', icon: Layers, href: '/admin/materiais' },
      { id: 'categorias', label: 'Categorias', icon: Layers, href: '/admin/categorias' },
      { id: 'segmentos', label: 'Segmentos', icon: Layers, href: '/admin/segmentos' },
      { id: 'certificacoes', label: 'Certificações', icon: Award, href: '/admin/certificacoes' },
    ]
  },
  {
    title: 'OPERAÇÃO E SUPORTE',
    items: [
      { id: 'suporte', label: 'Suporte', icon: ShieldAlert, href: '/admin/suporte' },
    ]
  },
  {
    title: 'Configurações Avançadas',
    items: [
      { id: 'campo', label: 'App Campo', icon: Smartphone, href: '/admin/campo' },
    ]
  }
];

export default function GlobalAdminPage() {
  const location = useLocation();
  const { data: identity, isLoading } = useAuthenticatedIdentity();

  type Tab = 'empresas' | 'materiais' | 'categorias' | 'segmentos' | 'certificacoes' | 'suporte' | 'campo';

  const activeTab: Tab = (() => {
    if (location.pathname.includes('/materiais')) return 'materiais';
    if (location.pathname.includes('/categorias')) return 'categorias';
    if (location.pathname.includes('/segmentos')) return 'segmentos';
    if (location.pathname.includes('/certificacoes')) return 'certificacoes';
    if (location.pathname.includes('/suporte')) return 'suporte';
    if (location.pathname.includes('/campo')) return 'campo';
    return 'empresas';
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!identity?.isPlatformAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
          <div className="flex">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <div className="ml-3">
              <h3 className="text-sm font-bold text-red-800">Acesso Negado</h3>
              <p className="text-sm text-red-700 mt-2">Você não possui privilégios de SuperAdmin para acessar a Administração Global.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 rounded-2xl mx-6 mt-6 mb-6 px-8 py-8 shadow-md">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Shield className="h-7 w-7 text-indigo-400" />
                Administração Global
              </h1>
              <p className="text-slate-400 mt-1 text-sm max-w-2xl">
                Gerenciamento de acesso e governança mestre da plataforma Hub.IA
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO E SIDEBAR */}
      <div className="flex-1 px-6 pb-8">
        <div className="max-w-[1600px] mx-auto flex gap-6">

          {/* Sidebar de navegação */}
          <aside className="w-56 shrink-0 space-y-6">
            {ADMIN_SECTIONS.map((section, idx) => (
              <div key={idx} className="space-y-1">
                <h3 className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{section.title}</h3>
                {section.items.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <Link
                      key={tab.id}
                      to={tab.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </aside>

          {/* Área de conteúdo */}
          <main className="flex-1 min-w-0">
            {activeTab === 'empresas' && <OrganizationsListPage />}
            {activeTab === 'materiais' && <ProductsListPage masterMaintenanceMode />}
            {activeTab === 'categorias' && <CategoriesPage />}
            {activeTab === 'segmentos' && <SegmentsPage />}
            {activeTab === 'certificacoes' && <CertificationsPage />}
            {activeTab === 'suporte' && <SupportAdminView />}
            {activeTab === 'campo' && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">App Campo</h2>
                <p className="text-slate-600 mb-6">Ambiente de homologação e atualizações do aplicativo de operação de campo antes de colocar em operação.</p>
                <Link 
                  to="/pwa-choice"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 rounded-xl font-bold inline-flex items-center shadow-md transition-colors"
                  title="Testar Acesso APP / Solicitação de Campo"
                >
                  Testar Acesso APP Campo
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
