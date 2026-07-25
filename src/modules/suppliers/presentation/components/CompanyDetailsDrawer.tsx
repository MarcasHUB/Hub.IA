import { X, Building2, MapPin, Package, Star, Calendar, Link as LinkIcon, Mail, Phone, Users, History, CheckCircle2, Clock } from 'lucide-react';
import { Partner } from './PartnerCard';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';

interface CompanyDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  partner: Partner | null;
}

export function CompanyDetailsDrawer({ isOpen, onClose, partner }: CompanyDetailsDrawerProps) {
  if (!isOpen || !partner) return null;

  const isAccepted = partner.status === 'accepted';
  const isPending = partner.status !== 'accepted';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            Detalhes da Empresa
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Header Info */}
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl flex-shrink-0">
              {partner.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-xl text-slate-900 leading-tight">{partner.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{partner.document}</p>
              <div className="mt-2">
                {isAccepted ? (
                   <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">Parceiro Ativo</Badge>
                ) : (
                   <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">Convite Pendente</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Dados da Empresa */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Dados Gerais
            </h4>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500">Localização:</span>
                <span className="col-span-2 font-medium text-slate-900 flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400"/> {partner.city}, {partner.state}</span>
              </div>
              {partner.email && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500">E-mail:</span>
                  <span className="col-span-2 font-medium text-slate-900 flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-slate-400"/> {partner.email}</span>
                </div>
              )}
              {partner.phone && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500">Telefone:</span>
                  <span className="col-span-2 font-medium text-slate-900 flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-slate-400"/> {partner.phone}</span>
                </div>
              )}
              {partner.website && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500">Site:</span>
                  <span className="col-span-2 font-medium text-slate-900 flex items-center gap-1"><LinkIcon className="h-3.5 w-3.5 text-slate-400"/> {partner.website}</span>
                </div>
              )}
            </div>
          </div>

          {/* Perfil Comercial */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Package className="h-4 w-4" /> Perfil Comercial
            </h4>
            <div className="bg-slate-50 rounded-xl p-4 space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500">Segmento:</span>
                <span className="col-span-2 font-medium text-slate-900">{partner.segment}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500">Porte:</span>
                <span className="col-span-2 font-medium text-slate-900 flex items-center gap-1"><Users className="h-3.5 w-3.5 text-slate-400"/> {partner.employeesRange} funcion.</span>
              </div>
              
              <div>
                <span className="text-slate-500 block mb-2">Produtos e Serviços principais:</span>
                <div className="flex flex-wrap gap-1.5">
                  {partner.products.map(p => (
                    <Badge key={p} variant="secondary" className="bg-white border-slate-200 text-slate-700 text-[11px]">{p}</Badge>
                  ))}
                  {partner.products.length === 0 && <span className="text-slate-400 text-xs italic">Nenhum produto listado</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Relacionamento */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <History className="h-4 w-4" /> Relacionamento
            </h4>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-sm">
              {isAccepted ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-slate-500">Conexão:</span>
                    <span className="col-span-2 font-medium text-slate-900 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500"/> Parceiro desde {partner.since}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-slate-500">Avaliação:</span>
                    <span className="col-span-2 font-medium text-slate-900 flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400"/> {partner.rating > 0 ? partner.rating.toFixed(1) : 'Sem avaliações'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-slate-500">Volume:</span>
                    <span className="col-span-2 font-medium text-slate-900">{partner.quotationsCount} cotações realizadas</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-slate-500">Agilidade:</span>
                    <span className="col-span-2 font-medium text-slate-900 flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400"/> Responde em {partner.responseTime}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-slate-500">Status:</span>
                    <span className="col-span-2 font-medium text-amber-600">Aguardando aceite da empresa</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-slate-500">Envio:</span>
                    <span className="col-span-2 font-medium text-slate-900 flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400"/> {new Date().toLocaleDateString('pt-BR')} (Exemplo)</span>
                  </div>
                </>
              )}
            </div>
          </div>
          
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <Button onClick={onClose} variant="outline" className="w-full">Fechar</Button>
        </div>
      </div>
    </div>
  );
}
