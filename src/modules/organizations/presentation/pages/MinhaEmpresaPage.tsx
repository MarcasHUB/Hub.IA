import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Building2, Users, Layers, ArrowLeftRight, ScrollText,
  Globe, Phone, Mail, Hash, Shield, UserCheck,
  Save, CheckCircle2
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Card, CardContent } from '@/shared/components/ui/Card';
import DelegationsPage from '../../../employees/presentation/pages/DelegationsPage';
import AccessLogsPage from '../../../employees/presentation/pages/AccessLogsPage';
import OperatorsPage from '../../../employees/presentation/pages/OperatorsPage';
import SegmentsPage from '../../../employees/presentation/pages/SegmentsPage';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Tab = 'dados' | 'operadores' | 'segmentos' | 'delegacoes' | 'logs';

const EMPRESA_TABS: { id: Tab; label: string; icon: any; href: string; desc: string }[] = [
  {
    id: 'dados',
    label: 'Dados da Empresa',
    icon: Building2,
    href: '/empresa',
    desc: 'Razão social, CNPJ e contatos',
  },
  {
    id: 'operadores',
    label: 'Colaboradores/Operadores',
    icon: Users,
    href: '/empresa/operadores',
    desc: 'Convites, perfis e acessos',
  },
  {
    id: 'delegacoes',
    label: 'Delegações',
    icon: ArrowLeftRight,
    href: '/empresa/delegacoes',
    desc: 'Férias e substituições temporárias',
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: ScrollText,
    href: '/empresa/logs',
    desc: 'Auditoria e acessos',
  },
];

const MASTER_TABS: { id: string; label: string; icon: any; href: string; }[] = [
  { id: 'master-empresas', label: 'Empresas', icon: Building2, href: '/empresa/empresas' },
  { id: 'master-material', label: 'Material', icon: Layers, href: '/products' },
  { id: 'master-categoria', label: 'Categoria', icon: Layers, href: '/empresa/categorias' },
  { id: 'master-segmentos', label: 'Segmentos', icon: Layers, href: '/empresa/segmentos' },
];

// ─── Sub-página: Dados da Empresa ─────────────────────────────────────────────
function DadosEmpresaTab() {
  const [form, setForm] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    email_corporativo: '',
    telefone: '',
    whatsapp: '',
    site: '',
    logo_url: '',
    gestor_principal: '',
  });
  const [saved, setSaved] = useState(false);
  const [completion, setCompletion] = useState(0);
  const [orgId, setOrgId] = useState('');

  import('@/infrastructure/supabase/client').then(({ supabase }) => {
    useState(() => {
      const load = async () => {
        const id = localStorage.getItem('supplyhub_organization_id');
        if (!id) return;
        setOrgId(id);
        const { data } = await supabase.from('organizations').select('*').eq('id', id).single();
        if (data) {
          setForm({
            razao_social: data.name || '',
            nome_fantasia: data.trade_name || '',
            cnpj: data.document || '',
            email_corporativo: data.commercial_email || '',
            telefone: data.phone || '',
            whatsapp: data.whatsapp || '',
            site: data.website || '',
            logo_url: data.logo_url || '',
            gestor_principal: localStorage.getItem('supplyhub_gestor_principal') || '',
          });
          setCompletion(data.profile_completion || 50);
        }
      };
      load();
    });
  });

  const handleChange = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    const { supabase } = await import('@/infrastructure/supabase/client');
    let comp = 50;
    if (form.logo_url) comp += 20;
    if (form.site) comp += 10;
    if (form.whatsapp) comp += 10;
    
    await supabase.from('organizations').update({
      name: form.razao_social,
      trade_name: form.nome_fantasia,
      document: form.cnpj,
      commercial_email: form.email_corporativo,
      phone: form.telefone,
      whatsapp: form.whatsapp,
      website: form.site,
      logo_url: form.logo_url,
      profile_completion: comp
    }).eq('id', orgId);

    setCompletion(comp);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const Field = ({
    label, icon: Icon, field, type = 'text', placeholder, hint,
  }: {
    label: string; icon: any; field: string; type?: string; placeholder?: string; hint?: string;
  }) => (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
        <Icon className="h-3 w-3" /> {label}
      </label>
      <Input
        type={type}
        value={(form as any)[field]}
        onChange={e => handleChange(field, e.target.value)}
        placeholder={placeholder}
        className="h-10 text-sm"
      />
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );

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

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Razão Social"
              icon={Hash}
              field="razao_social"
              placeholder="Ex: Empresa Tecnologia Ltda"
            />
            <Field
              label="Nome Fantasia"
              icon={Building2}
              field="nome_fantasia"
              placeholder="Ex: SupplyHub"
              hint="Exibido no menu superior"
            />
            <Field
              label="CNPJ"
              icon={Hash}
              field="cnpj"
              placeholder="00.000.000/0001-00"
            />
            <Field
              label="Telefone"
              icon={Phone}
              field="telefone"
              placeholder="(11) 3000-0000"
            />
            <Field
              label="WhatsApp"
              icon={Phone}
              field="whatsapp"
              placeholder="(11) 90000-0000"
            />
            <Field
              label="Site"
              icon={Globe}
              field="site"
              placeholder="www.suaempresa.com.br"
            />
          </div>

          <Field
            label="E-mail Corporativo"
            icon={Mail}
            field="email_corporativo"
            type="email"
            placeholder="contato@empresa.com.br"
            hint="Usado para convites institucionais e notificações da Hub.IA"
          />

          <Field
            label="Gestor Principal"
            icon={UserCheck}
            field="gestor_principal"
            placeholder="Nome do responsável máximo"
          />

          <div className="flex justify-end pt-2">
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
import { CategoriesPage } from '../../../categories/presentation/pages/CategoriesPage';
import { supabase } from '@/infrastructure/supabase/client';

