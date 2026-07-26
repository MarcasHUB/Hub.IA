import { X, Building2, MapPin, Package, Star, Calendar, Link as LinkIcon, Mail, Phone, Users, History, CheckCircle2, Clock } from 'lucide-react';
import { Partner } from './PartnerCard';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { formatCNPJ } from '@/shared/utils/formatters';

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Central */}
      <div className="relative z-10 w-full max-w-2xl bg-white h-auto max-h-[90vh] shadow-2xl rounded-[2rem] flex flex-col overflow-hidden my-auto">
        <div className="flex items-center justify-between px-8 py-6 bg-slate-900 text-white flex-shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <Building2 className="h-6 w-6 text-indigo-400" />
            Detalhes da Empresa
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50">
          {/* Header Info */}
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl flex-shrink-0">
              {partner.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-xl text-slate-900 leading-tight">{partner.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{formatCNPJ(partner.document)}</p>
              <div className="mt-2">
                {isAccepted ? (
                   <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">Parceiro Ativo</Badge>
                ) : (
                   <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">Convite Pendente</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Coluna Esquerda */}
            <div className="space-y-8">
              {/* Dados da Empresa */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Dados Gerais
                </h4>
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-3 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 text-xs">Localização:</span>
                    <span className="font-medium text-slate-900 flex items-center gap-1.5"><MapPin className="h-4 w-4 text-slate-400"/> {partner.city}, {partner.state}</span>
                  </div>
                  {partner.email && (
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-xs">E-mail:</span>
                      <span className="font-medium text-slate-900 flex items-center gap-1.5"><Mail className="h-4 w-4 text-slate-400"/> {partner.email}</span>
                    </div>
                  )}
                  {partner.phone && (
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-xs">Telefone:</span>
                      <span className="font-medium text-slate-900 flex items-center gap-1.5"><Phone className="h-4 w-4 text-slate-400"/> {partner.phone}</span>
                    </div>
                  )}
                  {partner.website && (
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-xs">Site:</span>
                      <span className="font-medium text-slate-900 flex items-center gap-1.5"><LinkIcon className="h-4 w-4 text-slate-400"/> {partner.website}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Perfil Comercial */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Package className="h-4 w-4" /> Perfil Comercial
                </h4>
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-4 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 text-xs">Segmento:</span>
                    <span className="font-medium text-slate-900">{partner.segment}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 text-xs">Porte:</span>
                    <span className="font-medium text-slate-900 flex items-center gap-1.5"><Users className="h-4 w-4 text-slate-400"/> {partner.employeesRange} funcion.</span>
                  </div>
                  
                  <div>
                    <span className="text-slate-500 text-xs block mb-2">Produtos e Serviços principais:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {partner.products.map(p => (
                        <Badge key={p} variant="secondary" className="bg-slate-50 border-slate-200 text-slate-700 text-[11px]">{p}</Badge>
                      ))}
                      {partner.products.length === 0 && <span className="text-slate-400 text-xs italic">Nenhum produto listado</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna Direita: Relacionamento */}
            <div className="space-y-8">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <History className="h-4 w-4" /> Relacionamento
                </h4>
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-3 text-sm">
                  {isAccepted ? (
                    <>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-500 text-xs">Conexão:</span>
                        <span className="font-medium text-slate-900 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500"/> Parceiro desde {partner.since}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-500 text-xs">Avaliação:</span>
                        <span className="font-medium text-slate-900 flex items-center gap-1.5">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400"/> {partner.rating > 0 ? partner.rating.toFixed(1) : 'Sem avaliações'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-500 text-xs">Volume:</span>
                        <span className="font-medium text-slate-900">{partner.quotationsCount} cotações realizadas</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-500 text-xs">Agilidade:</span>
                        <span className="font-medium text-slate-900 flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-400"/> Responde em {partner.responseTime}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-500 text-xs">Status:</span>
                        <span className="font-medium text-amber-600">Aguardando aceite</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-500 text-xs">Envio:</span>
                        <span className="font-medium text-slate-900 flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400"/> {new Date().toLocaleDateString('pt-BR')}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
        </div>

        <div className="p-6 border-t border-slate-200 bg-white flex justify-end flex-shrink-0">
          <Button onClick={onClose} variant="outline" className="px-8 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl h-10 font-bold">Fechar</Button>
        </div>
      </div>
    </div>
  );
}
