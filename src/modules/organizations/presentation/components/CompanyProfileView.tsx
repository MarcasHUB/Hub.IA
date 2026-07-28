import { useState, useEffect } from 'react';
import { useLocation, Link, useParams, useNavigate } from 'react-router-dom';
import {
  Building2, Upload, FileText, CheckCircle2, ChevronRight, Save, Store, Truck, BadgeDollarSign, ShieldCheck, Mail, MapPin,
  Users, Layers, ArrowLeftRight, ScrollText,
  Globe, Phone, Hash, Shield, UserCheck,
  Sparkles, ChevronDown, Tag, XCircle
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent } from '@/shared/components/ui/Card';
import DelegationsPage from '../../../employees/presentation/pages/DelegationsPage';
import AccessLogsPage from '../../../employees/presentation/pages/AccessLogsPage';
import OperatorsPage from '../../../employees/presentation/pages/OperatorsPage';
import { supabase } from '@/infrastructure/supabase/client';

export interface CompanyProfileViewProps {
  organizationId: string;
}
// â”€â”€â”€ Tipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type Tab = 'dados' | 'comercial' | 'colaboradores' | 'solicitantes' | 'permissoes' | 'aprovacoes' | 'delegacoes' | 'logs';

const EMPRESA_SECTIONS = [
  {
    title: 'DADOS DA EMPRESA',
    items: [
      { id: 'dados', label: 'Dados da Empresa', icon: Building2, href: '/empresa' },
    ]
  },
  {
    title: 'PESSOAS',
    items: [
      { id: 'colaboradores', label: 'Colaboradores', icon: Users, href: '/empresa/colaboradores' },
      { id: 'solicitantes', label: 'Solicitantes', icon: UserCheck, href: '/empresa/solicitantes' },
    ]
  },
  {
    title: 'GOVERNANÇA',
    items: [
      { id: 'permissoes', label: 'Permissões', icon: Shield, href: '/empresa/permissoes' },
      { id: 'aprovacoes', label: 'Aprovações', icon: CheckCircle2, href: '/empresa/aprovacoes' },
    ]
  },
  {
    title: 'OPERAÇÃO',
    items: [
      { id: 'delegacoes', label: 'Delegações', icon: ArrowLeftRight, href: '/empresa/delegacoes' },
      { id: 'logs', label: 'Logs', icon: ScrollText, href: '/empresa/logs' },
    ]
  }
];

const Field = ({
  label, icon: Icon, value, onChange, type = 'text', placeholder, hint,
}: {
  label: string; icon: any; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string;
}) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
      <Icon className="h-3 w-3" /> {label}
    </label>
    <Input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 text-sm"
    />
    {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
  </div>
);

