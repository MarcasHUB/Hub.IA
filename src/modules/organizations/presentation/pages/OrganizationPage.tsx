import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/shared/components/ui/Logo';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { Card } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/Table';
import { 
  ArrowLeft, Save, Building2, Users, Shield, FileCheck, Search, 
  Loader2, Camera, Check, AlertCircle, Edit2, Globe, Phone, Mail, Pencil, X,
  MoreHorizontal, Trash2, UserMinus, Factory, Target, Tags, UserCog, Plus
} from 'lucide-react';

// Interfaces for organization data
interface CnpjData {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  atividadesPrincipais: string;
  emAtividadeDesde: string;
}

// Pre-configured mock database for CNPJ lookup
const MOCK_CNPJ_DATABASE: Record<string, CnpjData> = {
  '10.364.979/0001-30': {
    cnpj: '10.364.979/0001-30',
    razaoSocial: 'SUPPLYHUB TECNOLOGIA E INTELIGENCIA EM COMPRAS LTDA',
    nomeFantasia: 'SupplyHub.IA',
    atividadesPrincipais: '62.01-5-01 - Desenvolvimento de programas de computador sob encomenda;\n62.02-3-00 - Consultoria em tecnologia da informação;\n63.11-9-00 - Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet',
    emAtividadeDesde: '24/09/2023'
  },
  '00.000.000/0001-00': {
    cnpj: '00.000.000/0001-00',
    razaoSocial: 'EMPRESA EXEMPLO BRASIL S/A',
    nomeFantasia: 'Exemplo Corp',
    atividadesPrincipais: '70.20-4-00 - Atividades de consultoria em gestão empresarial, exceto consultoria técnica;\n82.11-3-00 - Serviços combinados de escritório e apoio administrativo',
    emAtividadeDesde: '15/01/2010'
  }
};

