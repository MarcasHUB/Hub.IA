import React, { useState } from 'react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Copy, Clock, Building2, User, MoreVertical } from 'lucide-react';

export type EntityStatus = 'pendente' | 'enviado' | 'aceito' | 'cancelado' | 'expirado';

interface EntityCardProps {
  type: 'empresa' | 'operador';
  title: string;
  subtitle: string;
  status: EntityStatus;
  sentDate?: string;
  expiresDate?: string;
  onCopyLink?: () => void;
  onCancel?: () => void;
  onClick?: () => void;
  onEdit?: () => void;
}

export const EntityCard: React.FC<EntityCardProps> = ({
  type,
  title,
  subtitle,
  status,
  sentDate,
  expiresDate,
  onCopyLink,
  onCancel,
  onClick,
  onEdit
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const getStatusBadge = () => {
    switch (status) {
      case 'aceito':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Aceito</Badge>;
      case 'pendente':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pendente</Badge>;
      case 'enviado':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Enviado</Badge>;
      case 'cancelado':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Cancelado</Badge>;
      case 'expirado':
        return <Badge className="bg-slate-100 text-slate-500 border-slate-200">Expirado</Badge>;
      default:
        return null;
    }
  };

  const Icon = type === 'empresa' ? Building2 : User;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 pr-2">
          <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
            <Icon className="h-5 w-5 text-slate-400" />
          </div>
          <div className="min-w-0">
            {onClick ? (
              <button onClick={onClick} className="text-sm font-bold text-slate-900 leading-tight truncate hover:text-indigo-600 transition-colors text-left">
                {title}
              </button>
            ) : (
              <h4 className="text-sm font-bold text-slate-900 leading-tight truncate">{title}</h4>
            )}
            <p className="text-xs text-slate-500 truncate">{subtitle}</p>
          </div>
        </div>
        
        {/* 3-dots Menu */}
        {(onEdit || onCancel) && (status === 'pendente' || status === 'enviado') && (
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}></div>
                <div className="absolute right-0 top-full mt-1 w-40 z-50 rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 overflow-hidden">
                  <div className="py-1">
                    {onEdit && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit(); }} 
                        className="w-full text-left px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                      >
                        Editar Convite
                      </button>
                    )}
                    {onCancel && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onCancel(); }} 
                        className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        Cancelar Convite
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {(sentDate || expiresDate) && (
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg mt-1">
          {sentDate && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">Enviado: <strong className="text-slate-700">{sentDate}</strong></span>
            </div>
          )}
          {expiresDate && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">Validade: <strong className="text-slate-700">{expiresDate}</strong></span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-slate-100">
        <div className="shrink-0">
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-2">
          {onCopyLink && (status === 'pendente' || status === 'enviado') && (
            <Button variant="outline" size="sm" onClick={onCopyLink} className="h-8 px-2 text-xs font-semibold text-slate-600">
              <Copy className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Copiar Link</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
