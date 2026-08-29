import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Building2, Upload, FileText, CheckCircle2, ChevronRight, Save, Store, Truck, BadgeDollarSign, ShieldCheck, Mail, MapPin,
  Users, Layers, ArrowLeftRight, ScrollText,
  Globe, Phone, Hash, Shield, UserCheck, ShieldAlert,
  Sparkles, ChevronDown, Tag, XCircle
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent } from '@/shared/components/ui/Card';
import DelegationsPage from '../../../employees/presentation/pages/DelegationsPage';
import AccessLogsPage from '../../../employees/presentation/pages/AccessLogsPage';
import OperatorsPage from '../../../employees/presentation/pages/OperatorsPage';
import { complianceRepository, ComplianceEvent } from '../../infrastructure/repositories/SupabaseComplianceRepository';
import SupportTenantView from '../../../support/presentation/components/SupportTenantView';
import RequestersPage from '../pages/RequestersPage';
import QuotationApprovalsPage from '../pages/QuotationApprovalsPage';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';
import { canIdentity, type Capability } from '@/core/config/permissions';
import type { CanonicalRole } from '@/core/config/roles';
import { calculateOrganizationProfileCompletion, getOrganizationProfileMissingFields } from '../../application/utils/profileCompletion';
// Types
type Tab = 'dados' | 'comercial' | 'colaboradores' | 'solicitantes' | 'permissoes' | 'aprovacoes' | 'delegacoes' | 'logs' | 'suporte';
type CompanyTab = Tab | 'compliance';

