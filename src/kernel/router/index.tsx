import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Outlet, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { CapabilityGuard, IdentityGuard } from './CapabilityGuard';
import LandingPage from '../../modules/landing/presentation/pages/LandingPage'; // imported directly for speed

const GlobalAdminPage = lazy(() => import('../../modules/admin/presentation/pages/GlobalAdminPage'));
const LoginPage = React.lazy(() => import('../../modules/auth/presentation/pages/LoginPage'));
const OnboardingWizardPage = React.lazy(() => import('../../modules/auth/presentation/pages/OnboardingWizardPage'));
const DashboardPage = React.lazy(() => import('../../modules/dashboard/presentation/pages/DashboardPage'));
const HubConnectPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/HubConnectPage'));
const IntelligenceDashboardPage = React.lazy(() => import('../../modules/intelligence/presentation/pages/IntelligenceDashboardPage'));
const SuppliersListPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/SuppliersListPage'));
const SupplierFormPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/SupplierFormPage'));
const NetworkPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/NetworkPage'));
const ProductsListPage = React.lazy(() => import('../../modules/products/presentation/pages/ProductsListPage'));
const ProductFormPage = React.lazy(() => import('../../modules/products/presentation/pages/ProductFormPage'));
const SearchResultsPage = React.lazy(() => import('../../modules/search/presentation/pages/SearchResultsPage'));
const QuotationsListPage = React.lazy(() => import('../../modules/quotations/presentation/pages/QuotationsListPage'));
const QuotationComparisonPage = React.lazy(() => import('../../modules/quotations/presentation/pages/QuotationComparisonPage'));
// OrganizationPage was removed
const OrganizationsListPage = React.lazy(() => import('../../modules/organizations/presentation/pages/OrganizationsListPage'));
const MessagesPage = React.lazy(() => import('../../modules/messages/presentation/pages/MessagesPage'));
const QuotationResponsePage = React.lazy(() => import('../../modules/quotations/presentation/pages/QuotationResponsePage'));
const MinhaEmpresaPage = React.lazy(() => import('../../modules/organizations/presentation/pages/MinhaEmpresaPage'));
const AcceptInvitePage = React.lazy(() => import('../../modules/employees/presentation/pages/AcceptInvitePage'));
const AppAccessChoicePage = React.lazy(() => import('../../modules/landing/presentation/pages/AppAccessChoicePage'));
const MyProfilePage = React.lazy(() => import('../../modules/users/presentation/pages/MyProfilePage').then(module => ({ default: module.MyProfilePage })));

class ChunkErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    if (error?.message?.includes('Failed to fetch dynamically imported module')) {
      return { hasError: true };
    }
    return { hasError: false };
  }

  componentDidCatch(error: Error) {
    if (error?.message?.includes('Failed to fetch dynamically imported module')) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return <div className="p-8 flex justify-center text-slate-500">Atualizando sistema para a versão mais recente...</div>;
    }
    return this.props.children;
  }
}

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <ChunkErrorBoundary>
    <Suspense fallback={<div className="p-8 flex justify-center text-slate-500">Carregando...</div>}>
      {children}
    </Suspense>
  </ChunkErrorBoundary>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/pwa-choice',
    element: <SuspenseWrapper><AppAccessChoicePage /></SuspenseWrapper>,
  },
  {
    path: '/preview-header',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <div className="p-8 h-[200vh] bg-slate-50 text-center text-slate-500">Conteúdo de Exemplo da Página</div>
      }
    ]
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
    path: '/onboarding',
    element: <SuspenseWrapper><OnboardingWizardPage /></SuspenseWrapper>,
  },
  {
    path: '/aceitar-convite',
    element: <SuspenseWrapper><AcceptInvitePage /></SuspenseWrapper>,
  },
  {
    element: <IdentityGuard><AppLayout /></IdentityGuard>,
    children: [
      {
        path: '/dashboard',
        element: <SuspenseWrapper><DashboardPage /></SuspenseWrapper>,
      },
      {
        path: '/hubconnect',
        element: <SuspenseWrapper><HubConnectPage /></SuspenseWrapper>,
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
        path: '/suppliers/network',
        element: <CapabilityGuard capability="network:view"><SuspenseWrapper><NetworkPage /></SuspenseWrapper></CapabilityGuard>,
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
        path: '/products/:id/edit',
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
        element: <Navigate to="/products" replace />,
      },
      {
        path: '/quotations/:id/compare',
        element: <SuspenseWrapper><QuotationComparisonPage /></SuspenseWrapper>,
      },
      {
        path: '/quotations/received/:id',
        element: <SuspenseWrapper><QuotationResponsePage /></SuspenseWrapper>,
      },
      {
        path: '/organizations',
        element: <SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper>,
      },
      {
        path: '/messages',
        element: <SuspenseWrapper><MessagesPage /></SuspenseWrapper>,
      },
      {
        path: '/meus-dados',
        element: <SuspenseWrapper><MyProfilePage /></SuspenseWrapper>,
      },
      {
        path: '/admin',
        element: <CapabilityGuard capability="platform:admin"><SuspenseWrapper><GlobalAdminPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/admin/empresas',
        element: <CapabilityGuard capability="platform:admin"><SuspenseWrapper><GlobalAdminPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/admin/empresas/:id',
        element: <Navigate to="/admin/empresas" replace />,
      },
      {
        path: '/admin/empresas/:id/*',
        element: <Navigate to="/admin/empresas" replace />,
      },
      {
        path: '/admin/materiais',
        element: <CapabilityGuard capability="platform:admin"><SuspenseWrapper><GlobalAdminPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/admin/categorias',
        element: <CapabilityGuard capability="platform:admin"><SuspenseWrapper><GlobalAdminPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/admin/segmentos',
        element: <CapabilityGuard capability="platform:admin"><SuspenseWrapper><GlobalAdminPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/admin/certificacoes',
        element: <CapabilityGuard capability="platform:admin"><SuspenseWrapper><GlobalAdminPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/admin/suporte',
        element: <CapabilityGuard capability="platform:admin"><SuspenseWrapper><GlobalAdminPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/admin/campo',
        element: <CapabilityGuard capability="platform:admin"><SuspenseWrapper><GlobalAdminPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/admin/app-campo',
        element: <CapabilityGuard capability="platform:admin"><SuspenseWrapper><GlobalAdminPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/empresa',
        element: <CapabilityGuard capability="company:view"><SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/empresa/:id',
        element: <Navigate to="/empresa" replace />,
      },
      {
        path: '/empresa/comercial',
        element: <CapabilityGuard capability="company:view"><SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/empresa/colaboradores',
        element: <CapabilityGuard capability="operators:view"><SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/empresa/operadores', // backward compat
        element: <CapabilityGuard capability="operators:view"><SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/empresa/solicitantes',
        element: <CapabilityGuard capability="operators:view"><SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/empresa/permissoes',
        element: <CapabilityGuard capability="operators:manage"><SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/empresa/aprovacoes',
        element: <CapabilityGuard capability="operators:manage"><SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/empresa/delegacoes',
        element: <CapabilityGuard capability="delegations:view"><SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/empresa/logs',
        element: <CapabilityGuard capability="logs:view"><SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/empresa/compliance',
        element: <CapabilityGuard capability="logs:view"><SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/empresa/suporte',
        element: <CapabilityGuard capability="company:view"><SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper></CapabilityGuard>,
      },
      {
        path: '/empresa/empresas',
        element: <Navigate to="/admin/empresas" replace />,
      }
    ]
  }
]);
