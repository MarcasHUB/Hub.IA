import React, { Suspense } from 'react';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import LandingPage from '../../modules/landing/presentation/pages/LandingPage'; // imported directly for speed

const LoginPage = React.lazy(() => import('../../modules/auth/presentation/pages/LoginPage'));
const OnboardingWizardPage = React.lazy(() => import('../../modules/auth/presentation/pages/OnboardingWizardPage'));
const DashboardPage = React.lazy(() => import('../../modules/dashboard/presentation/pages/DashboardPage'));
const IntelligenceDashboardPage = React.lazy(() => import('../../modules/intelligence/presentation/pages/IntelligenceDashboardPage'));
const SuppliersListPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/SuppliersListPage'));
const SupplierFormPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/SupplierFormPage'));
const NetworkPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/NetworkPage'));
const ProductsListPage = React.lazy(() => import('../../modules/products/presentation/pages/ProductsListPage'));
const ProductFormPage = React.lazy(() => import('../../modules/products/presentation/pages/ProductFormPage'));
const SearchResultsPage = React.lazy(() => import('../../modules/search/presentation/pages/SearchResultsPage'));
const QuotationsListPage = React.lazy(() => import('../../modules/quotations/presentation/pages/QuotationsListPage'));
const NewQuotationPage = React.lazy(() => import('../../modules/quotations/presentation/pages/NewQuotationPage'));
const QuotationComparisonPage = React.lazy(() => import('../../modules/quotations/presentation/pages/QuotationComparisonPage'));
const OrganizationPage = React.lazy(() => import('../../modules/organizations/presentation/pages/OrganizationPage'));
const MessagesPage = React.lazy(() => import('../../modules/messages/presentation/pages/MessagesPage'));
const QuotationResponsePage = React.lazy(() => import('../../modules/quotations/presentation/pages/QuotationResponsePage'));
const SettingsPage = React.lazy(() => import('../../modules/settings/presentation/pages/SettingsPage'));
const MinhaEmpresaPage = React.lazy(() => import('../../modules/organizations/presentation/pages/MinhaEmpresaPage'));
const AcceptInvitePage = React.lazy(() => import('../../modules/employees/presentation/pages/AcceptInvitePage'));

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
        path: '/suppliers/network',
        element: <SuspenseWrapper><NetworkPage /></SuspenseWrapper>,
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
        element: <SuspenseWrapper><NewQuotationPage /></SuspenseWrapper>,
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
        element: <SuspenseWrapper><OrganizationPage /></SuspenseWrapper>,
      },
      {
        path: '/messages',
        element: <SuspenseWrapper><MessagesPage /></SuspenseWrapper>,
      },
      {
        path: '/settings',
        element: <SuspenseWrapper><SettingsPage /></SuspenseWrapper>,
      },
      {
        path: '/empresa',
        element: <SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper>,
      },
      {
        path: '/empresa/operadores',
        element: <SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper>,
      },
      {
        path: '/empresa/segmentos',
        element: <SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper>,
      },
      {
        path: '/empresa/delegacoes',
        element: <SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper>,
      },
      {
        path: '/empresa/logs',
        element: <SuspenseWrapper><MinhaEmpresaPage /></SuspenseWrapper>,
      },
    ]
  }
]);