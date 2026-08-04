import { useEffect, useRef, useState } from 'react';
import { X, Building2, MapPin, Globe, Mail, Phone, MessageSquare, Briefcase, CheckCircle2, Clock, ExternalLink, Package, Network, Loader2 } from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { useNotifications } from '@/modules/notifications/presentation/context/NotificationContext';
import { EmailService } from '@/shared/utils/EmailService';

export interface NetworkOrg {
  id: string;
  name: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  segment: any;
  business_email: string | null;
  email_corporativo: string | null;
  phone: string | null;
  telefone: string | null;
  whatsapp: string | null;
  business_model: string | null;
  perfil_comercial: string | null;
  tipo_empresa: string | null;
  raio_atendimento_km: number | null;
  profile_completion: number | null;
  created_at: string | null;
  status: string | null;
  certifications: string | null;
  score_hubia: number | null;
  isPartner?: boolean;
  isPendingSent?: boolean;
  isPendingReceived?: boolean;
  segments_count?: number;
  materials_count?: number;
}

interface NetworkCompanyModalProps {
  org: NetworkOrg | null;
  isOpen: boolean;
  onClose: () => void;
  onConnect?: (org: NetworkOrg) => void;
  onConnectSuccess?: (orgId: string) => void;
}

function SegmentBadge({ segment }: { segment: any }) {
  const labels: string[] = (() => {
    if (!segment) return [];
    if (Array.isArray(segment)) return segment.map(String);
    if (typeof segment === 'string') return [segment];
    if (typeof segment === 'object') return Object.values(segment).map(String);
    return [];
  })();
  
  if (labels.length === 0) {
    return <span className="text-sm text-slate-400">Não informado</span>;
  }
  
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((l, i) => (
        <span key={i} className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2.5 py-1 font-semibold truncate max-w-xs">
          {l}
        </span>
      ))}
    </div>
  );
}

