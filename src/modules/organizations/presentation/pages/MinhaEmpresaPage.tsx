import { useState, useEffect } from 'react';
import { useLocation, Link, useParams, useNavigate } from 'react-router-dom';
import {
  Building2, Upload, FileText, CheckCircle2, ChevronRight, Save, Store, Truck, BadgeDollarSign, ShieldCheck, Mail, MapPin,
  Users, Layers, ArrowLeftRight, ScrollText,
  Globe, Phone, Hash, Shield, UserCheck,
  Sparkles, ChevronDown, Tag, XCircle
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent } from '@/shared/components/ui/Card';
import DelegationsPage from '../../../employees/presentation/pages/DelegationsPage';
import AccessLogsPage from '../../../employees/presentation/pages/AccessLogsPage';
import OperatorsPage from '../../../employees/presentation/pages/OperatorsPage';
import { supabase } from '@/infrastructure/supabase/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Tab = 'dados' | 'comercial' | 'colaboradores' | 'solicitantes' | 'permissoes' | 'aprovacoes' | 'delegacoes' | 'logs';

const EMPRESA_SECTIONS = [
  {
    title: 'DADOS DA EMPRESA',
    items: [
      { id: 'dados', label: 'Dados da Empresa', icon: Building2, href: '/empresa' },
    ]
  },
  {
    title: 'PESSOAS',
    items: [
      { id: 'colaboradores', label: 'Colaboradores', icon: Users, href: '/empresa/colaboradores' },
      { id: 'solicitantes', label: 'Solicitantes', icon: UserCheck, href: '/empresa/solicitantes' },
    ]
  },
  {
    title: 'GOVERNANÇA',
    items: [
      { id: 'permissoes', label: 'Permissões', icon: Shield, href: '/empresa/permissoes' },
      { id: 'aprovacoes', label: 'Aprovações', icon: CheckCircle2, href: '/empresa/aprovacoes' },
    ]
  },
  {
    title: 'OPERAÇÃO',
    items: [
      { id: 'delegacoes', label: 'Delegações', icon: ArrowLeftRight, href: '/empresa/delegacoes' },
      { id: 'logs', label: 'Logs', icon: ScrollText, href: '/empresa/logs' },
    ]
  }
];

const Field = ({
  label, icon: Icon, value, onChange, type = 'text', placeholder, hint,
}: {
  label: string; icon: any; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string;
}) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
      <Icon className="h-3 w-3" /> {label}
    </label>
    <Input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 text-sm"
    />
    {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
  </div>
);