export default function OrganizationPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'gerais' | 'comercial' | 'colaboradores' | 'solicitantes' | 'permissoes' | 'aprovacoes'>('gerais');
  
  // State for form fields
  const [nomeFantasia, setNomeFantasia] = useState(() => {
    return localStorage.getItem('supplyhub_company_name') || '';
  });
  const [cnpjInput, setCnpjInput] = useState(() => {
    return localStorage.getItem('supplyhub_company_cnpj') || '';
  });
  const [razaoSocial, setRazaoSocial] = useState(() => {
    return localStorage.getItem('supplyhub_company_razao') || '';
  });
  const [atividadesPrincipais, setAtividadesPrincipais] = useState(() => {
    return localStorage.getItem('supplyhub_company_cnaes') || '';
  });
  const [emAtividadeDesde, setEmAtividadeDesde] = useState(() => {
    return localStorage.getItem('supplyhub_company_since') || '';
  });
  const [descricao, setDescricao] = useState(() => {
    return localStorage.getItem('supplyhub_company_desc') || '';
  });
  
  // Logo da empresa (URL local via upload)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  
  // Additional contact details
  const [emailComercial, setEmailComercial] = useState(() => {
    return localStorage.getItem('supplyhub_company_email') || '';
  });
  const [telefoneComercial, setTelefoneComercial] = useState(() => {
    return localStorage.getItem('supplyhub_company_phone') || '';
  });
  
  // Search & Loading state for CNPJ
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showUploadToast, setShowUploadToast] = useState(false);

  // Colaboradores listagem e estados de modal
  const [colaboradores, setColaboradores] = useState<any[]>(() => {
    const saved = localStorage.getItem('supplyhub_colaboradores');
    return saved ? JSON.parse(saved) : [
      { nome: 'Arthur Dent', email: 'arthur.dent@supplyhub.ai', cargo: 'Diretor de Suprimentos', status: 'ATIVO' },
      { nome: 'Tricia McMillan', email: 'tricia.mcmillan@supplyhub.ai', cargo: 'Comprador Pleno', status: 'ATIVO' },
      { nome: 'Ford Prefect', email: 'ford.prefect@supplyhub.ai', cargo: 'Gestor Financeiro', status: 'ATIVO' },
      { nome: 'Marvin Android', email: 'marvin.android@supplyhub.ai', cargo: 'Analista de Sistemas', status: 'INATIVO' },
    ];
  });
  
  const [isColabModalOpen, setIsColabModalOpen] = useState(false);
  const [colabNome, setColabNome] = useState('');
  const [colabEmail, setColabEmail] = useState('');
  const [colabCargo, setColabCargo] = useState('Comprador Pleno');

  // Auto-load cached profile on mount
  useEffect(() => {
    const savedLogo = localStorage.getItem('supplyhub_company_logo');
    if (savedLogo) setCompanyLogoUrl(savedLogo);
    
    const savedName = localStorage.getItem('supplyhub_company_name');
    if (savedName) setNomeFantasia(savedName);
    
    const savedCnpj = localStorage.getItem('supplyhub_company_cnpj');
    if (savedCnpj) setCnpjInput(savedCnpj);
    
    const savedRazao = localStorage.getItem('supplyhub_company_razao');
    if (savedRazao) setRazaoSocial(savedRazao);
    
    const savedCnaes = localStorage.getItem('supplyhub_company_cnaes');
    if (savedCnaes) setAtividadesPrincipais(savedCnaes);
    
    const savedSince = localStorage.getItem('supplyhub_company_since');
    if (savedSince) setEmAtividadeDesde(savedSince);
  }, []);

  // Sync Nome Fantasia with header dynamically
  const handleNomeFantasiaChange = (val: string) => {
    setNomeFantasia(val);
    localStorage.setItem('supplyhub_company_name', val);
    window.dispatchEvent(new Event('company_profile_updated'));
  };

  const loadCnpjData = (cnpjClean: string) => {
    const formatted = formatCnpj(cnpjClean);
    const data = MOCK_CNPJ_DATABASE[formatted] || MOCK_CNPJ_DATABASE[cnpjClean.replace(/\D/g, '')];
    
    if (data) {
      setRazaoSocial(data.razaoSocial);
      setNomeFantasia(data.nomeFantasia);
      setAtividadesPrincipais(data.atividadesPrincipais);
      setEmAtividadeDesde(data.emAtividadeDesde);
      setCnpjError(null);
    } else {
      // Load fallback mock data for other CNPJs
      const numericCnpj = cnpjClean.replace(/\D/g, '');
      if (numericCnpj.length === 14) {
        setRazaoSocial(`EMPRESA MOCK CNPJ ${formatted}`);
        setAtividadesPrincipais('47.11-3-02 - Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - hipermercados');
        setEmAtividadeDesde('10/10/2015');
        setCnpjError(null);
      } else {
        setCnpjError('CNPJ não encontrado na Receita Federal (digite 14 números).');
      }
    }
  };

  const handleCnpjSearch = () => {
    const cleaned = cnpjInput.replace(/\D/g, '');
    if (cleaned.length < 14) {
      setCnpjError('CNPJ inválido. Insira 14 dígitos.');
      return;
    }
    
    setIsLoadingCnpj(true);
    setCnpjError(null);
    
    setTimeout(() => {
      loadCnpjData(cnpjInput);
      setIsLoadingCnpj(false);
    }, 1000);
  };

  const formatCnpj = (value: string) => {
    const numeric = value.replace(/\D/g, '');
    if (numeric.length <= 2) return numeric;
    if (numeric.length <= 5) return `${numeric.slice(0, 2)}.${numeric.slice(2)}`;
    if (numeric.length <= 8) return `${numeric.slice(0, 2)}.${numeric.slice(2, 5)}.${numeric.slice(5)}`;
    if (numeric.length <= 12) return `${numeric.slice(0, 2)}.${numeric.slice(2, 5)}.${numeric.slice(5, 8)}/${numeric.slice(8)}`;
    return `${numeric.slice(0, 2)}.${numeric.slice(2, 5)}.${numeric.slice(5, 8)}/${numeric.slice(8, 12)}-${numeric.slice(12, 14)}`;
  };

  const handleCnpjInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCnpj(e.target.value);
    setCnpjInput(formatted);
  };

  const handleSave = () => {
    localStorage.setItem('supplyhub_company_name', nomeFantasia);
    localStorage.setItem('supplyhub_company_cnpj', cnpjInput);
    localStorage.setItem('supplyhub_company_razao', razaoSocial);
    localStorage.setItem('supplyhub_company_cnaes', atividadesPrincipais);
    localStorage.setItem('supplyhub_company_since', emAtividadeDesde);
    localStorage.setItem('supplyhub_company_desc', descricao);
    localStorage.setItem('supplyhub_company_email', emailComercial);
    localStorage.setItem('supplyhub_company_phone', telefoneComercial);
    window.dispatchEvent(new Event('company_profile_updated'));

    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCompanyLogoUrl(url);
      localStorage.setItem('supplyhub_company_logo', url);
      window.dispatchEvent(new Event('company_profile_updated'));
      setShowUploadToast(true);
      setTimeout(() => setShowUploadToast(false), 3000);
    }
  };

  const triggerLogoUpload = () => {
    logoFileRef.current?.click();
  };

  const handleAddColab = () => {
    if (!colabNome.trim() || !colabEmail.trim()) return;
    
    const newColab = {
      nome: colabNome,
      email: colabEmail,
      cargo: colabCargo,
      status: 'ATIVO'
    };
    
    const updatedList = [...colaboradores, newColab];
    setColaboradores(updatedList);
    localStorage.setItem('supplyhub_colaboradores', JSON.stringify(updatedList));
    
    setColabNome('');
    setColabEmail('');
    setColabCargo('Comprador Pleno');
    setIsColabModalOpen(false);
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notifications */}
      {showSaveToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5">
          <Check className="h-5 w-5" />
          <span>Alterações salvas com sucesso no SupplyHub!</span>
        </div>
      )}
      
      {showUploadToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-indigo-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5">
          <Camera className="h-5 w-5 animate-pulse" />
          <span>Upload de logotipo simulado com sucesso!</span>
        </div>
      )}

      {/* Voltar ao Dashboard Link */}
      <button 
        onClick={() => navigate('/dashboard')}
        className="group flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Voltar ao Dashboard
      </button>

      {/* Screen Header with Logo and Editable Name */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        {/* Input oculto para upload de logo */}
        <input
          type="file"
          accept="image/*"
          ref={logoFileRef}
          onChange={handleLogoFileChange}
          className="hidden"
        />

        <div className="flex items-center gap-4">
          {/* Logo com lápis sempre visível */}
          <div
            className="relative shrink-0 cursor-pointer"
            onClick={triggerLogoUpload}
            title="Clique para alterar o logo"
          >
            <div className="h-16 w-16 rounded-full border-2 border-indigo-200 overflow-hidden bg-slate-900 flex items-center justify-center shadow-sm">
              {companyLogoUrl ? (
                <img src={companyLogoUrl} alt="Logo da empresa" className="h-full w-full object-cover" />
              ) : (
                <Logo className="h-16 w-16" size={64} />
              )}
            </div>
            {/* Lápis sempre visível (canto inferior direito) */}
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center shadow-sm">
              <Pencil className="h-3 w-3 text-white" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                <Building2 className="h-6 w-6 text-indigo-600" />
                Minha Empresa
              </h2>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full group cursor-pointer hover:bg-slate-200 transition-colors">
                <Input
                  type="text"
                  value={nomeFantasia}
                  onChange={(e) => handleNomeFantasiaChange(e.target.value)}
                  className="bg-transparent border-none p-0 h-auto w-[180px] font-semibold text-slate-700 text-sm focus:ring-0 focus:outline-none placeholder:text-slate-400"
                  placeholder="Nome Fantasia"
                />
                <Edit2 className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
              </div>
            </div>
            <p className="text-slate-500 text-sm">Gerencie a identidade e o perfil de atuação da empresa no SupplyHub.</p>
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-2 px-5 py-2.5 shadow-sm rounded-lg hover:shadow transition-all shrink-0 md:self-center self-start"
        >
          <Save className="h-4 w-4" />
          Salvar Alterações
        </Button>
      </div>

      {/* Tabs Layout */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto pb-1" aria-label="Tabs">
          {[
            { id: 'gerais', label: 'Dados Gerais', icon: Building2 },
            { id: 'comercial', label: 'Perfil Comercial', icon: Globe },
            { id: 'colaboradores', label: 'Colaboradores', icon: Users },
            { id: 'solicitantes', label: 'Solicitantes', icon: Users },
            { id: 'permissoes', label: 'Permissões', icon: Shield },
            { id: 'aprovacoes', label: 'Aprovações', icon: FileCheck },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  group flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-all
                  ${isActive 
                    ? 'border-indigo-600 text-indigo-600 font-semibold' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
                `}
              >
                <tab.icon className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels */}
      <div className="mt-6">
        {activeTab === 'gerais' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Card: Identidade Visual */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6 bg-white border-slate-200/80 shadow-sm rounded-xl">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Identidade Visual</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Defina a identidade de marca e informações públicas da sua empresa.</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-6">
                    {/* Logo Section com upload real */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div
                        className="relative cursor-pointer"
                        onClick={triggerLogoUpload}
                        title="Clique para carregar o logo da empresa"
                      >
                        <div className="h-24 w-24 rounded-full border border-slate-200 bg-slate-950 overflow-hidden flex items-center justify-center shadow-sm">
                          {companyLogoUrl ? (
                            <img src={companyLogoUrl} alt="Logo" className="h-full w-full object-cover" />
                          ) : (
                            <Logo className="h-24 w-24" size={96} />
                          )}
                        </div>
                        {/* Lápis sempre visível */}
                        <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center shadow-md">
                          <Pencil className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Logotipo</span>
                      <button
                        onClick={triggerLogoUpload}
                        className="text-[10px] text-indigo-600 font-bold hover:underline"
                      >
                        Alterar logo
                      </button>
                    </div>

                    {/* Inputs */}
                    <div className="flex-1 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="nomeFantasiaForm" className="text-slate-700 font-medium text-xs uppercase tracking-wider">Nome Fantasia</Label>
                        <Input
                          id="nomeFantasiaForm"
                          value={nomeFantasia}
                          onChange={(e) => handleNomeFantasiaChange(e.target.value)}
                          placeholder="Ex: SupplyHub"
                          className="border-slate-200 focus-visible:ring-indigo-500 font-medium"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="cnpjForm" className="text-slate-700 font-medium text-xs uppercase tracking-wider">CNPJ</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              id="cnpjForm"
                              value={cnpjInput}
                              onChange={handleCnpjInputChange}
                              placeholder="00.000.000/0001-00"
                              className="border-slate-200 focus-visible:ring-indigo-500 font-medium"
                            />
                            {cnpjError && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <Button 
                            type="button"
                            variant="outline"
                            onClick={handleCnpjSearch}
                            disabled={isLoadingCnpj}
                            className="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 flex items-center gap-1 px-4 font-medium"
                          >
                            {isLoadingCnpj ? (
                              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                            Consultar
                          </Button>
                        </div>
                        {cnpjError && (
                          <p className="text-xs text-red-500 font-medium mt-1">{cnpjError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Descrição da Empresa */}
              <Card className="p-6 bg-white border-slate-200/80 shadow-sm rounded-xl space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Descrição da Empresa</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Resumo sobre a atuação no mercado para potenciais fornecedores/clientes.</p>
                </div>
                <div className="space-y-2">
                  <textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={4}
                    className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Escreva sobre o core business da empresa..."
                  />
                </div>
              </Card>

              {/* CNPJ Card Data (Loaded fields) */}
              <Card className="p-6 bg-white border-slate-200/80 shadow-sm rounded-xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Dados do Cartão de CNPJ</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Informações atualizadas obtidas da Receita Federal ou editadas manualmente.</p>
                  </div>
                  <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200/50">
                    Sincronizado
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Razão Social</span>
                    <Input
                      placeholder="Razão Social da Empresa"
                      value={razaoSocial}
                      onChange={e => setRazaoSocial(e.target.value)}
                      className="border-slate-200 focus-visible:ring-indigo-500 font-semibold text-slate-700 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">CNPJ Oficial</span>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-150 text-sm font-medium text-slate-500">
                        {cnpjInput || 'Nenhum CNPJ informado'}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Em atividade desde</span>
                      <Input
                        placeholder="Ex: 24/09/2023"
                        value={emAtividadeDesde}
                        onChange={e => setEmAtividadeDesde(e.target.value)}
                        className="border-slate-200 focus-visible:ring-indigo-500 text-slate-700 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Atividades Principais (CNAE)</span>
                    <textarea
                      rows={3}
                      placeholder="Atividades principais e CNAEs da empresa..."
                      value={atividadesPrincipais}
                      onChange={e => setAtividadesPrincipais(e.target.value)}
                      className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 text-slate-700 leading-relaxed"
                    />
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Sidebar: Informações Corporativas / Contato */}
            <div className="space-y-6">
              <Card className="p-6 bg-white border-slate-200/80 shadow-sm rounded-xl space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Informações Corporativas</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Informações de contato e operacional da empresa.</p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailComercial" className="text-slate-700 font-medium text-xs uppercase tracking-wider">E-mail Comercial</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="emailComercial"
                        type="email"
                        value={emailComercial}
                        onChange={(e) => setEmailComercial(e.target.value)}
                        className="border-slate-200 pl-10 focus-visible:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefoneComercial" className="text-slate-700 font-medium text-xs uppercase tracking-wider">Telefone Comercial</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="telefoneComercial"
                        type="text"
                        value={telefoneComercial}
                        onChange={(e) => setTelefoneComercial(e.target.value)}
                        className="border-slate-200 pl-10 focus-visible:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium text-xs uppercase tracking-wider">Website</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        type="text"
                        defaultValue="https://www.supplyhub.ai"
                        disabled
                        className="border-slate-200 pl-10 bg-slate-50 text-slate-500 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Resumo da Organização */}
              <Card className="p-6 bg-slate-900 text-white rounded-xl shadow-lg relative overflow-hidden">
                <div className="absolute right-0 bottom-0 translate-y-12 translate-x-12 h-36 w-36 bg-indigo-500/10 rounded-full blur-xl"></div>
                <div className="space-y-4 relative z-10">
                  <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-300 rounded text-[10px] font-semibold tracking-wider uppercase">Plano Pro</span>
                  <div>
                    <h4 className="text-lg font-bold">{nomeFantasia || 'Sua Empresa'}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Membro no SupplyHub desde 2026</p>
                  </div>
                  <div className="border-t border-white/10 pt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Total de Colaboradores:</span>
                      <span className="font-semibold text-slate-200">12 colaboradores</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Cotações Realizadas:</span>
                      <span className="font-semibold text-slate-200">147 cotações</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Status da Conta:</span>
                      <span className="font-semibold text-emerald-400">Ativa & Homologada</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'comercial' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Esquerda: Atuação Principal */}
            <div className="lg:col-span-4">
              <Card className="p-6 bg-white border-slate-200/80 shadow-sm rounded-xl space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Atuação Principal</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700">Como sua empresa atua na rede?</Label>
                    <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 bg-white">
                      <option>Comprador e Fornecedor</option>
                      <option>Apenas Comprador</option>
                      <option>Apenas Fornecedor</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700">Porte da Empresa</Label>
                    <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 bg-white">
                      <option>Selecione o porte</option>
                      <option>Microempresa (ME)</option>
                      <option>Pequena Empresa (EPP)</option>
                      <option>Média Empresa</option>
                      <option>Grande Empresa</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700">Segmentos Atendidos</Label>
                    <div className="border border-slate-200 rounded-lg p-2 min-h-[80px] bg-white flex flex-col justify-between">
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 font-medium px-2.5 py-1">Indústria Geral <X className="h-3 w-3 text-slate-400" /></Badge>
                        <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 font-medium px-2.5 py-1">Tecnologia <X className="h-3 w-3 text-slate-400" /></Badge>
                      </div>
                      <div className="flex justify-end mt-2"><Globe className="h-4 w-4 text-slate-400" /></div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Direita: Interesses e Ofertas */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Interesses de Compra */}
              <Card className="p-6 bg-white border-slate-200/80 shadow-sm rounded-xl border-r-[4px] border-r-blue-500 space-y-4">
                <div className="flex items-center gap-2">
                  <Tags className="h-5 w-5 text-blue-500" />
                  <h3 className="text-sm font-bold text-slate-900">Interesses de Compra (Matchmaking Hub.IA)</h3>
                </div>
                
                <div>
                  <Label className="text-[11px] font-bold text-slate-900 block mb-1">Categorias de Interesse</Label>
                  <p className="text-[10px] text-slate-500 mb-3">Selecione as categorias que sua empresa costuma comprar para receber recomendações proativas de fornecedores.</p>
                  
                  <div className="border border-slate-200 rounded-lg p-3 min-h-[100px] bg-white flex flex-col justify-between">
                    <div className="flex flex-wrap gap-2">
                      {['Elétrica', 'Automação', 'Mecânica', 'Pneumática', 'EPI', 'Fixação', 'Instrumentação'].map(cat => (
                        <Badge key={cat} className="bg-slate-50 text-slate-600 border border-slate-200 flex items-center gap-1 font-medium px-2.5 py-1 hover:bg-slate-100">
                          {cat} <X className="h-3 w-3 text-slate-400" />
                        </Badge>
                      ))}
                    </div>
                    <div className="flex justify-end"><Globe className="h-4 w-4 text-slate-300" /></div>
                  </div>
                </div>

                <button className="text-blue-600 text-xs font-semibold flex items-center gap-1 hover:text-blue-700">
                  <Plus className="h-3.5 w-3.5" /> Solicitar nova categoria
                </button>
              </Card>

              {/* Oferta e Alcance */}
              <Card className="p-6 bg-white border-slate-200/80 shadow-sm rounded-xl border-r-[4px] border-r-emerald-500 space-y-4 flex-1">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-sm font-bold text-slate-900">Oferta e Alcance Comercial</h3>
                </div>

                <div>
                  <Label className="text-[11px] font-bold text-slate-900 block mb-1">Categorias Comercializadas</Label>
                  <p className="text-[10px] text-slate-500 mb-2">O que você vende? A Hub.IA conectará sua empresa a compradores que buscam esses itens.</p>
                  <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 bg-white text-slate-500">
                    <option>Selecione as categorias vendidas...</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-900">Área de Atendimento</Label>
                    <p className="text-[9px] text-slate-500">Digite a região e pressione Enter. Ex: "São Paulo - SP", "Brasil"</p>
                    <Input placeholder="Adicionar região..." className="h-10 border-slate-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                      <Globe className="h-3 w-3 text-slate-400" /> Raio Máximo de Atendimento
                    </Label>
                    <p className="text-[9px] text-slate-500">Distância limite a partir da sua sede.</p>
                    <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 bg-white">
                      <option>Brasil Todo</option>
                      <option>Apenas meu Estado</option>
                      <option>Apenas minha Cidade</option>
                    </select>
                  </div>
                </div>
              </Card>

            </div>
          </div>
        )}

        {activeTab === 'colaboradores' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-1"><Users className="h-6 w-6 text-indigo-700" /></div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Gestão de Operadores</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Administre os acessos corporativos, hierarquias e status da sua equipe no SupplyHub.</p>
                </div>
              </div>
              <Button onClick={() => setIsColabModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                <Plus className="h-4 w-4 mr-1.5" /> Convidar Operador
              </Button>
            </div>

            <div className="flex items-center gap-3 border-b border-slate-200 pb-px">
              <button className="text-sm font-bold text-slate-900 border-b-2 border-indigo-600 pb-3 px-1 flex items-center gap-2">
                Operadores Ativos <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 ml-1">1</Badge>
              </button>
              <button className="text-sm font-semibold text-slate-500 hover:text-slate-700 pb-3 px-1 flex items-center gap-2">
                Inativos <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-200 border-0 ml-1">0</Badge>
              </button>
              <button className="text-sm font-semibold text-slate-500 hover:text-slate-700 pb-3 px-1 flex items-center gap-2">
                Convites Pendentes <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0 ml-1">1</Badge>
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
              <Table className="overflow-visible">
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="font-bold text-[10px] text-slate-500 tracking-wider">USUÁRIO</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-500 tracking-wider">ESTRUTURA (DEPTO/CC)</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-500 tracking-wider">GESTOR IMEDIATO</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-500 tracking-wider">PERFIL DE ACESSO</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-500 tracking-wider">ÚLTIMA ATUALIZAÇÃO</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-500 tracking-wider">STATUS</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-500 tracking-wider text-right">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="hover:bg-slate-50 group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                          <Users className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">Cordebello</span>
                          <span className="text-[11px] text-slate-500">viniciuscordebello@gmail.com</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-slate-600 flex items-center gap-1"><Factory className="h-3 w-3 text-slate-400" /> Industria</span>
                        <span className="text-[10px] text-slate-400">CC: viniciuscordebello@gmail.com</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-400">-</span>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-slate-800 text-white hover:bg-slate-900 border-0 rounded-md font-bold px-2.5 py-0.5">Administrador</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-500 flex items-center gap-1.5"><FileCheck className="h-3.5 w-3.5 text-slate-400" /> 05/07/2026</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-bold text-emerald-600">Ativo</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="relative inline-block text-left">
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors peer">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        <div className="hidden peer-focus:block hover:block absolute right-0 top-8 z-50 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2">
                          <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gestão do Usuário</p>
                          </div>
                          <button className="w-full text-left px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                            <UserCog className="h-3.5 w-3.5 text-slate-400" /> Editar Estrutura
                          </button>
                          <button className="w-full text-left px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 flex items-center gap-2">
                            <UserMinus className="h-3.5 w-3.5 text-amber-500" /> Desativar Acesso
                          </button>
                          <button className="w-full text-left px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 mt-1">
                            <Trash2 className="h-3.5 w-3.5 text-red-500" /> Remover da Empresa
                          </button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  <TableRow className="hover:bg-slate-50 group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                          <Mail className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-700">Aguardando Cadastro</span>
                          <span className="text-[11px] text-slate-500">viniciuscordebello@hotmail.com</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-400">-</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-400">-</span>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-bold px-2.5 py-0.5">Gestor</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-500 flex items-center gap-1.5"><FileCheck className="h-3.5 w-3.5 text-slate-400" /> 08/07/2026</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-bold text-amber-600">Pendente</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="relative inline-block text-left">
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors peer">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        <div className="hidden peer-focus:block hover:block absolute right-0 top-8 z-50 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2">
                          <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gestão do Usuário</p>
                          </div>
                          <button className="w-full text-left px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                            <UserCog className="h-3.5 w-3.5 text-slate-400" /> Editar Estrutura
                          </button>
                          <button className="w-full text-left px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 mt-1">
                            <Trash2 className="h-3.5 w-3.5 text-red-500" /> Remover da Empresa
                          </button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            
            {/* Modal de Adição de Colaborador */}
            {isColabModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 bg-indigo-50/20">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Adicionar Colaborador</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Cadastrar novo membro na organização</p>
                    </div>
                    <button onClick={() => setIsColabModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full">
                      <X className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nome Completo *</label>
                      <Input
                        placeholder="Ex: Arthur Dent"
                        value={colabNome}
                        onChange={e => setColabNome(e.target.value)}
                        className="h-10 text-sm border-slate-300"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">E-mail Corporativo *</label>
                      <Input
                        type="email"
                        placeholder="Ex: arthur.dent@supplyhub.ai"
                        value={colabEmail}
                        onChange={e => setColabEmail(e.target.value)}
                        className="h-10 text-sm border-slate-300"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Cargo / Perfil *</label>
                      <select
                        value={colabCargo}
                        onChange={e => setColabCargo(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
                      >
                        <option value="Diretor de Suprimentos">Diretor de Suprimentos</option>
                        <option value="Comprador Pleno">Comprador Pleno</option>
                        <option value="Comprador Júnior">Comprador Júnior</option>
                        <option value="Gestor Financeiro">Gestor Financeiro</option>
                        <option value="Analista de Sistemas">Analista de Sistemas</option>
                      </select>
                    </div>
                  </div>

                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsColabModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
                    <Button
                      onClick={handleAddColab}
                      disabled={!colabNome.trim() || !colabEmail.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold shadow-sm"
                    >
                      Confirmar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'solicitantes' && (
          <Card className="p-6 bg-white border-slate-200/80 shadow-sm rounded-xl space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Solicitantes</h3>
                <p className="text-sm text-slate-500">Membros autorizados a gerar novas solicitações de cotação.</p>
              </div>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                Adicionar Solicitante
              </Button>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Limite Mensal</TableHead>
                    <TableHead>Aprovações Pendentes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { nome: 'Zaphod Beeblebrox', depto: 'Diretoria Executiva', limite: 'Sem Limite', pendentes: 2 },
                    { nome: 'Slartibartfast', depto: 'Infraestrutura / Engenharia', limite: 'R$ 150.000,00', pendentes: 0 },
                    { nome: 'Trillian Astro', depto: 'Tecnologia / P&D', limite: 'R$ 50.000,00', pendentes: 1 },
                  ].map((req, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold text-slate-900">{req.nome}</TableCell>
                      <TableCell>{req.depto}</TableCell>
                      <TableCell>{req.limite}</TableCell>
                      <TableCell>
                        {req.pendentes > 0 ? (
                          <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200">
                            {req.pendentes} pendentes
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">Nenhuma</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {activeTab === 'permissoes' && (
          <Card className="p-6 bg-white border-slate-200/80 shadow-sm rounded-xl space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Configurações de Permissões</h3>
              <p className="text-sm text-slate-500">Controle o acesso de colaboradores aos módulos da plataforma.</p>
            </div>

            <div className="space-y-4">
              {[
                { modulo: 'Cotações B2B', desc: 'Permite criar e comparar cotações de fornecedores.', padrao: true },
                { modulo: 'Homologação de Fornecedores', desc: 'Permite gerenciar a aprovação e auditoria de parceiros.', padrao: true },
                { modulo: 'Catálogo de Produtos', desc: 'Permite adicionar e remover produtos do inventário global.', padrao: false },
                { modulo: 'Faturamento e Assinatura', desc: 'Gerenciamento do plano da empresa e métodos de pagamento.', padrao: false },
              ].map((p, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                  <input type="checkbox" defaultChecked={p.padrao} className="mt-1 h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-slate-900">{p.modulo}</h4>
                    <p className="text-xs text-slate-500">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'aprovacoes' && (
          <Card className="p-6 bg-white border-slate-200/80 shadow-sm rounded-xl space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Histórico de Aprovações</h3>
              <p className="text-sm text-slate-500">Histórico de ações de homologação e auditorias internas.</p>
            </div>

            <div className="space-y-4">
              {[
                { acao: 'Homologação de Fornecedor aprovada', det: 'Tech Solutions Ltda foi marcado como HOMOLOGADO por Arthur Dent', data: '10/07/2026 14:32', icon: FileCheck },
                { acao: 'Novo Solicitante Adicionado', det: 'Trillian Astro adicionada ao departamento Tecnologia / P&D', data: '08/07/2026 09:15', icon: Users },
                { acao: 'Dados do CNPJ atualizados', det: 'Consulta automática atualizou a Razão Social da Receita Federal', data: '05/07/2026 18:00', icon: Building2 },
              ].map((log, idx) => (
                <div key={idx} className="flex gap-4 p-3 border-l-4 border-indigo-500 bg-slate-50 rounded-r-lg">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg h-9 w-9 shrink-0 flex items-center justify-center">
                    <log.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900">{log.acao}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{log.det}</p>
                    <span className="text-[10px] text-slate-400 font-medium block mt-1">{log.data}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
