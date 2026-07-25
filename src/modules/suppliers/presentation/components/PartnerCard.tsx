import { useState } from 'react';
import { Clock, CheckCircle2, XCircle, MoreVertical, MapPin, Mail, Phone, Globe, Star, Package } from 'lucide-react';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { useChatDrawer } from '@/modules/messages/presentation/context/ChatDrawerContext';
import { formatCNPJ } from '@/shared/utils/formatters';

export interface Partner {
  id: string;
  name: string;
  document: string;
  segment: string;
  city: string;
  state: string;
  status: 'accepted' | 'pending_sent' | 'pending_received';
  since?: string;
  connectionId: string;
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

function StarRating({ value }: { value: number }) {
  if (value === 0) return <span className="text-[11px] text-slate-400">Sem avaliação</span>;
  return (
    <span className="flex items-center gap-1">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      <span className="text-[12px] font-bold text-amber-600">{value.toFixed(1)}</span>
    </span>
  );
}

export function PartnerCard({ 
  partner, 
  onRemove, 
  onAccept, 
  onReject, 
  onCancel,
  onEdit,
  onViewDetails,
  highlight 
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
  const [menuOpen, setMenuOpen] = useState(false);
  const { openChat } = useChatDrawer();

  const initials = partner.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const gradient = getGradient(partner.segment);

  const matchedProduct = highlight
    ? partner.products.find(p => p.toLowerCase().includes(highlight.toLowerCase()))
    : null;

  return (
    <div className="relative flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all duration-200 group h-full">
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

      {partner.status === 'accepted' && (
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-20">
              <button 
                onClick={() => { openChat(partner.id); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Enviar Mensagem
              </button>
              <div className="h-px bg-slate-100 my-1"></div>
              <button 
                onClick={() => { onRemove(partner.id); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors"
              >
                Remover Conexão
              </button>
            </div>
          )}
        </div>
      )}

      <div className="p-5 flex flex-col flex-1 gap-4">
        <div className="flex items-start gap-3">
          <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-inner`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <button 
              onClick={() => onViewDetails?.(partner)}
              className="font-bold text-slate-900 text-sm leading-tight truncate hover:text-indigo-600 hover:underline text-left" 
              title={partner.name}
            >
              {partner.name}
            </button>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 border-0 px-1.5 py-0.5">
                CNPJ: {formatCNPJ(partner.document)}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{partner.segment}</p>
          </div>
        </div>

        {partner.status === 'accepted' && (
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
            <StarRating value={partner.rating} />
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Clock className="h-3 w-3" />
              Responde em <span className="font-semibold text-slate-700 ml-1">{partner.responseTime}</span>
            </div>
          </div>
        )}

        {matchedProduct && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-amber-800">Vende: {matchedProduct}</span>
          </div>
        )}

        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Package className="h-3 w-3" />
            Produtos & Serviços
          </p>
          <div className="flex flex-wrap gap-1">
            {partner.products.slice(0, 3).map(prod => (
              <span
                key={prod}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                  matchedProduct === prod
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {prod}
              </span>
            ))}
            {partner.products.length > 3 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 font-medium">
                +{partner.products.length - 3} mais
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
            {partner.city}, {partner.state} · {partner.employeesRange} func.
          </div>
          {partner.email && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{partner.email}</span>
            </div>
          )}
          {partner.phone && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
              {partner.phone}
            </div>
          )}
          {partner.website && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Globe className="h-3 w-3 text-slate-400 flex-shrink-0" />
              {partner.website}
            </div>
          )}
        </div>

        {partner.status === 'pending_received' && (
          <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 self-start">
            Aguardando sua resposta
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
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-400">
              Parceiro desde <span className="font-semibold text-slate-600">{partner.since}</span>
            </p>
            <span className="text-[11px] text-indigo-600 font-semibold">
              {partner.quotationsCount} cotaç{partner.quotationsCount === 1 ? 'ão' : 'ões'}
            </span>
          </div>
        )}
        {partner.status === 'pending_received' && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onAccept(partner.id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs h-8">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Aceitar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onReject(partner.id)} className="flex-1 border-red-300 text-red-600 hover:bg-red-50 text-xs h-8">
              <XCircle className="h-3.5 w-3.5 mr-1" />Recusar
            </Button>
          </div>
        )}
        {partner.status === 'pending_sent' && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onEdit?.(partner)} className="flex-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 text-xs h-8">
              Editar Convite
            </Button>
            <Button size="sm" variant="outline" onClick={() => onCancel(partner.id)} className="flex-1 border-red-300 text-red-600 hover:bg-red-50 text-xs h-8">
              Cancelar Convite
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