const EMPRESA_SECTIONS: Array<{
  title: string;
  items: Array<{ id: CompanyTab; label: string; icon: typeof Building2; href: string; capability: Capability }>;
}> = [
  {
    title: 'DADOS DA EMPRESA',
    items: [
      { id: 'dados', label: 'Dados da Empresa', icon: Building2, href: '/empresa', capability: 'company:view' },
    ]
  },
  {
    title: 'PESSOAS',
    items: [
      { id: 'colaboradores', label: 'Colaboradores', icon: Users, href: '/empresa/colaboradores', capability: 'operators:view' },
      { id: 'solicitantes', label: 'Solicitantes', icon: UserCheck, href: '/empresa/solicitantes', capability: 'operators:view' },
    ]
  },
  {
    title: 'GOVERNANÇA',
    items: [
      { id: 'permissoes', label: 'Permissões', icon: Shield, href: '/empresa/permissoes', capability: 'operators:manage' },
      { id: 'aprovacoes', label: 'Aprovações', icon: CheckCircle2, href: '/empresa/aprovacoes', capability: 'operators:manage' },
      { id: 'compliance', label: 'Compliance', icon: ShieldCheck, href: '/empresa/compliance', capability: 'logs:view' },
    ]
  },
  {
    title: 'OPERAÇÃO',
    items: [
      { id: 'delegacoes', label: 'Delegações', icon: ArrowLeftRight, href: '/empresa/delegacoes', capability: 'delegations:view' },
      { id: 'logs', label: 'Logs', icon: ScrollText, href: '/empresa/logs', capability: 'logs:view' },
    ]
  },
  {
    title: 'SUPORTE',
    items: [
      { id: 'suporte', label: 'Suporte Hub.IA', icon: ShieldAlert, href: '/empresa/suporte', capability: 'company:view' },
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

function DadosEmpresaTab({ authUserId, organizationId, isOrgAdmin }: { authUserId: string; organizationId: string; isOrgAdmin: boolean }) {
  const { 
    organization, 
    cnaes, 
    primaryCnae,
    secondaryCnaes, 
    segments, 
    certifications, 
    coverageStates, 
    isLoading,
    isError
  } = useOrganizationProfile(authUserId, organizationId);

  const queryClient = useQueryClient();
  const { saveProfile } = useSaveOrganizationProfile();

  const completionInput = organization ? {
    razaoSocial: organization.name,
    nomeFantasia: organization.trade_name,
    cnpj: organization.document,
    emailCorporativo: organization.commercial_email,
    telefone: organization.phone,
    whatsapp: organization.whatsapp,
    addressZipCode: organization.address_zip_code,
    addressStreet: organization.address_street,
    addressNumber: organization.address_number,
    addressNeighborhood: organization.address_neighborhood,
    city: organization.address_city,
    state: organization.address_state,
    logoUrl: organization.logo_url,
    website: organization.website,
    tipoEmpresa: organization.tipo_empresa,
    perfilComercial: organization.commercialProfile,
    cnaePrincipal: primaryCnae,
    geographicCoverageType: organization.geographic_coverage_type,
    raioAtendimentoKm: organization.raio_atendimento_km,
    estadosAtendidos: coverageStates,
    segmentIds: segments,
  } : null;
  const currentCompletion = completionInput ? calculateOrganizationProfileCompletion(completionInput) : 0;
  const missingFields = completionInput ? getOrganizationProfileMissingFields(completionInput) : [];

  const handleSave = async (formData: any) => {
    await saveProfile(organizationId, formData);
    await queryClient.invalidateQueries({ queryKey: organizationProfileKeys.mine(authUserId, organizationId) });
    window.dispatchEvent(new CustomEvent('company_profile_updated', {
      detail: { authUserId, organizationId },
    }));
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
            <p className="text-sm font-bold text-slate-900">{currentCompletion}% Completo</p>
          </div>
          <div className="h-10 w-10 rounded-full border-[3px] border-slate-100 flex items-center justify-center relative">
            <svg className="absolute inset-0 h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={currentCompletion === 100 ? '#10b981' : '#4f46e5'}
                strokeWidth="3"
                strokeDasharray={`${currentCompletion}, 100`}
              />
            </svg>
            <span className="text-[9px] font-bold text-slate-600">{currentCompletion}%</span>
          </div>
        </div>
      </div>
      {missingFields.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <strong>Campos pendentes:</strong> {missingFields.join(', ')}.
        </div>
      )}
      
      <CompanyProfileForm 
        authUserId={authUserId}
        organizationId={organizationId}
        initialData={organization}
        initialCnaes={cnaes}
        initialSecondaryCnaes={secondaryCnaes}
        initialSegments={segments}
        initialCertifications={certifications}
        initialCoverageStates={coverageStates}
        onSave={handleSave}
        readOnly={!isOrgAdmin}
        isSuperAdmin={false}
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

function ComplianceTab({ organizationId }: { organizationId: string }) {
  const [events, setEvents] = useState<ComplianceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<ComplianceEvent | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);

  useEffect(() => {
    complianceRepository.getEvents(organizationId).then(data => {
      setEvents(data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [organizationId]);

  if (loading) return <div className="p-8 flex justify-center text-slate-500">Carregando compliance...</div>;

  const handleAnalyzeContext = async (event: ComplianceEvent) => {
    setSelectedEvent(event);
    setAnalysis('');
    setAnalysisError('');
    setAnalysisLoading(true);
    try {
      setAnalysis(await complianceRepository.analyzeContext(event.id));
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Não foi possível analisar o contexto.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const totalEvents = events.length;
  const flaggedEvents = events.filter(e => e.event_type === 'attachment_flagged').length;
  const cancelledEvents = events.filter(e => e.event_type === 'upload_cancelled').length;
  const highRisk = events.filter(e => e.risk_level === 'high').length;

  return (
    <div className="space-y-6 max-w-5xl">
       <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
         <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-800">Compliance & Segurança</h2>
         </div>
         <p className="text-slate-600 mb-8">
            Acompanhe eventos de segurança, anexos sensíveis e bloqueios de DLP na sua organização.
         </p>
         
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-slate-500">Total de Eventos</p>
                <p className="text-2xl font-bold mt-2">{totalEvents}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-slate-500">Envios Confirmados</p>
                <p className="text-2xl font-bold mt-2 text-amber-600">{flaggedEvents}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-slate-500">Envios Cancelados</p>
                <p className="text-2xl font-bold mt-2 text-green-600">{cancelledEvents}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-slate-500">Alto Risco</p>
                <p className="text-2xl font-bold mt-2 text-red-600">{highRisk}</p>
              </CardContent>
            </Card>
         </div>

         <h3 className="font-bold text-slate-800 mb-4">Registro de Eventos</h3>
         {events.length === 0 ? (
           <p className="text-sm text-slate-400">Nenhum evento registrado no período.</p>
         ) : (
           <div className="overflow-x-auto">
             <table className="w-full text-sm text-left border-collapse">
               <thead>
                 <tr className="border-b border-slate-200 bg-slate-50">
                   <th className="p-3 font-semibold text-slate-600">Data</th>
                   <th className="p-3 font-semibold text-slate-600">Usuário</th>
                   <th className="p-3 font-semibold text-slate-600">Destino</th>
                   <th className="p-3 font-semibold text-slate-600">Arquivo</th>
                   <th className="p-3 font-semibold text-slate-600">Risco</th>
                   <th className="p-3 font-semibold text-slate-600">Situação</th>
                   <th className="p-3 font-semibold text-slate-600">Ação</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {events.map(ev => (
                   <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                     <td className="p-3 text-slate-500 whitespace-nowrap">{new Date(ev.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                     <td className="p-3 text-slate-700">{ev.sender_name || ev.sender_user?.full_name || ev.sender_user_id}</td>
                     <td className="p-3 text-slate-700">{ev.recipient_name || ev.recipient_organization?.name || 'Desconhecido'}</td>
                     <td className="p-3 text-slate-700 font-medium max-w-[200px] truncate" title={ev.file_name || ''}>{ev.file_name}</td>
                     <td className="p-3">
                       <span className={`px-2 py-1 rounded text-xs font-bold ${ev.risk_level === 'high' ? 'bg-red-100 text-red-700' : ev.risk_level === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                         {ev.risk_level.toUpperCase()}
                       </span>
                     </td>
                     <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${ev.event_type === 'upload_cancelled' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {ev.event_type === 'upload_cancelled' ? 'Cancelado' : 'Enviado'}
                        </span>
                     </td>
                     <td className="p-3">
                       <button 
                         onClick={() => void handleAnalyzeContext(ev)}
                         className="px-3 py-1 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium whitespace-nowrap"
                       >
                         Analisar contexto
                       </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         )}
       </div>
       {selectedEvent && (
         <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
           <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-white p-6 shadow-2xl">
             <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold text-slate-900">Análise de contexto</h3><p className="mt-1 text-xs text-slate-500">Evento {selectedEvent.event_type} · {new Date(selectedEvent.created_at).toLocaleString('pt-BR')}</p></div><button onClick={() => setSelectedEvent(null)} className="rounded-full p-2 hover:bg-slate-100"><XCircle className="h-5 w-5" /></button></div>
             <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl border bg-slate-50 p-3"><strong className="block text-[10px] uppercase text-slate-400">Usuário</strong>{selectedEvent.sender_name || selectedEvent.sender_user?.full_name || selectedEvent.sender_user_id}</div><div className="rounded-xl border bg-slate-50 p-3"><strong className="block text-[10px] uppercase text-slate-400">Destino</strong>{selectedEvent.recipient_name || selectedEvent.recipient_organization?.name || 'Não aplicável'}</div><div className="rounded-xl border bg-slate-50 p-3"><strong className="block text-[10px] uppercase text-slate-400">Risco</strong>{selectedEvent.risk_level}</div><div className="rounded-xl border bg-slate-50 p-3"><strong className="block text-[10px] uppercase text-slate-400">Arquivo</strong>{selectedEvent.file_name || 'Não aplicável'}</div></div>
             <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4"><strong className="text-xs uppercase text-indigo-700">Resultado da análise</strong>{analysisLoading ? <p className="mt-2 text-sm text-slate-600">Analisando contexto persistido...</p> : analysisError ? <p className="mt-2 text-sm text-red-700">{analysisError}</p> : <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{analysis}</p>}</div>
             <div className="mt-5 flex justify-end"><Button variant="outline" onClick={() => setSelectedEvent(null)}>Fechar</Button></div>
           </div>
         </div>
       )}
    </div>
  );
}

// ─── CompanyProfileView ─────────────────────────────────────────────────────────
export default function CompanyProfileView() {
  const location = useLocation();
  const { data: identity, isLoading } = useAuthenticatedIdentity();
  const organizationId = identity?.organizationId || '';
  const isOrgAdmin = identity?.operatorProfile === 'administrador';
  const isOrgAuditor = identity?.operatorProfile === 'auditor';
  const companyName = identity?.organizationName || 'Minha Empresa';

  const activeTab: Tab | 'compliance' = (() => {
    if (location.pathname.includes('/colaboradores') || location.pathname.includes('/operadores')) return 'colaboradores';
    if (location.pathname.includes('/solicitantes')) return 'solicitantes';
    if (location.pathname.includes('/permissoes')) return 'permissoes';
    if (location.pathname.includes('/aprovacoes')) return 'aprovacoes';
    if (location.pathname.includes('/delegacoes')) return 'delegacoes';
    if (location.pathname.includes('/logs')) return 'logs';
    if (location.pathname.includes('/compliance')) return 'compliance';
    if (location.pathname.includes('/suporte')) return 'suporte';
    if (location.pathname.includes('/comercial')) return 'comercial';
    return 'dados';
  })();

  if (isLoading || !identity) {
    return <div className="p-8 flex justify-center text-slate-500">Carregando identidade da empresa...</div>;
  }

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
            {EMPRESA_SECTIONS.map((section) => {
              const items = section.items.filter((item) => canIdentity(identity, item.capability));
              if (items.length === 0) return null;
              return (
              <div key={section.title} className="space-y-1">
                <h3 className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{section.title}</h3>
                {items.map(tab => {
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
              );
            })}
          </aside>

          {/* Área de conteúdo */}
          <main className="flex-1 min-w-0">
            {activeTab === 'dados' && <DadosEmpresaTab authUserId={identity.userId} organizationId={organizationId} isOrgAdmin={isOrgAdmin} />}
            
            {activeTab === 'colaboradores' && <OperatorsPage />}
            {activeTab === 'solicitantes' && <RequestersPage />}
            {activeTab === 'permissoes' && <OperatorsPage />}
            {activeTab === 'aprovacoes' && <QuotationApprovalsPage />}
            {activeTab === 'compliance' && <ComplianceTab organizationId={organizationId} />}
            {activeTab === 'delegacoes' && <DelegationsPage />}
            {activeTab === 'logs' && <AccessLogsPage />}
            {activeTab === 'suporte' && <SupportTenantView />}
          </main>
        </div>
      </div>
    </div>
  );
}