export default function MinhaEmpresaPage() {
  const location = useLocation();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  import('react').then(({ useEffect }) => {
    useEffect(() => {
      const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('users').select('is_superadmin').eq('id', user.id).single();
          setIsSuperAdmin(data?.is_superadmin || false);
        }
      };
      checkAdmin();
    }, []);
  });

  type Tab = 'dados' | 'operadores' | 'segmentos' | 'categorias' | 'delegacoes' | 'logs';

  const activeTab: Tab = (() => {
    if (location.pathname.includes('/operadores')) return 'operadores';
    if (location.pathname.includes('/segmentos')) return 'segmentos';
    if (location.pathname.includes('/categorias')) return 'categorias';
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
            
            {/* Botão temporário para teste de solicitação de campo (PWA) */}
            <div className="flex items-center gap-3 shrink-0">
              <Link 
                to="/pwa-choice"
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 rounded-xl font-bold flex items-center shadow-md transition-colors"
                title="Testar Acesso APP / Solicitação de Campo"
              >
                Testar Acesso APP Campo
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="flex-1 px-6 pb-8">
        <div className="max-w-[1600px] mx-auto flex gap-6">

          {/* Sidebar de navegação */}
          <aside className="w-56 shrink-0 space-y-6">
            <div className="space-y-1">
              <h3 className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Minha Empresa</h3>
              {EMPRESA_TABS.map(tab => {
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

            {isSuperAdmin && (
              <div className="space-y-1">
                <h3 className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cadastros Master</h3>
                {MASTER_TABS.map(tab => {
                  const Icon = tab.icon;
                  // placeholder for active state logic if we implement these routes inside this page
                  const isActive = false;
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
            )}
          </aside>

          {/* Área de conteúdo */}
          <main className="flex-1 min-w-0">
            {activeTab === 'dados' && <DadosEmpresaTab />}
            {activeTab === 'operadores' && <OperatorsPage />}
            {activeTab === 'segmentos' && <SegmentsPage />}
            {activeTab === 'categorias' && <CategoriesPage />}
            {activeTab === 'delegacoes' && <DelegationsPage />}
            {activeTab === 'logs' && <AccessLogsPage />}
          </main>
        </div>
      </div>
    </div>
  );
}
