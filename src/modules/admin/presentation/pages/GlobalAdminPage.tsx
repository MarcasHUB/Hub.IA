import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, ShieldAlert, Users, Building2, Layers, Smartphone, Loader2 } from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';

import GlobalUsersTab from './GlobalUsersTab';
import OrganizationsListPage from '../../../organizations/presentation/pages/OrganizationsListPage';
import ProductsListPage from '../../../products/presentation/pages/ProductsListPage';
import { CategoriesPage } from '../../../categories/presentation/pages/CategoriesPage';
import SegmentsPage from '../../../employees/presentation/pages/SegmentsPage';

const ADMIN_SECTIONS = [
  {
    title: 'Governança',
    items: [
      { id: 'usuarios', label: 'Usuários da Plataforma', icon: Users, href: '/admin' },
      { id: 'empresas', label: 'Master de Empresas', icon: Building2, href: '/admin/empresas' },
    ]
  },
  {
    title: 'Catálogos Master',
    items: [
      { id: 'materiais', label: 'Materiais Globais', icon: Layers, href: '/admin/materiais' },
      { id: 'categorias', label: 'Categorias Padrão', icon: Layers, href: '/admin/categorias' },
      { id: 'segmentos', label: 'Segmentos Padrão', icon: Layers, href: '/admin/segmentos' },
    ]
  },
  {
    title: 'Operação de Campo',
    items: [
      { id: 'campo', label: 'App Campo', icon: Smartphone, href: '/admin/campo' },
    ]
  }
];

export default function GlobalAdminPage() {
  const location = useLocation();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: currentUser } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single();

      setIsSuperAdmin(currentUser?.is_super_admin === true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  type Tab = 'usuarios' | 'empresas' | 'materiais' | 'categorias' | 'segmentos' | 'campo';

  const activeTab: Tab = (() => {
    if (location.pathname.includes('/empresas')) return 'empresas';
    if (location.pathname.includes('/materiais')) return 'materiais';
    if (location.pathname.includes('/categorias')) return 'categorias';
    if (location.pathname.includes('/segmentos')) return 'segmentos';
    if (location.pathname.includes('/campo')) return 'campo';
    return 'usuarios';
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isSuperAdmin) {
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
      <div className="bg-purple-900 rounded-2xl mx-6 mt-6 mb-6 px-8 py-8 shadow-md">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Shield className="h-7 w-7 text-purple-400" />
                Administração Global
              </h1>
              <p className="text-purple-200 mt-1 text-sm max-w-2xl">
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
                          ? 'bg-purple-600 text-white shadow-sm'
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
            {activeTab === 'usuarios' && <GlobalUsersTab />}
            {activeTab === 'empresas' && <OrganizationsListPage />}
            {activeTab === 'materiais' && <ProductsListPage />}
            {activeTab === 'categorias' && <CategoriesPage />}
            {activeTab === 'segmentos' && <SegmentsPage />}
            {activeTab === 'campo' && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Smartphone className="h-14 w-14 mb-4 text-slate-200" />
                <p className="font-medium">App Campo Master</p>
                <p className="text-sm mt-1">Gestão de permissões de aplicativo em desenvolvimento.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
