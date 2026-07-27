import React from 'react';
import { Hash } from 'lucide-react';
import { Input } from '../../../../../shared/components/ui/Input';

interface FieldProps {
  label: string;
  icon: any;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  readOnly?: boolean;
}

const Field = ({ label, icon: Icon, value, onChange, type = 'text', placeholder, hint, readOnly }: FieldProps) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
      <Icon className="h-3 w-3" /> {label}
    </label>
    <Input
      type={type}
      value={value}
      onChange={e => onChange((e.target as HTMLInputElement).value)}
      placeholder={placeholder}
      className="h-10 text-sm"
      disabled={readOnly}
    />
    {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
  </div>
);

export interface CompanyAddressSectionProps {
  form: {
    cep: string;
    endereco: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  onChange: (field: string, value: string) => void;
  readOnly?: boolean;
}

export function CompanyAddressSection({ form, onChange, readOnly }: CompanyAddressSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-800 mb-4">Endereço</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="CEP" icon={Hash} value={form.cep} onChange={v => onChange('cep', v)} readOnly={readOnly} />
        <div className="sm:col-span-2">
          <Field label="Logradouro" icon={Hash} value={form.endereco} onChange={v => onChange('endereco', v)} readOnly={readOnly} />
        </div>
        <Field label="Número" icon={Hash} value={form.numero} onChange={v => onChange('numero', v)} readOnly={readOnly} />
        <div className="sm:col-span-2">
          <Field label="Complemento" icon={Hash} value={form.complemento} onChange={v => onChange('complemento', v)} readOnly={readOnly} />
        </div>
        <Field label="Bairro" icon={Hash} value={form.bairro} onChange={v => onChange('bairro', v)} readOnly={readOnly} />
        <Field label="Cidade" icon={Hash} value={form.cidade} onChange={v => onChange('cidade', v)} readOnly={readOnly} />
        <Field label="UF" icon={Hash} value={form.uf} onChange={v => onChange('uf', v)} readOnly={readOnly} />
      </div>
    </div>
  );
}
