import React from 'react';
import { Building2, Hash, Globe, Phone, Mail } from 'lucide-react';
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

export interface CompanyGeneralDataSectionProps {
  form: {
    logo_url: string;
    razao_social: string;
    nome_fantasia: string;
    cnpj: string;
    site: string;
    telefone: string;
    email_corporativo: string;
    whatsapp: string;
  };
  onChange: (field: string, value: string) => void;
  isUploading: boolean;
  onUploadLogo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readOnly?: boolean;
}

export function CompanyGeneralDataSection({ form, onChange, isUploading, onUploadLogo, readOnly }: CompanyGeneralDataSectionProps) {
  return (
    <>
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="shrink-0 flex flex-col items-center">
          <div className="h-32 w-32 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center bg-slate-50 relative group">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logotipo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-slate-400">
                <Building2 className="h-8 w-8 mb-2" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Logo</span>
              </div>
            )}
            
            {!readOnly && (
              <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <span className="text-white text-xs font-bold">{isUploading ? 'Enviando...' : 'Alterar'}</span>
                <input type="file" className="hidden" accept="image/*" onChange={onUploadLogo} disabled={isUploading} />
              </label>
            )}
          </div>
        </div>
        
        <div className="flex-1 space-y-4">
          <Field
            label="Razão Social"
            icon={Building2}
            value={form.razao_social}
            onChange={v => onChange('razao_social', v)}
            placeholder="Nome jurídico oficial"
            readOnly={readOnly}
          />
          <Field
            label="Nome Fantasia"
            icon={Building2}
            value={form.nome_fantasia}
            onChange={v => onChange('nome_fantasia', v)}
            placeholder="Ex: Hub.IA"
            readOnly={readOnly}
          />
        </div>
      </div>

      <hr className="border-slate-100" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="CNPJ"
          icon={Hash}
          value={form.cnpj}
          onChange={v => onChange('cnpj', v)}
          placeholder="00.000.000/0001-00"
          hint="Apenas números. Formatação automática."
          readOnly={readOnly}
        />
        <Field
          label="Site"
          icon={Globe}
          value={form.site}
          onChange={v => onChange('site', v)}
          placeholder="www.suaempresa.com.br"
          readOnly={readOnly}
        />
        <Field
          label="Telefone"
          icon={Phone}
          value={form.telefone}
          onChange={v => onChange('telefone', v)}
          placeholder="(00) 0000-0000"
          readOnly={readOnly}
        />
        <Field
          label="E-mail Corporativo"
          icon={Mail}
          value={form.email_corporativo}
          onChange={v => onChange('email_corporativo', v)}
          placeholder="contato@empresa.com"
          readOnly={readOnly}
        />
      </div>
    </>
  );
}
