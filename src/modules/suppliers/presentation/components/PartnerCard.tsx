import {
  Building2,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Star,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { useChatDrawer } from '@/modules/messages/presentation/context/ChatDrawerContext';
import { formatCNPJ } from '@/shared/utils/formatters';
import { usePublicOrganizationProfile } from '@/modules/organizations/presentation/hooks/usePublicOrganizationProfile';
import { buildPartnerCardPresentation } from './partnerCardPresentation';

export interface Partner {
  id: string; // organization.id
  organizationId: string;
  connectionId: string;
  name: string;
  document: string;
  segment: string;
  city: string;
  state: string;
  status: 'accepted' | 'pending_sent' | 'pending_received';
  since?: string;
  phone?: string;
  email?: string;
  website?: string;
  employeesRange: string;
  rating: number;
  responseTime: string;
  quotationsCount: number;
  products: string[];
  contact_name?: string;
  message?: string;
  perfil_comercial?: string;
  tipo_empresa?: string;
  raio_atendimento_km?: number | null;
  certifications?: string;
  score_hubia?: number;
  isInactive?: boolean;
  canReviewInternal?: boolean;
  canRespond?: boolean;
}

const GRADIENTS: Record<string, string> = {
  'Manufatura':             'from-indigo-500 to-violet-600',
  'TI & Software':          'from-cyan-500 to-blue-600',
  'Construção Civil':       'from-amber-500 to-orange-600',
  'Transporte & Logística': 'from-emerald-500 to-teal-600',
  'Embalagens':             'from-pink-500 to-rose-600',
};

function getGradient(segment: string) {
  return GRADIENTS[segment] ?? 'from-slate-500 to-slate-700';
}

export function PartnerCard({
  partner,
  onRemove,
  onAccept,
  onReject,
  onCancel,
  onEdit,
  onViewDetails,
  highlight,
}: {
  partner: Partner;
  onRemove: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
  onEdit?: (partner: Partner) => void;
  onViewDetails?: (partner: Partner) => void;
  highlight?: string;
}) {
  const { openChat } = useChatDrawer();
  const { data: publicProfile, isLoading: isProfileLoading } = usePublicOrganizationProfile(partner.organizationId);
  const view = buildPartnerCardPresentation(partner, publicProfile);

  const isInactive = partner.isInactive || view.profileStatus === 'inativo';
  const initials = view.displayName.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'EMP';
  const gradient = getGradient(view.segments[0] || 'default');
  const matchedProduct = highlight
    ? view.products.find((product) => product.toLocaleLowerCase('pt-BR').includes(highlight.toLocaleLowerCase('pt-BR')))
    : null;
  const showRelationshipMetrics = view.rating !== null || view.responseTime !== null;

  return (
    <div className="relative flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all duration-200 group h-full">
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

      <div className="p-5 flex flex-col flex-1 gap-4">
        <div className="flex items-start gap-3">
          {view.logoUrl ? (
            <img src={view.logoUrl} alt="Logo" className="h-12 w-12 rounded-xl object-contain bg-white border border-slate-100 p-1 flex-shrink-0 shadow-sm" />
          ) : (
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-inner`}>
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <button
              onClick={() => onViewDetails?.(partner)}
              className="font-bold text-slate-900 text-sm leading-tight line-clamp-2 hover:text-indigo-600 hover:underline text-left block w-full"
              title={view.displayName}
            >
              {view.displayName}
            </button>
            {view.corporateName && (
              <p className="text-[11px] text-slate-500 mt-1 truncate" title={view.corporateName}>
                {view.corporateName}
              </p>
            )}
            {view.document && (
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 border-0 px-1.5 py-0.5">
                  CNPJ: {formatCNPJ(view.document)}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {showRelationshipMetrics && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2 text-[11px] text-slate-500">
            {view.rating !== null && (
              <span className="flex items-center gap-1 font-bold text-amber-600">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {view.rating.toFixed(1)}
              </span>
            )}
            {view.responseTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Responde em <strong className="text-slate-700">{view.responseTime}</strong>
              </span>
            )}
          </div>
        )}

        {matchedProduct && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-amber-800 truncate" title={matchedProduct}>Vende: {matchedProduct}</span>
          </div>
        )}

        <div className="text-xs font-semibold text-slate-600 min-h-[84px]">
          {isProfileLoading ? (
            <div className="flex items-center gap-2 text-slate-400 py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando perfil...
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {view.roleLabel && (
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Building2 className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                  <span className="truncate" title={view.roleLabel}>{view.roleLabel}</span>
                </span>
              )}

              {view.location && (
                <span className="flex items-center gap-1.5 text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate" title={view.location}>{view.location}</span>
                </span>
              )}

              {isInactive && (
                <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md text-[10px] w-fit">
                  Empresa Inativa
                </span>
              )}

              {view.isActivePartner && view.serviceRadiusKm !== null && view.serviceRadiusKm > 0 && (
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Globe className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" /> Atende até {view.serviceRadiusKm} km
                </span>
              )}

              {view.segments.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {view.segments.slice(0, view.isActivePartner ? 3 : 1).map((segment) => (
                    <span key={segment} className="max-w-full bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-200">
                      <Package className="h-2.5 w-2.5 flex-shrink-0" />
                      <span className="truncate" title={segment}>{segment}</span>
                    </span>
                  ))}
                  {view.isActivePartner && view.segments.length > 3 && (
                    <span className="text-[10px] text-slate-400 self-center">+{view.segments.length - 3}</span>
                  )}
                </div>
              )}

              {view.isActivePartner && view.products.length > 0 && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-indigo-500 mb-1">Produtos e serviços</p>
                  {view.products.slice(0, 2).map((product) => (
                    <p key={product} className="text-[11px] text-indigo-800 truncate" title={product}>• {product}</p>
                  ))}
                  {view.products.length > 2 && <p className="text-[10px] text-indigo-500 mt-1">+{view.products.length - 2} no perfil</p>}
                </div>
              )}

              {view.isActivePartner && view.certifications.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {view.certifications.slice(0, 2).map((certification) => (
                    <span key={certification} className="max-w-full flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                      <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate" title={certification}>{certification}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {view.isActivePartner && (view.email || view.phone || view.website) && (
          <div className="border-t border-slate-100 pt-3 space-y-1.5">
            {view.email && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 min-w-0">
                <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
                <span className="truncate" title={view.email}>{view.email}</span>
              </div>
            )}
            {view.phone && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 min-w-0">
                <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
                <span className="truncate" title={view.phone}>{view.phone}</span>
              </div>
            )}
            {view.website && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 min-w-0">
                <Globe className="h-3 w-3 text-slate-400 flex-shrink-0" />
                <span className="truncate" title={view.website}>{view.website}</span>
              </div>
            )}
          </div>
        )}

        {partner.status === 'pending_received' && (
          <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 self-start">
            {partner.canReviewInternal ? 'Aprovação interna necessária' : 'Aguardando sua resposta'}
          </Badge>
        )}
        {partner.status === 'pending_sent' && (
          <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 self-start">
            Convite enviado
          </Badge>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-3 mt-auto">
        {partner.status === 'accepted' && (
          <div className="flex flex-col gap-2">
            {view.since && (
              <p className="text-[11px] text-slate-400 mb-1">
                Parceiro desde <span className="font-semibold text-slate-600">{view.since}</span>
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onViewDetails?.(partner)} className="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs h-8">
                Ver Perfil
              </Button>
              <Button disabled={partner.isInactive} size="sm" onClick={() => openChat(partner.organizationId || partner.id, partner)} className="flex-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs h-8">
                Chat/Mensagem
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => onRemove(partner.connectionId || partner.id)} className="w-full border-red-300 text-red-600 hover:bg-red-50 text-xs h-8 mt-1">
              Desfazer Parceria
            </Button>
          </div>
        )}
        {partner.status === 'pending_received' && (
          <div className="flex gap-2">
            <Button disabled={partner.isInactive} size="sm" onClick={() => onAccept(partner.connectionId || partner.id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs h-8">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Aceitar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onReject(partner.connectionId || partner.id)} className="flex-1 border-red-300 text-red-600 hover:bg-red-50 text-xs h-8">
              <XCircle className="h-3.5 w-3.5 mr-1" />Recusar
            </Button>
          </div>
        )}
        {partner.status === 'pending_sent' && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onEdit?.(partner)} className="flex-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 text-xs h-8">
              Editar Convite
            </Button>
            <Button size="sm" variant="outline" onClick={() => onCancel(partner.connectionId || partner.id)} className="flex-1 border-red-300 text-red-600 hover:bg-red-50 text-xs h-8">
              Cancelar Convite
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
