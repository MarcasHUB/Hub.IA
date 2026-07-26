import { useEffect, useRef } from 'react';
import { X, Building2, MapPin, Globe, Mail, Phone, MessageSquare, Briefcase, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';

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
  profile_type: string | null;
  service_radius: string | null;
  profile_completion: number | null;
  created_at: string | null;
  status: string | null;
  isPartner?: boolean;
  hasPendingInvite?: boolean;
}

interface NetworkCompanyModalProps {
  org: NetworkOrg | null;
  isOpen: boolean;
  onClose: () => void;
}

function SegmentBadge({ segment }: { segment: any }) {
  const labels: string[] = (() => {
    if (!segment) return [];
    if (Array.isArray(segment)) return segment.map(String).slice(0, 4);
    if (typeof segment === 'string') return [segment];
    if (typeof segment === 'object') return Object.values(segment).map(String).slice(0, 4);
    return [];
  })();
  return (
    <div className="flex flex-wrap gap-2">
      {labels.length > 0 ? labels.map((l, i) => (
        <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-3 py-1 font-medium">
          {l}
        </span>
      )) : (
        <span className="text-sm text-slate-400">Não informado</span>
      )}
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
    <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-3 py-1 ${entry.color}`}>
      {entry.label}
    </span>
  );
}

export default function NetworkCompanyModal({ org, isOpen, onClose }: NetworkCompanyModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!isOpen || !org) return null;

  const displayName = org.razao_social || org.nome_fantasia || org.name;
  const tradeName   = org.nome_fantasia !== displayName ? org.nome_fantasia : null;
  const email       = org.business_email || org.email_corporativo;
  const phone       = org.phone || org.telefone;
  const joinedDate  = org.created_at
    ? new Date(org.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null;

  const initials = displayName
    .split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-end"
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer lateral */}
      <div className="relative z-10 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300">

        {/* Header */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              {org.logo_url ? (
                <img src={org.logo_url} alt={displayName} className="h-16 w-16 rounded-2xl object-contain bg-white p-1 shadow-lg flex-shrink-0" />
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-tight">{displayName}</h2>
                {tradeName && <p className="text-slate-400 text-sm mt-0.5">{tradeName}</p>}
                {org.cnpj && <p className="text-slate-400 text-xs mt-1 font-mono">{org.cnpj}</p>}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 flex-shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            {org.isPartner && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 bg-emerald-900/40 border border-emerald-700/50 rounded-full px-3 py-1">
                <CheckCircle2 className="h-3 w-3" /> Parceiro Ativo
              </span>
            )}
            {org.hasPendingInvite && !org.isPartner && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-900/40 border border-amber-700/50 rounded-full px-3 py-1">
                <Clock className="h-3 w-3" /> Convite Enviado
              </span>
            )}
            <RoleLabel role={org.profile_type || org.business_model} />
          </div>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Contato e localização */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Contato & Localização</h3>
            <div className="space-y-2.5">
              {(org.city || org.state) && (
                <div className="flex items-center gap-2.5 text-sm text-slate-700">
                  <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span>{[org.city, org.state, org.country].filter(Boolean).join(', ')}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2.5 text-sm text-slate-700">
                  <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <a href={`mailto:${email}`} className="hover:text-indigo-600 transition-colors truncate">{email}</a>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-2.5 text-sm text-slate-700">
                  <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span>{phone}</span>
                </div>
              )}
              {org.whatsapp && (
                <div className="flex items-center gap-2.5 text-sm text-slate-700">
                  <MessageSquare className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <a href={`https://wa.me/${org.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="hover:text-emerald-600 transition-colors">
                    {org.whatsapp}
                  </a>
                </div>
              )}
              {org.website && (
                <div className="flex items-center gap-2.5 text-sm text-slate-700">
                  <Globe className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <a
                    href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                    target="_blank" rel="noreferrer"
                    className="hover:text-indigo-600 transition-colors flex items-center gap-1"
                  >
                    {org.website} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Segmentos */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Segmentos de Atuação</h3>
            <SegmentBadge segment={org.segment} />
          </div>

          {/* Tipo de operação / raio */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Perfil Comercial</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-600 font-medium">Tipo de operação:</span>
                {org.profile_type || org.business_model ? (
                <RoleLabel role={org.profile_type || org.business_model} />
              ) : null}
              </div>
              {org.service_radius && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Globe className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-sm text-slate-700">Abrangência: </span>
                  <span className="text-sm text-slate-700">{org.service_radius}</span>
                </div>
              )}
            </div>
          </div>

          {/* Descrição */}
          {org.description && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Sobre a Empresa</h3>
              <p className="text-sm text-slate-700 leading-relaxed">{org.description}</p>
            </div>
          )}

          {/* Data de entrada na rede */}
          {joinedDate && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Na Rede Hub.IA desde {joinedDate}
              </p>
            </div>
          )}

          {/* Métricas futuras (placeholder atualizado conforme regras) */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Indicadores de Relacionamento</h3>
            <p className="text-xs text-slate-400 italic">
              Informações de engajamento, taxa de resposta a cotações e avaliações entre parceiros estarão disponíveis em breve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
