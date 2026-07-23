import { XCircle, Mail, Phone, Briefcase, MapPin, Calendar, Clock, Layers, ShieldCheck, User } from 'lucide-react';
import { Operator, operatorFullName, OperatorPerfil, OperatorStatus } from '../../domain/entities/Operator';

interface OperatorDetailsModalProps {
  operator: Operator;
  onClose: () => void;
  onEdit: () => void;
  onInactivate: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  onResendInvite?: () => void;
  segmentsList?: any[];
}

const STATUS_CONFIG: Record<OperatorStatus, { label: string; badge: string; dot: string }> = {
  ativo: { label: 'Ativo', badge: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  pendente: { label: 'Pendente', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  inativo: { label: 'Inativo', badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  cancelado: { label: 'Cancelado', badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  bloqueado: { label: 'Bloqueado', badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  ferias: { label: 'Férias', badge: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
  substituido: { label: 'Substituído', badge: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-400' },
};

const PERFIL_CONFIG: Record<OperatorPerfil, { label: string; badge: string; icon: any }> = {
  administrador: { label: 'Admin', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: ShieldCheck },
  gestor: { label: 'Gestor', badge: 'bg-violet-50 text-violet-700 border-violet-200', icon: Briefcase },
  comprador: { label: 'Comprador', badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: User },
  solicitante: { label: 'Solicitante', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: MapPin },
  auditor: { label: 'Auditor', badge: 'bg-slate-100 text-slate-600 border-slate-200', icon: MapPin },
};

function StatusBadge({ status }: { status: OperatorStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function PerfilBadge({ perfil }: { perfil: OperatorPerfil }) {
  const cfg = PERFIL_CONFIG[perfil];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

export function OperatorDetailsModal({ operator, onClose, onEdit, onInactivate, onReactivate, onDelete, onResendInvite, segmentsList = [] }: OperatorDetailsModalProps) {
  const isApp = operator.cargo?.includes('[APP]');
  const accessType = isApp ? 'Campo' : 'Desktop';
  // Remove special tags from cargo if we want to display the real cargo, but user said "Cargo continua existindo, mas deve aparecer no detalhe".
  const cleanCargo = operator.cargo?.replace(/\[(APP|DESKTOP)\]/g, '').trim() || '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative z-10 flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-lg font-black text-white leading-none">
                {operator.nome[0]}{operator.sobrenome?.[0] || ''}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">{operatorFullName(operator)}</h3>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={operator.status} />
                <PerfilBadge perfil={operator.perfil} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full mb-auto">
            <XCircle className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3"/> E-mail</span>
              <p className="text-sm font-semibold text-slate-800 break-all">{operator.email}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3"/> Telefone</span>
              <p className="text-sm font-semibold text-slate-800">{operator.telefone || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cargo</span>
              <p className="text-sm font-semibold text-slate-800">{cleanCargo}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipo de Acesso</span>
              <p className="text-sm font-semibold text-slate-800">
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${isApp ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                  {accessType}
                </span>
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"><Layers className="h-3 w-3"/> Categorias Autorizadas</span>
            {operator.todas_categorias ? (
              <span className="inline-flex mt-1.5 items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                Acesso Irrestrito (Todas)
              </span>
            ) : operator.categories && operator.categories.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {operator.categories.map(catId => {
                  const catData = segmentsList.find(s => s.id === catId);
                  return (
                    <span key={catId} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {catData ? catData.name : 'Desconhecida'}
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg font-medium">Nenhum segmento definido</span>
            )}
          </div>

          <div className="border-t border-slate-100 pt-5 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3"/> Convite Enviado</span>
              <p className="text-xs font-semibold text-slate-800">{operator.invited_at ? new Date(operator.invited_at).toLocaleDateString('pt-BR') : '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3"/> Último Login</span>
              <p className="text-xs font-semibold text-slate-800">{operator.last_login_at ? new Date(operator.last_login_at).toLocaleDateString('pt-BR') : '—'}</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
          {operator.status === 'pendente' ? (
            <>
              <button onClick={onDelete} className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors mr-auto border border-transparent hover:border-red-200">
                Cancelar Convite
              </button>
              {onResendInvite && (
                <button onClick={onResendInvite} className="px-4 py-2 text-xs font-bold text-amber-600 bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50 rounded-lg transition-colors">
                  Reenviar Convite
                </button>
              )}
              <button onClick={onEdit} className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors">
                Editar Convite
              </button>
            </>
          ) : (
            <>
              {operator.status !== 'cancelado' && (
                <button onClick={onDelete} className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors mr-auto border border-transparent hover:border-red-200">
                  Excluir
                </button>
              )}
              
              {operator.status === 'ativo' && (
                <button onClick={onInactivate} className="px-4 py-2 text-xs font-bold text-amber-600 bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50 rounded-lg transition-colors">
                  Inativar
                </button>
              )}
              
              {operator.status === 'inativo' && (
                <button onClick={onReactivate} className="px-4 py-2 text-xs font-bold text-green-600 bg-white border border-slate-200 hover:border-green-300 hover:bg-green-50 rounded-lg transition-colors">
                  Reativar
                </button>
              )}
              
              {operator.status !== 'cancelado' && (
                <button onClick={onEdit} className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors">
                  Editar Operador
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
