import React from 'react';
import { Button } from './Button';

interface ActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'primary' | 'warning';
}

export const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  variant = 'primary'
}) => {
  if (!isOpen) return null;

  const getConfirmStyle = () => {
    switch (variant) {
      case 'danger': return 'bg-red-600 hover:bg-red-700 text-white';
      case 'warning': return 'bg-amber-500 hover:bg-amber-600 text-white';
      case 'primary':
      default:
        return 'bg-indigo-600 hover:bg-indigo-700 text-white';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
        </div>
        
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={onCancel}
            className="text-slate-600 border-slate-200 hover:bg-slate-100"
          >
            {cancelText}
          </Button>
          <Button 
            onClick={onConfirm}
            className={getConfirmStyle()}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