function RoleLabel({ role }: { role: string | null }) {
  const map: Record<string, { label: string; color: string }> = {
    buyer:  { label: 'Comprador', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    seller: { label: 'Fornecedor', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    both:   { label: 'Comprador & Fornecedor', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  };
  const entry = role ? (map[role.toLowerCase()] || map['both']) : null;
  if (!entry) return <span className="text-sm text-slate-400">Não informado</span>;
  return (
    <span className={`inline-flex items-center text-xs font-bold border rounded-lg px-2.5 py-1 ${entry.color}`}>
      {entry.label}
    </span>
  );
}

export default function NetworkCompanyModal({ org, isOpen, onClose, onConnect, onConnectSuccess }: NetworkCompanyModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  
  // Materials state
  const [materials, setMaterials] = useState<any[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [isInactive, setIsInactive] = useState(false);

  useEffect(() => {
    if (org) {
      setIsInactive(org.status === 'inativo');
    }
  }, [org]);

  useEffect(() => {
    const handleStatusChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (org && customEvent.detail.organizationId === org.id) {
        setIsInactive(!customEvent.detail.isActive);
      }
    };
    window.addEventListener('hubia:organization-status-changed', handleStatusChanged);
    return () => window.removeEventListener('hubia:organization-status-changed', handleStatusChanged);
  }, [org]);

  const { addMockNotification } = useNotifications();
  const tenantId = localStorage.getItem('supplyhub_organization_id') || '';

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);
  
  useEffect(() => {
    if (isOpen && org) {
      loadMaterials(org.id);
    }
  }, [isOpen, org]);

  const loadMaterials = async (orgId: string) => {
    setIsLoadingMaterials(true);
    try {
      const { data, error } = await supabase
        .from('organization_materials')
        .select(`
          id,
          display_name,
          materials (
            official_name
          )
        `)
        .eq('organization_id', orgId)
        .limit(5);
        
      if (error) throw error;
      setMaterials(data || []);
    } catch (err) {
      console.error('Erro ao carregar materiais:', err);
    } finally {
      setIsLoadingMaterials(false);
    }
  };

  if (!isOpen || !org) return null;

  const displayName = org.razao_social || org.nome_fantasia || org.name;
  const tradeName   = org.nome_fantasia !== displayName ? org.nome_fantasia : null;
  const email       = org.business_email || org.email_corporativo;
  const phone       = org.phone || org.telefone;

  const initials = displayName
    .split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md transition-opacity" onClick={onClose} />

      {/* Modal central */}
      <div className="relative z-10 w-full max-w-4xl bg-white shadow-2xl rounded-[2rem] flex flex-col overflow-hidden my-auto max-h-[90vh]">
        
        {/* Header Superior */}
        <div className="bg-slate-900 px-8 py-6 text-white flex-shrink-0 flex items-start justify-between">
          <div className="flex items-center gap-5">
            {org.logo_url ? (
              <img src={org.logo_url} alt={displayName} className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-contain bg-white p-2 flex-shrink-0" />
            ) : (
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-extrabold leading-tight">
                {displayName}
                {isInactive && <span className="ml-2 text-xs font-bold text-red-500 bg-red-100 border border-red-200 rounded-lg px-2 py-1 align-middle">Inativa</span>}
              </h2>
              {tradeName && <p className="text-slate-400 text-sm mt-1">{tradeName}</p>}
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <RoleLabel role={org.perfil_comercial || org.tipo_empresa || org.business_model} />
                {org.cnpj && <span className="text-slate-400 text-sm font-mono">{org.cnpj}</span>}
                {org.isPartner && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-900/40 border border-emerald-700/50 rounded-lg px-2.5 py-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Parceiro Ativo
                  </span>
                )}
                {org.isPendingSent && !org.isPartner && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-900/40 border border-amber-700/50 rounded-lg px-2.5 py-1">
                    <Clock className="h-3.5 w-3.5" /> Convite Enviado
                  </span>
                )}
                {org.isPendingReceived && !org.isPartner && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-900/40 border border-amber-700/50 rounded-lg px-2.5 py-1">
                    <Clock className="h-3.5 w-3.5" /> Convite Recebido
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full p-2 flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo do Modal (Grid 2 colunas) */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
          {isInactive && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl">
              Esta empresa foi inativada pelo administrador e não está disponível para novas operações.
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Coluna Esquerda: Informações e Contatos */}
            <div className="lg:col-span-1 space-y-8">
              {/* Contato & Localização */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Contato & Localização</h3>
                <div className="space-y-3">
                  {(org.city || org.state) && (
                    <div className="flex items-start gap-3 text-sm text-slate-600">
                      <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span>{[org.city, org.state, org.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {email && (
                    <div className="flex items-start gap-3 text-sm text-slate-600">
                      <Mail className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <a href={`mailto:${email}`} className="hover:text-indigo-600 transition-colors break-all">{email}</a>
                    </div>
                  )}
                  {phone && (
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span>{phone}</span>
                    </div>
                  )}
                  {org.whatsapp && (
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <MessageSquare className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      <a href={`https://wa.me/${org.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="hover:text-emerald-600 font-medium transition-colors">
                        {org.whatsapp}
                      </a>
                    </div>
                  )}
                  {org.website && (
                    <div className="flex items-start gap-3 text-sm text-slate-600">
                      <Globe className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <a
                        href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                        target="_blank" rel="noreferrer"
                        className="hover:text-indigo-600 transition-colors flex items-center gap-1 break-all"
                      >
                        {org.website} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Área de Atendimento */}
              {org.raio_atendimento_km && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <Globe className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Raio de Atendimento</p>
                    <p className="text-sm text-slate-700 flex items-center gap-1.5">
                      Atende até <span>{org.raio_atendimento_km} km</span>
                    </p>
                  </div>
                </div>
              )}</div>

            {/* Coluna Direita: Segmentos, Descrição e Materiais */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Descrição */}
              {org.description && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Sobre a Empresa</h3>
                  <p className="text-sm text-slate-600 leading-relaxed bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    {org.description}
                  </p>
                </div>
              )}

              {/* Segmentos */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                  <span>Segmentos de Atuação</span>
                  <span className="text-xs font-medium text-slate-400 bg-slate-200/50 px-2.5 py-1 rounded-lg">
                    {org.segments_count || 0} cadastrados
                  </span>
                </h3>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <SegmentBadge segment={org.segment} />
                </div>
              </div>

              {/* Materiais Comercializados (Novo) */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                  <span>Materiais Comercializados</span>
                  <span className="text-xs font-medium text-slate-400 bg-slate-200/50 px-2.5 py-1 rounded-lg">
                    {org.materials_count || 0} catalogados
                  </span>
                </h3>
                
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {isLoadingMaterials ? (
                    <div className="p-8 flex items-center justify-center text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : materials.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {materials.map((m) => (
                        <div key={m.id} className="p-4 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="h-4 w-4" />
                          </div>
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {m.display_name || m.materials?.official_name || 'Material sem nome'}
                          </p>
                        </div>
                      ))}
                      <div className="p-4 bg-slate-50 text-center">
                        <button className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                          Ver Todos os Materiais
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-sm text-slate-500">
                      <Package className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      Nenhum material listado no catálogo público.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Rodapé: Ação de Conectar */}
        {!org.isPartner && !org.isPendingSent && !org.isPendingReceived && (
          <div className="bg-white border-t border-slate-200 p-6 sm:px-8 flex-shrink-0 flex justify-end">
            <button
              disabled={isInactive}
              onClick={() => onConnect && onConnect(org)}
              className={`w-full sm:w-auto font-bold text-[11px] px-4 h-9 flex items-center justify-center transition-all border-none rounded-lg ${
                isInactive 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'
              }`}
            >
              <Network className="h-4 w-4 mr-2" />
              {isInactive ? 'Conexão Bloqueada' : 'Conectar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