// ─── UTILS ──────────────────────────────────────────────────────────────────────
const applyMask = (field: string, value: string) => {
  let v = value.replace(/\D/g, '');
  if (field === 'cnpj') {
    v = v.slice(0, 14);
    return v
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  if (field === 'telefone' || field === 'whatsapp') {
    v = v.slice(0, 11);
    if (v.length === 0) return '';
    if (v.length <= 2) return `(${v}`;
    if (v.length <= 6) return `(${v.slice(0,2)}) ${v.slice(2)}`;
    if (v.length <= 10) return `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`;
    return `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
  }
  if (field === 'cep') {
    v = v.slice(0, 8);
    if (v.length <= 5) return v;
    return `${v.slice(0,5)}-${v.slice(5)}`;
  }
  return value;
};

// ─── DadosEmpresaTab ─────────────────────────────────────────────────────────
function DadosEmpresaTab() {
  const [activeSubTab, setActiveSubTab] = useState<'gerais'|'comerciais'>('gerais');
  const [form, setForm] = useState({
    business_model: '',
    latitude: '',
    longitude: '',
    tipo_empresa: '',
    area_cobertura_raio: '',
    area_cobertura_estados: '',
    certificacoes: '',
    cnae_principal: '',
    cnaes_secundarios: [] as string[],
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    email_corporativo: '',
    telefone: '',
    whatsapp: '',
    site: '',
    logo_url: '',
    gestor_principal: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
  });
  const [saved, setSaved] = useState(false);
  const [completion, setCompletion] = useState(0);
  const [orgId, setOrgId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [availableSegments, setAvailableSegments] = useState<{id: string, nome: string}[]>([]);
  const [sugestoesHubIA, setSugestoesHubIA] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSegment, setNewSegment] = useState({ nome: '', descricao: '' });

  const { id: routeId } = useParams<{ id: string }>();

  useEffect(() => {
    const load = async () => {
      const id = routeId || localStorage.getItem('supplyhub_organization_id');
      if (!id) return;
      setOrgId(id);
      const { data } = await supabase.from('organizations').select('*').eq('id', id).single();
      if (data) {
        setForm({
          razao_social: data.name || data.razao_social || '',
          nome_fantasia: data.trade_name || data.nome_fantasia || '',
          cnpj: applyMask('cnpj', data.document || data.cnpj || ''),
          email_corporativo: data.commercial_email || data.email_corporativo || '',
          telefone: applyMask('telefone', data.phone || data.telefone || ''),
          whatsapp: applyMask('whatsapp', data.whatsapp || ''),
          site: data.website || '',
          logo_url: data.logo_url || '',
          gestor_principal: localStorage.getItem('supplyhub_gestor_principal') || '',
          cep: applyMask('cep', data.address_zip_code || ''),
          endereco: data.address_street || '',
          numero: data.address_number || '',
          complemento: data.address_complement || '',
          bairro: data.address_neighborhood || '',
          cidade: data.address_city || data.city || '',
          uf: data.address_state || data.state || '',
          latitude: data.latitude?.toString() || '',
          longitude: data.longitude?.toString() || '',
          tipo_empresa: data.company_type || '',
          area_cobertura_raio: data.coverage_radius?.toString() || '',
          area_cobertura_estados: data.coverage_states?.join(', ') || '',
          certificacoes: data.certifications || '',
          cnae_principal: data.cnae_main || '',
          cnaes_secundarios: data.cnae_secondary || [],
          business_model: data.business_model || '',
        });
        if (data.segment) {
          if (Array.isArray(data.segment)) {
            setSelectedSegments(data.segment);
          } else if (typeof data.segment === 'string') {
            setSelectedSegments(data.segment.split(',').map((s: string) => s.trim()).filter(Boolean));
          }
        }
        const { data: segs } = await supabase.from('segments').select('id, nome').order('nome');
        if (segs) {
          setAvailableSegments(segs);
        }
        setCompletion(data.profile_completion || 50);
        
        if (data.logo_url) {
          localStorage.setItem('supplyhub_company_logo', data.logo_url);
          window.dispatchEvent(new Event('storage'));
        }
      }
    };
    load();
  }, []);

  const fetchCNPJ = async (cnpjVal: string) => {
    const cleanCNPJ = cnpjVal.replace(/\D/g, '');
    if (cleanCNPJ.length === 14) {
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
        if (response.ok) {
          const data = await response.json();
          const cnaePrincipal = data.cnae_fiscal ? `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}` : '';
          const cnaesSecundarios = data.cnaes_secundarios ? data.cnaes_secundarios.map((c: any) => `${c.codigo} - ${c.descricao}`) : [];
          
          setForm(f => ({
            ...f,
            razao_social: data.razao_social || f.razao_social,
            nome_fantasia: data.nome_fantasia || data.razao_social || f.nome_fantasia,
            telefone: data.ddd_telefone_1 || f.telefone,
            email_corporativo: data.email || f.email_corporativo,
            cep: data.cep || f.cep,
            endereco: data.logradouro || f.endereco,
            numero: data.numero || f.numero,
            complemento: data.complemento || f.complemento,
            bairro: data.bairro || f.bairro,
            cidade: data.municipio || f.cidade,
            uf: data.uf || f.uf,
            cnae_principal: cnaePrincipal,
            cnaes_secundarios: cnaesSecundarios
          }));
          if (data.nome_fantasia || data.razao_social) {
             localStorage.setItem('supplyhub_company_name', data.nome_fantasia || data.razao_social);
             window.dispatchEvent(new Event('storage'));
          }

          // Generate Hub.IA segment suggestions based on CNAE
          if (cnaePrincipal.toLowerCase().includes('elétric')) {
            setSugestoesHubIA(['Indústria Elétrica', 'Materiais Elétricos', 'Automação Industrial']);
          } else if (cnaePrincipal.toLowerCase().includes('tecnologia') || cnaePrincipal.toLowerCase().includes('software')) {
            setSugestoesHubIA(['Tecnologia da Informação', 'Software B2B', 'Serviços em Nuvem']);
          } else {
            setSugestoesHubIA(['Indústria Geral', 'Serviços Corporativos']);
          }

          // Geocoding request
          if (data.cep && data.logradouro) {
             const addressStr = `${data.logradouro}, ${data.numero || ''}, ${data.municipio} - ${data.uf}, ${data.cep}`;
             const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
             if (apiKey) {
                try {
                  const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressStr)}&key=${apiKey}`);
                  const geoData = await geoRes.json();
                  if (geoData.results && geoData.results.length > 0) {
                     const { lat, lng } = geoData.results[0].geometry.location;
                     setForm(f => ({ ...f, latitude: lat.toString(), longitude: lng.toString() }));
                  }
                } catch(e) { console.error('Erro no geocoding:', e); }
             }
          }
        }
      } catch (error) {
        console.error("Erro ao buscar CNPJ", error);
      }
    }
  };

  const handleChange = (field: string, value: string) => {
    const maskedValue = applyMask(field, value);
    setForm(f => ({ ...f, [field]: maskedValue }));
    if (field === 'cnpj') {
      fetchCNPJ(maskedValue);
    }
    if (field === 'nome_fantasia') {
      localStorage.setItem('supplyhub_company_name', maskedValue);
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${orgId}-${Math.random()}.${fileExt}`;
      const filePath = `company-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      setForm(f => ({ ...f, logo_url: publicUrl }));
      
      // Update immediately in db
      await supabase.from('organizations').update({ logo_url: publicUrl }).eq('id', orgId);

      localStorage.setItem('supplyhub_company_logo', publicUrl);
      window.dispatchEvent(new Event('storage'));

    } catch (error) {
      console.error("Erro no upload do logotipo:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setSaveError('');
    let comp = 50;
    if (form.logo_url) comp += 20;
    if (form.site) comp += 10;
    if (form.whatsapp) comp += 10;
    if (form.endereco) comp += 10;
    
    const { error } = await supabase.from('organizations').update({
      name: form.razao_social,
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia,
      cnpj: form.cnpj,
      email_corporativo: form.email_corporativo,
      phone: form.telefone,
      telefone: form.telefone,
      whatsapp: form.whatsapp,
      website: form.site,
      logo_url: form.logo_url,
      address_zip_code: form.cep,
      address_street: form.endereco,
      address_number: form.numero,
      address_complement: form.complemento,
      address_neighborhood: form.bairro,
      city: form.cidade,
      state: form.uf,
      profile_completion: comp,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      company_type: form.tipo_empresa,
      coverage_radius: form.area_cobertura_raio ? parseInt(form.area_cobertura_raio) : null,
      coverage_states: form.area_cobertura_estados ? form.area_cobertura_estados.split(',').map(s=>s.trim()) : null,
      certifications: form.certificacoes,
      cnae_main: form.cnae_principal,
      cnae_secondary: form.cnaes_secundarios,
      business_model: form.business_model,
      segment: selectedSegments.length > 0 ? selectedSegments : null,
    }).eq('id', orgId);

    if (error) {
      console.error("Erro ao salvar:", error);
      setSaveError(error.message || 'Erro ao salvar os dados.');
      return;
    }

    setCompletion(comp);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Dados da Empresa</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Informações institucionais utilizadas em convites, notificações e relatórios da Hub.IA.
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Perfil Público</p>
            <p className="text-sm font-bold text-slate-900">{completion}% Completo</p>
          </div>
          <div className="h-10 w-10 rounded-full border-[3px] border-slate-100 flex items-center justify-center relative">
            <svg className="absolute inset-0 h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={completion === 100 ? '#10b981' : '#4f46e5'}
                strokeWidth="3"
                strokeDasharray={`${completion}, 100`}
              />
            </svg>
            <span className="text-[9px] font-bold text-slate-600">{completion}%</span>
          </div>
        </div>
      </div>

      
      {/* Sub Tabs */}
      <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl">
        <button
          onClick={() => setActiveSubTab('gerais')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeSubTab === 'gerais' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
        >
          Dados Gerais
        </button>
        <button
          onClick={() => setActiveSubTab('comerciais')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeSubTab === 'comerciais' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
        >
          Informações Comerciais
        </button>
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-6 space-y-6">
          {activeSubTab === 'gerais' && (
            <>

          {/* Logo e Info Principal */}
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
                
                <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <span className="text-white text-xs font-bold">{isUploading ? 'Enviando...' : 'Alterar'}</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleUploadLogo} disabled={isUploading} />
                </label>
              </div>
            </div>
            
            <div className="flex-1 space-y-4">
              <Field
                label="Razão Social"
                icon={Building2}
                value={form.razao_social}
                onChange={v => handleChange('razao_social', v)}
                placeholder="Nome jurídico oficial"
              />
              <Field
                label="Nome Fantasia"
                icon={Building2}
                value={form.nome_fantasia}
                onChange={v => handleChange('nome_fantasia', v)}
                placeholder="Ex: Hub.IA"
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Dados de Contato e Identificação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="CNPJ"
              icon={Hash}
              value={form.cnpj}
              onChange={v => handleChange('cnpj', v)}
              placeholder="00.000.000/0001-00"
              hint="Preencha o CNPJ para buscar os dados na Receita"
            />
            <Field
              label="Site"
              icon={Globe}
              value={form.site}
              onChange={v => handleChange('site', v)}
              placeholder="www.suaempresa.com.br"
            />
            <Field
              label="Telefone"
              icon={Phone}
              value={form.telefone}
              onChange={v => handleChange('telefone', v)}
              placeholder="(11) 3000-0000"
            />
            <Field
              label="E-mail Corporativo"
              icon={Mail}
              value={form.email_corporativo}
              onChange={v => handleChange('email_corporativo', v)}
              placeholder="contato@empresa.com.br"
            />
          </div>

          <hr className="border-slate-100" />

          {/* Endereço */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-4">Endereço</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="CEP" icon={Hash} value={form.cep} onChange={v => handleChange('cep', v)} />
              <div className="sm:col-span-2">
                <Field label="Logradouro" icon={Hash} value={form.endereco} onChange={v => handleChange('endereco', v)} />
              </div>
              <Field label="Número" icon={Hash} value={form.numero} onChange={v => handleChange('numero', v)} />
              <div className="sm:col-span-2">
                <Field label="Complemento" icon={Hash} value={form.complemento} onChange={v => handleChange('complemento', v)} />
              </div>
              <Field label="Bairro" icon={Hash} value={form.bairro} onChange={v => handleChange('bairro', v)} />
              <Field label="Cidade" icon={Hash} value={form.cidade} onChange={v => handleChange('cidade', v)} />
              <Field label="UF" icon={Hash} value={form.uf} onChange={v => handleChange('uf', v)} />
            </div>
          </div>

          
            </>
          )}

          {activeSubTab === 'comerciais' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Tipo de Empresa
                  </label>
                  <Input value={form.tipo_empresa} onChange={e => handleChange('tipo_empresa', e.target.value)} placeholder="Matriz, Filial..." className="h-10 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Perfil Comercial
                  </label>
                  <div className="relative">
                    <select
                      value={form.business_model}
                      onChange={e => handleChange('business_model', e.target.value)}
                      className="w-full h-10 px-3 pr-10 text-sm border border-slate-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Área de Cobertura (Raio em km)" icon={Globe} value={form.area_cobertura_raio} onChange={v => handleChange('area_cobertura_raio', v)} type="number" placeholder="Ex: 100" />
                <Field label="Área de Cobertura (Estados)" icon={Globe} value={form.area_cobertura_estados} onChange={v => handleChange('area_cobertura_estados', v)} placeholder="Ex: SP, RJ, MG" />
              </div>

              <Field label="Certificações" icon={Shield} value={form.certificacoes} onChange={v => handleChange('certificacoes', v)} placeholder="Ex: ISO 9001, ISO 14001" />
              
              <hr className="border-slate-100" />
              
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800">CNAEs e Inteligência de Segmentação</h3>
                <Field label="CNAE Principal" icon={Hash} value={form.cnae_principal} onChange={v => handleChange('cnae_principal', v)} placeholder="Preenchido via CNPJ" />
                
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
                        <button onClick={() => setSelectedSegments(prev => prev.filter(s => s !== seg))} className="hover:text-indigo-900">&times;</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 px-3 pr-8 text-sm border border-slate-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !selectedSegments.includes(val)) {
                          setSelectedSegments(prev => [...prev, val]);
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
                      onClick={() => setIsModalOpen(true)}
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
                    onClick={() => setSelectedSegments(prev => Array.from(new Set([...prev, ...sugestoesHubIA])))}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-4 text-xs font-bold"
                  >
                    Aceitar Sugestões
                  </Button>
                </div>
              )}

            </div>
          )}

          <div className="flex justify-end pt-2 items-center">
            {saveError && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 mr-4">
                {saveError}
              </span>
            )}
            {saved && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 mr-4">
                <CheckCircle2 className="h-4 w-4" /> Salvo com sucesso!
              </span>
            )}
            <Button
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-6 text-sm font-bold flex items-center gap-2"
            >
              <Save className="h-4 w-4" /> Salvar Alterações
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* Modal Novo Segmento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Novo Segmento</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full">
                <XCircle className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome *</label>
                <Input
                  value={newSegment.nome}
                  onChange={e => setNewSegment({ ...newSegment, nome: e.target.value })}
                  placeholder="Ex: Agroindústria, Mineração, Logística..."
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Descrição</label>
                <textarea
                  value={newSegment.descricao}
                  onChange={e => setNewSegment({ ...newSegment, descricao: e.target.value })}
                  placeholder="Descreva o segmento de atuação."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end px-6 pb-6">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
              <Button
                onClick={async () => {
                  if (!newSegment.nome.trim()) return;
                  await supabase.from('segments').insert({
                    organization_id: 'GLOBAL',
                    nome: newSegment.nome.trim(),
                    descricao: newSegment.descricao.trim(),
                    status: 'ativo'
                  });
                  setSelectedSegments(prev => Array.from(new Set([...prev, newSegment.nome.trim()])));
                  setIsModalOpen(false);
                  setNewSegment({ nome: '', descricao: '' });
                }}
                disabled={!newSegment.nome.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold flex items-center gap-2"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Card de aviso Hub.IA */}
      <Card className="rounded-2xl border-indigo-100 bg-indigo-50/50 shadow-sm">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="h-9 w-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-indigo-900">Base da Inteligência Hub.IA</p>
            <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">
              Estes dados alimentam os modelos de inteligência da Hub.IA para recomendações de fornecedores,
              alertas de saving e análises de cobertura de segmentos.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


// ─── MinhaEmpresaPage ─────────────────────────────────────────────────────────
export default function MinhaEmpresaPage() {
  const location = useLocation();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('is_super_admin').eq('user_id', user.id).single();
        // Confiamos exclusivamente no banco de dados para segurança
        setIsSuperAdmin(data?.is_super_admin === true);
      }
    };
    checkAdmin();
  }, []);

  type Tab = 'dados' | 'comercial' | 'colaboradores' | 'solicitantes' | 'permissoes' | 'aprovacoes' | 'delegacoes' | 'logs';

  const activeTab: Tab = (() => {
    
    if (location.pathname.includes('/colaboradores') || location.pathname.includes('/operadores')) return 'colaboradores';
    if (location.pathname.includes('/solicitantes')) return 'solicitantes';
    if (location.pathname.includes('/permissoes')) return 'permissoes';
    if (location.pathname.includes('/aprovacoes')) return 'aprovacoes';
    if (location.pathname.includes('/delegacoes')) return 'delegacoes';
    if (location.pathname.includes('/logs')) return 'logs';
    return 'dados';
  })();

  const companyName = localStorage.getItem('supplyhub_company_name') || 'SupplyHub B2B';

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">

      {/* HEADER BANNER */}
      <div className="bg-slate-900 rounded-2xl mx-6 mt-6 mb-6 px-8 pt-8 pb-8 shadow-md">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Globe className="h-7 w-7 text-indigo-400" />
                Minha Empresa
              </h1>
              <p className="text-slate-400 mt-1 text-sm max-w-2xl">
                Governança de operadores, segmentos, acessos e inteligência Hub.IA para{' '}
                <strong className="text-white">{companyName}</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="flex-1 px-6 pb-8">
        <div className="max-w-[1600px] mx-auto flex gap-6">

          {/* Sidebar de navegação */}
          <aside className="w-56 shrink-0 space-y-6">
            {EMPRESA_SECTIONS.map((section, idx) => (
              <div key={idx} className="space-y-1">
                <h3 className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{section.title}</h3>
                {section.items.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <Link
                      key={tab.id}
                      to={tab.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </aside>

          {/* Área de conteúdo */}
          <main className="flex-1 min-w-0">
            {activeTab === 'dados' && <DadosEmpresaTab />}
            
            {activeTab === 'colaboradores' && <OperatorsPage />}
            {activeTab === 'solicitantes' && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Solicitantes</h2>
                <p className="text-slate-600">Gestão de solicitantes (Em breve).</p>
              </div>
            )}
            {activeTab === 'permissoes' && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Permissões</h2>
                <p className="text-slate-600">Gestão de permissões de acesso (Em breve).</p>
              </div>
            )}
            {activeTab === 'aprovacoes' && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Aprovações</h2>
                <p className="text-slate-600">Gestão de alçadas de aprovação (Em breve).</p>
              </div>
            )}
            {activeTab === 'delegacoes' && <DelegationsPage />}
            {activeTab === 'logs' && <AccessLogsPage />}
          </main>
        </div>
      </div>
    </div>
  );
}