// ─── UTILS ──────────────────────────────────────────────────────────────────
const applyMask = (field: string, value: string) => {
  let v = value.replace(/\D/g, '');
  if (field === 'cnpj') {
    v = v.slice(0, 14);
    return v
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  if (field === 'telefone' || field === 'whatsapp') {
    v = v.slice(0, 11);
    if (v.length === 0) return '';
    if (v.length <= 2) return `(${v}`;
    if (v.length <= 6) return `(${v.slice(0,2)}) ${v.slice(2)}`;
    if (v.length <= 10) return `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`;
    return `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
  }
  if (field === 'cep') {
    v = v.slice(0, 8);
    if (v.length <= 5) return v;
    return `${v.slice(0,5)}-${v.slice(5)}`;
  }
  return value;
};

// ─── DadosEmpresaTab ─────────────────────────────────────────────────────────
import { useOrganizationProfile, organizationProfileKeys } from '../hooks/useOrganizationProfile';
import { useSaveOrganizationProfile } from '../hooks/useSaveOrganizationProfile';
import { CompanyProfileForm } from './CompanyProfileForm';
import { useQueryClient } from '@tanstack/react-query';

function DadosEmpresaTab({ organizationId }: { organizationId: string }) {
  const { 
    organization, 
    cnaes, 
    secondaryCnaes, 
    segments, 
    certifications, 
    coverageStates, 
    isLoading,
    isError
  } = useOrganizationProfile(organizationId);

  const queryClient = useQueryClient();
  const { saveProfile } = useSaveOrganizationProfile();

  const handleSave = async (formData: any) => {
    await saveProfile(organizationId, formData);
    queryClient.invalidateQueries({ queryKey: organizationProfileKeys.detail(organizationId) });
  };

  if (isLoading) return <div className="p-8 flex justify-center text-slate-500">Carregando dados da empresa...</div>;
  if (isError) return <div className="p-8 text-red-500">Erro ao carregar os dados da empresa.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Dados da Empresa</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Informações institucionais utilizadas em convites, notificações e relatórios da Hub.IA.
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Perfil Público</p>
            <p className="text-sm font-bold text-slate-900">{organization?.profile_completion || 50}% Completo</p>
          </div>
          <div className="h-10 w-10 rounded-full border-[3px] border-slate-100 flex items-center justify-center relative">
            <svg className="absolute inset-0 h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={organization?.profile_completion === 100 ? '#10b981' : '#4f46e5'}
                strokeWidth="3"
                strokeDasharray={`${organization?.profile_completion || 50}, 100`}
              />
            </svg>
            <span className="text-[9px] font-bold text-slate-600">{organization?.profile_completion || 50}%</span>
          </div>
        </div>
      </div>
      
      <CompanyProfileForm 
        organizationId={organizationId}
        initialData={organization}
        initialCnaes={cnaes}
        initialSecondaryCnaes={secondaryCnaes}
        initialSegments={segments}
        initialCertifications={certifications}
        initialCoverageStates={coverageStates}
        onSave={handleSave}
      />

      {/* Card de aviso Hub.IA */}
      <Card className="rounded-2xl border-indigo-100 bg-indigo-50/50 shadow-sm">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="h-9 w-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-indigo-900">Base da Inteligência Hub.IA</p>
            <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">
              Estes dados alimentam os modelos de inteligência da Hub.IA para recomendações de fornecedores,
              alertas de saving e análises de cobertura de segmentos.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


// ─── CompanyProfileView ─────────────────────────────────────────────────────────
export default function CompanyProfileView({ organizationId }: CompanyProfileViewProps) {
  const location = useLocation();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [companyName, setCompanyName] = useState('SupplyHub B2B');

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('is_super_admin').eq('user_id', user.id).single();
        setIsSuperAdmin(data?.is_super_admin === true);
      }
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    const fetchOrgName = async () => {
      setCompanyName(localStorage.getItem('supplyhub_company_name') || 'Minha Empresa');
    };
    fetchOrgName();
  }, [organizationId]);

  const activeTab: Tab = (() => {
    if (location.pathname.includes('/colaboradores') || location.pathname.includes('/operadores')) return 'colaboradores';
    if (location.pathname.includes('/solicitantes')) return 'solicitantes';
    if (location.pathname.includes('/permissoes')) return 'permissoes';
    if (location.pathname.includes('/aprovacoes')) return 'aprovacoes';
    if (location.pathname.includes('/delegacoes')) return 'delegacoes';
    if (location.pathname.includes('/logs')) return 'logs';
    return 'dados';
  })();

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">

      {/* HEADER BANNER */}
      <div className="bg-slate-900 rounded-2xl mx-6 mt-6 mb-6 px-8 pt-8 pb-8 shadow-md">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Globe className="h-7 w-7 text-indigo-400" />
                Minha Empresa
              </h1>
              <p className="text-slate-400 mt-1 text-sm max-w-2xl">
                Governança de operadores, segmentos, acessos e inteligência Hub.IA para{' '}
                <strong className="text-white">{companyName}</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="flex-1 px-6 pb-8">
        <div className="max-w-[1600px] mx-auto flex gap-6">

          {/* Sidebar de navegação */}
          <aside className="w-56 shrink-0 space-y-6">
            {EMPRESA_SECTIONS.map((section, idx) => (
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
            {activeTab === 'dados' && <DadosEmpresaTab organizationId={organizationId} />}
            
            {activeTab === 'colaboradores' && <OperatorsPage organizationId={organizationId} />}
            {activeTab === 'solicitantes' && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Solicitantes</h2>
                <p className="text-slate-600">Gestão de solicitantes (Em breve).</p>
              </div>
            )}
            {activeTab === 'permissoes' && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Permissões</h2>
                <p className="text-slate-600">Gestão de permissões de acesso (Em breve).</p>
              </div>
            )}
            {activeTab === 'aprovacoes' && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Aprovações</h2>
                <p className="text-slate-600">Gestão de alçadas de aprovação (Em breve).</p>
              </div>
            )}
            {activeTab === 'delegacoes' && <DelegationsPage organizationId={organizationId} />}
            {activeTab === 'logs' && <AccessLogsPage organizationId={organizationId} />}
          </main>
        </div>
      </div>
    </div>
  );
}
