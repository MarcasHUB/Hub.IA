import React from 'react';
import { Building2, Globe, Shield, Hash, Tag, Sparkles, ChevronDown } from 'lucide-react';
import { Input } from '../../../../../shared/components/ui/Input';
import { Button } from '../../../../../shared/components/ui/Button';
import { GeographicCoverageTypeSelect } from '../GeographicCoverageTypeSelect';
import { GeographicCoverageType } from '../../../domain/types/GeographicCoverageType';

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

export interface CompanyCommercialDataSectionProps {
  form: {
    tipo_empresa: string;
    business_model: string;
    area_cobertura_raio: string;
    area_cobertura_estados: string;
    geographicCoverageType: GeographicCoverageType | null;
    certificacoes: string;
    cnae_principal: string;
    cnaes_secundarios: string[];
  };
  onChange: (field: string, value: any) => void;
  selectedSegments: string[];
  availableSegments: { id: string; nome: string }[];
  sugestoesHubIA: string[];
  onAddSegment: (segment: string) => void;
  onRemoveSegment: (segment: string) => void;
  onAcceptSuggestions: () => void;
  onOpenNewSegmentModal: () => void;
  readOnly?: boolean;
}

export function CompanyCommercialDataSection({
  form,
  onChange,
  selectedSegments,
  availableSegments,
  sugestoesHubIA,
  onAddSegment,
  onRemoveSegment,
  onAcceptSuggestions,
  onOpenNewSegmentModal,
  readOnly
}: CompanyCommercialDataSectionProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Tipo de Empresa
          </label>
          <Input 
            value={form.tipo_empresa} 
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('tipo_empresa', e.target.value)} 
            placeholder="Matriz, Filial..." 
            className="h-10 text-sm" 
            disabled={readOnly}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Perfil Comercial
          </label>
          <div className="relative">
            <select
              value={form.business_model}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange('business_model', e.target.value)}
              className="w-full h-10 px-3 pr-10 text-sm border border-slate-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-75 disabled:bg-slate-50"
              disabled={readOnly}
            >
              <option value="">Selecione um perfil...</option>
              <option value="Indústria / Fabricante">Indústria / Fabricante</option>
              <option value="Distribuidor / Revenda">Distribuidor / Revenda</option>
              <option value="Consumidor Final">Consumidor Final</option>
              <option value="Prestador de Serviços">Prestador de Serviços</option>
              <option value="Fabricante e Revenda">Fabricante e Revenda</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Globe className="h-3 w-3" /> Tipo de Cobertura
          </label>
          <GeographicCoverageTypeSelect 
            value={form.geographicCoverageType} 
            onChange={v => onChange('geographicCoverageType', v)} 
            disabled={readOnly}
          />
        </div>
        <Field 
          label="Área de Cobertura (Raio em km)" 
          icon={Globe} 
          value={form.area_cobertura_raio} 
          onChange={v => onChange('area_cobertura_raio', v)} 
          type="number" 
          placeholder="Ex: 100" 
          readOnly={readOnly}
        />
        <Field 
          label="Área de Cobertura (Estados)" 
          icon={Globe} 
          value={form.area_cobertura_estados} 
          onChange={v => onChange('area_cobertura_estados', v)} 
          placeholder="Ex: SP, RJ, MG" 
          readOnly={readOnly}
        />
      </div>

      <Field 
        label="Certificações" 
        icon={Shield} 
        value={form.certificacoes} 
        onChange={v => onChange('certificacoes', v)} 
        placeholder="Ex: ISO 9001, ISO 14001" 
        readOnly={readOnly}
      />
      
      <hr className="border-slate-100" />
      
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800">CNAEs e Inteligência de Segmentação</h3>
        <Field 
          label="CNAE Principal" 
          icon={Hash} 
          value={form.cnae_principal} 
          onChange={v => onChange('cnae_principal', v)} 
          placeholder="Preenchido via CNPJ" 
          readOnly={readOnly}
        />
        
        {form.cnaes_secundarios.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CNAEs Secundários</label>
            <div className="flex flex-wrap gap-2">
              {form.cnaes_secundarios.map((c, i) => (
                <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{c}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 mt-4">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <Tag className="h-3 w-3" /> Segmentos de Atuação
        </label>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {selectedSegments.map(seg => (
              <span key={seg} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100 flex items-center gap-1">
                {seg}
                <button onClick={() => onRemoveSegment(seg)} className="hover:text-indigo-900">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-9 px-3 pr-8 text-sm border border-slate-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  onAddSegment(val);
                }
                e.target.value = '';
              }}
            >
              <option value="">Adicionar segmento...</option>
              {availableSegments.map(s => (
                <option key={s.id} value={s.nome}>{s.nome}</option>
              ))}
            </select>
            <button 
              onClick={onOpenNewSegmentModal}
              className="px-3 h-9 border border-dashed border-slate-300 text-slate-500 text-xs font-bold rounded-lg hover:border-indigo-500 hover:text-slate-700 transition-colors"
            >
              + Novo
            </button>
          </div>
        </div>
      </div>

      {sugestoesHubIA.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-900 uppercase">Sugestões Hub.IA</span>
          </div>
          <p className="text-xs text-indigo-700 mb-3">Baseado no seu CNAE, sugerimos estes segmentos:</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {sugestoesHubIA.map(seg => (
              <span key={seg} className="text-xs font-bold bg-white border border-indigo-200 text-indigo-800 px-2 py-1 rounded-md">
                {seg}
              </span>
            ))}
          </div>
          <Button 
            onClick={onAcceptSuggestions}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-4 text-xs font-bold"
          >
            Aceitar Sugestões
          </Button>
        </div>
      )}
    </div>
  );
}
