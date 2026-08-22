import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileClock,
  Globe,
  History,
  Info,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { formatCNPJ, isValidCNPJ } from '@/shared/utils/formatters';
import {
  cnpjEnrichmentService,
  type CnpjEnrichment,
} from '@/shared/services/cnpj/CnpjEnrichmentService';
import { usePublicOrganizationProfile } from '@/modules/organizations/presentation/hooks/usePublicOrganizationProfile';
import { Partner } from './PartnerCard';
import { buildPartner360Presentation } from './partner360Presentation';

interface CompanyDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  partner: Partner | null;
}

type Partner360Tab = 'overview' | 'commercial' | 'relationship' | 'governance';

const TABS: Array<{ id: Partner360Tab; label: string; icon: typeof Building2 }> = [
  { id: 'overview', label: 'Visão geral', icon: Building2 },
  { id: 'commercial', label: 'Comercial', icon: Store },
  { id: 'relationship', label: 'Relacionamento', icon: History },
  { id: 'governance', label: 'Compliance e histórico', icon: ShieldCheck },
];

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
        <Icon className="h-4 w-4 text-indigo-500" /> {title}
      </h3>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
      {children}
    </div>
  );
}

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold text-slate-800">{children}</div>
    </div>
  );
}

function formatExternalAddress(enrichment: CnpjEnrichment): string | null {
  const street = [enrichment.address.street, enrichment.address.number].filter(Boolean).join(', ');
  const city = [enrichment.address.city, enrichment.address.state].filter(Boolean).join(' / ');
  const parts = [street, enrichment.address.neighborhood, city, enrichment.address.postalCode].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function CompanyDetailsDrawer({ isOpen, onClose, partner }: CompanyDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<Partner360Tab>('overview');
  const [enrichment, setEnrichment] = useState<CnpjEnrichment | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const acceptedOrganizationId = isOpen && partner?.status === 'accepted'
    ? partner.organizationId || null
    : null;
  const {
    data: publicProfile,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = usePublicOrganizationProfile(acceptedOrganizationId);

  useEffect(() => {
    setActiveTab('overview');
    setEnrichment(null);
    setEnrichmentError(null);
    setIsEnriching(false);
  }, [partner?.id, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !partner) return null;

  const view = buildPartner360Presentation(partner, publicProfile);
  const initials = view.displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || 'EMP';

  const loadExternalEnrichment = async () => {
    if (!view.isActivePartner || !view.document || !isValidCNPJ(view.document)) return;
    setIsEnriching(true);
    setEnrichmentError(null);
    try {
      setEnrichment(await cnpjEnrichmentService.lookup(view.document));
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setEnrichmentError(code === 'CNPJ_NOT_FOUND'
        ? 'Nenhum dado público foi encontrado para este CNPJ.'
        : 'A consulta pública está indisponível no momento. Tente novamente mais tarde.');
    } finally {
      setIsEnriching(false);
    }
  };

  const externalAddress = enrichment ? formatExternalAddress(enrichment) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:p-4">
      <button aria-label="Fechar detalhes" className="absolute inset-0 cursor-default" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden bg-slate-50 shadow-2xl sm:h-auto sm:max-h-[94vh] sm:rounded-[2rem]">
        <header className="flex shrink-0 items-start justify-between gap-4 bg-slate-900 px-4 py-5 text-white sm:px-7 sm:py-6">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            {view.logoUrl ? (
              <img src={view.logoUrl} alt="Logo" className="h-14 w-14 shrink-0 rounded-2xl border border-white/10 bg-white object-contain p-1.5 sm:h-16 sm:w-16" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-lg font-black sm:h-16 sm:w-16">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="break-words text-lg font-black leading-tight sm:text-2xl">{view.displayName}</h2>
                <Badge className={view.isActivePartner
                  ? 'border-emerald-700 bg-emerald-900/50 text-emerald-300'
                  : 'border-amber-700 bg-amber-900/50 text-amber-300'}>
                  {view.isActivePartner ? 'Parceiro ativo' : 'Conexão pendente'}
                </Badge>
              </div>
              {view.corporateName && <p className="text-sm text-slate-400">{view.corporateName}</p>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                {view.document && <span className="font-mono">CNPJ {formatCNPJ(view.document)}</span>}
                {view.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {view.location}</span>}
                {view.since && view.isActivePartner && <span>Parceiro desde {view.since}</span>}
              </div>
            </div>
          </div>
          <button aria-label="Fechar" onClick={onClose} className="shrink-0 rounded-full bg-slate-800 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        {view.isActivePartner && (
          <nav aria-label="Seções do perfil do parceiro" className="shrink-0 overflow-x-auto border-b border-slate-200 bg-white px-3 sm:px-6">
            <div className="flex min-w-max gap-1 py-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors sm:px-4 ${
                      selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {tab.label}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!view.isActivePartner ? (
            <div className="mx-auto max-w-3xl space-y-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                <p className="font-bold">Perfil resumido enquanto a conexão está pendente</p>
                <p className="mt-1 text-amber-800">Contatos, catálogo, certificações, raio, consulta cadastral e dados relacionais ficam disponíveis somente após o aceite.</p>
              </div>
              <SectionCard title="Dados disponíveis" icon={Building2}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DataRow label="Empresa">{view.displayName}</DataRow>
                  {view.document && <DataRow label="CNPJ">{formatCNPJ(view.document)}</DataRow>}
                  {view.location && <DataRow label="Localização">{view.location}</DataRow>}
                  {view.roleLabel && <DataRow label="Perfil">{view.roleLabel}</DataRow>}
                  {view.segments.length > 0 && <DataRow label="Segmento">{view.segments[0]}</DataRow>}
                </div>
              </SectionCard>
            </div>
          ) : isProfileLoading ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" /> Carregando perfil consolidado...
            </div>
          ) : isProfileError ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
              Não foi possível carregar o perfil consolidado. Feche e tente novamente.
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="grid gap-5 lg:grid-cols-2">
                  <SectionCard title="Dados declarados pela empresa" icon={Building2}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <DataRow label="Nome fantasia">{view.displayName}</DataRow>
                      {view.corporateName && <DataRow label="Razão social">{view.corporateName}</DataRow>}
                      {view.document && <DataRow label="CNPJ">{formatCNPJ(view.document)}</DataRow>}
                      {view.location && <DataRow label="Localização">{view.location}</DataRow>}
                      {view.companySize && <DataRow label="Porte">{view.companySize}</DataRow>}
                      {view.roleLabel && <DataRow label="Perfil comercial">{view.roleLabel}</DataRow>}
                    </div>
                    {view.description && <p className="mt-5 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-600">{view.description}</p>}
                  </SectionCard>

                  <SectionCard title="Contato comercial" icon={Mail}>
                    {view.email || view.phone || view.website ? (
                      <div className="space-y-3 text-sm text-slate-700">
                        {view.email && <p className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span className="break-all">{view.email}</span></p>}
                        {view.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-slate-400" />{view.phone}</p>}
                        {view.website && (
                          <a href={view.website.startsWith('http') ? view.website : `https://${view.website}`} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-indigo-600 hover:underline">
                            <Globe className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-all">{view.website}</span><ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                          </a>
                        )}
                      </div>
                    ) : <EmptyState>Nenhum contato comercial foi informado.</EmptyState>}
                  </SectionCard>

                  <div className="lg:col-span-2">
                    <SectionCard title="Consulta cadastral pública por CNPJ" icon={ClipboardCheck}>
                      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div className="max-w-2xl text-sm text-slate-600">
                          <p className="font-semibold text-slate-800">Dados externos são exibidos separadamente.</p>
                          <p className="mt-1">A consulta não altera nem substitui o cadastro declarado pela empresa.</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isEnriching || !view.document || !isValidCNPJ(view.document)}
                          onClick={() => void loadExternalEnrichment()}
                          className="shrink-0"
                        >
                          {isEnriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                          {enrichment ? 'Atualizar consulta' : 'Consultar dados públicos'}
                        </Button>
                      </div>

                      {enrichmentError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{enrichmentError}</div>}
                      {!view.document || !isValidCNPJ(view.document) ? (
                        <EmptyState>A consulta externa exige um CNPJ válido cadastrado.</EmptyState>
                      ) : enrichment ? (
                        <div className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {enrichment.legalName && <DataRow label="Razão social pública">{enrichment.legalName}</DataRow>}
                            {enrichment.tradeName && <DataRow label="Nome fantasia público">{enrichment.tradeName}</DataRow>}
                            {enrichment.registrationStatus && <DataRow label="Situação cadastral">{enrichment.registrationStatus}</DataRow>}
                            {enrichment.openedAt && <DataRow label="Abertura">{enrichment.openedAt}</DataRow>}
                            {enrichment.legalNature && <DataRow label="Natureza jurídica">{enrichment.legalNature}</DataRow>}
                            {enrichment.branchType && <DataRow label="Estabelecimento">{enrichment.branchType}</DataRow>}
                            {enrichment.primaryActivity && (
                              <div className="sm:col-span-2 lg:col-span-3">
                                <DataRow label="CNAE principal">{[enrichment.primaryActivity.code, enrichment.primaryActivity.description].filter(Boolean).join(' · ')}</DataRow>
                              </div>
                            )}
                            {externalAddress && <div className="sm:col-span-2 lg:col-span-3"><DataRow label="Endereço público">{externalAddress}</DataRow></div>}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-indigo-100 pt-3 text-[11px] text-indigo-700">
                            <span className="font-bold">Fonte: {enrichment.provenance.source}</span>
                            <span>Origem: externa</span>
                            <span>Consultado em {new Date(enrichment.provenance.retrievedAt).toLocaleString('pt-BR')}</span>
                          </div>
                        </div>
                      ) : (
                        <EmptyState>A consulta é opcional e ocorre somente quando solicitada.</EmptyState>
                      )}
                    </SectionCard>
                  </div>
                </div>
              )}

              {activeTab === 'commercial' && (
                <div className="grid gap-5 lg:grid-cols-2">
                  <SectionCard title="Atuação comercial" icon={Globe}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {view.roleLabel && <DataRow label="Perfil">{view.roleLabel}</DataRow>}
                      {view.companySize && <DataRow label="Porte">{view.companySize}</DataRow>}
                      {view.geographicCoverageType && <DataRow label="Cobertura">{view.geographicCoverageType}</DataRow>}
                      {view.serviceRadiusKm !== null && view.serviceRadiusKm > 0 && <DataRow label="Raio de atendimento">Até {view.serviceRadiusKm} km</DataRow>}
                      {view.servedStates.length > 0 && <div className="sm:col-span-2"><DataRow label="Estados atendidos">{view.servedStates.join(', ')}</DataRow></div>}
                    </div>
                    {view.segments.length > 0 && (
                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Segmentos</p>
                        <div className="flex flex-wrap gap-2">{view.segments.map((segment) => <Badge key={segment} variant="secondary">{segment}</Badge>)}</div>
                      </div>
                    )}
                  </SectionCard>

                  <SectionCard title="Certificações compartilhadas" icon={BadgeCheck}>
                    {view.certifications.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {view.certifications.map((certification) => (
                          <span key={certification} className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> {certification}
                          </span>
                        ))}
                      </div>
                    ) : <EmptyState>Nenhuma certificação compartilhável foi informada.</EmptyState>}
                  </SectionCard>

                  <div className="lg:col-span-2">
                    <SectionCard title="Produtos e serviços" icon={Package}>
                      {view.products.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {view.products.map((product) => (
                            <div key={product} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                              <Package className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" /> {product}
                            </div>
                          ))}
                        </div>
                      ) : <EmptyState>Nenhum produto ou serviço foi publicado no catálogo.</EmptyState>}
                    </SectionCard>
                  </div>
                </div>
              )}

              {activeTab === 'relationship' && (
                <div className="grid gap-5 lg:grid-cols-3">
                  <SectionCard title="Relacionamento" icon={CheckCircle2}>
                    <div className="space-y-4">
                      <DataRow label="Status">Parceria ativa</DataRow>
                      {view.since && <DataRow label="Parceiro desde">{view.since}</DataRow>}
                    </div>
                  </SectionCard>
                  <SectionCard title="Cotações" icon={FileClock}>
                    <EmptyState>Nenhum histórico relacional de cotações está disponível neste perfil.</EmptyState>
                  </SectionCard>
                  <SectionCard title="Performance" icon={Info}>
                    <EmptyState>Indicadores de performance ainda não disponíveis.</EmptyState>
                  </SectionCard>
                </div>
              )}

              {activeTab === 'governance' && (
                <div className="grid gap-5 lg:grid-cols-2">
                  <SectionCard title="Compliance compartilhável" icon={ShieldCheck}>
                    <EmptyState>Nenhuma informação pública de compliance está disponível. Eventos internos permanecem restritos à organização que os gerou.</EmptyState>
                  </SectionCard>
                  <SectionCard title="Histórico do relacionamento" icon={History}>
                    {view.relationshipEvents.length > 0 ? (
                      <ol className="space-y-4">
                        {view.relationshipEvents.map((event) => (
                          <li key={`${event.label}-${event.date}`} className="flex gap-3">
                            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                            <div>
                              <p className="text-sm font-bold text-slate-800">{event.label}</p>
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> {event.date}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : <EmptyState>Nenhum evento compartilhável está disponível.</EmptyState>}
                  </SectionCard>
                </div>
              )}
            </>
          )}
        </main>

        <footer className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Button onClick={onClose} variant="outline">Fechar</Button>
        </footer>
      </div>
    </div>
  );
}
