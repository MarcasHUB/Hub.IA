import { useState, useEffect } from 'react';
import { Search, Building2, Network, Users, MapPin, Globe, Plus, X, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';
import { Badge } from '@/shared/components/ui/Badge';
import { EntityCard } from '@/shared/components/ui/EntityCard';
import { useNotifications } from '@/modules/notifications/presentation/context/NotificationContext';
import { SupabaseOrganizationConnectionRepository } from '../../infrastructure/repositories/SupabaseOrganizationConnectionRepository';

const repo = new SupabaseOrganizationConnectionRepository();
const tenantId = localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';

// ─── Mock data ─────────────────────────────────────────────────────────────────

interface Company {
  id: string;
  name: string;
  document: string;
  segment: string;
  city: string;
  state: string;
  description: string;
  website?: string;
  employeesRange: string;
  connected: boolean;
  invited: boolean;
}

// Mocks removidos para transição de dados reais.

const SEGMENTS = ['Todos', 'Metalurgia', 'Química', 'Embalagens', 'TI & Hardware', 'TI & Software', 'Logística', 'Material Elétrico'];

// ─── CompanyCard ──────────────────────────────────────────────────────────────

function CompanyCard({ company, onConnect, onCancelInvite }: {
  company: Company;
  onConnect: (id: string) => void;
  onCancelInvite: (id: string) => void;
}) {
  const initials = company.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-200 hover:shadow-md transition-all duration-200 flex flex-col gap-3">
      {/* Header do card */}
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{company.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 border-0 px-1.5 py-0.5">
              {company.segment}
            </Badge>
          </div>
        </div>
      </div>

      {/* Descrição */}
      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{company.description}</p>

      {/* Localização / CNPJ */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />{company.city}, {company.state}
        </span>
        {company.website && (
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" />{company.website}
          </span>
        )}
      </div>

      {/* Funcionários */}
      <div className="flex items-center gap-1 text-[11px] text-slate-400">
        <Users className="h-3 w-3" />
        {company.employeesRange} funcionários · CNPJ {company.document}
      </div>

      {/* Ação */}
      <div className="mt-auto pt-1">
        {company.invited ? (
          <button
            onClick={() => onCancelInvite(company.id)}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-2 hover:bg-amber-100 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Convite Enviado · Cancelar
          </button>
        ) : (
          <Button
            onClick={() => onConnect(company.id)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Conectar
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── NetworkPage ──────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  
  useEffect(() => {
    async function load() {
       try {
         await repo.findByOrganization(tenantId);
         // Simulate loading from companies directory
         // For now we map empty as the repository isn't fully fetching companies directory yet
       } catch (e) {}
    }
    load();
  }, []);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('Todos');
  const { addMockNotification } = useNotifications();

  // Estados locais para cadastrar nova empresa na rede
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompDoc, setNewCompDoc] = useState('');
  const [newCompEmail, setNewCompEmail] = useState('');
  const [newCompSeg, setNewCompSeg] = useState('');
  const [newCompCity, setNewCompCity] = useState('');
  const [newCompState, setNewCompState] = useState('');
  const [newCompDesc, setNewCompDesc] = useState('');
  const [newCompWeb, setNewCompWeb] = useState('');
  const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);

  const handleCnpjBlur = async () => {
    const cleanCnpj = newCompDoc.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;
    setIsFetchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (response.ok) {
        const data = await response.json();
        setNewCompName(data.razao_social || data.nome_fantasia || '');
        setNewCompCity(data.municipio || '');
        setNewCompState(data.uf || '');
        if (data.cnae_fiscal_descricao) {
          setNewCompSeg(data.cnae_fiscal_descricao);
        }
      }
    } catch (e) {
      console.error("Falha ao buscar CNPJ na BrasilAPI", e);
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  const isHubIA = true;

  const filtered = companies.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                        c.segment.toLowerCase().includes(search.toLowerCase());
    const matchSegment = segment === 'Todos' || c.segment === segment;
    return matchSearch && matchSegment && !c.connected;
  });

  const handleConnect = (id: string) => {
    const updated = companies.map((c) => c.id === id ? { ...c, invited: true } : c);
    setCompanies(updated);
    // Persist connection request to Supabase
    repo.save({
      id: crypto.randomUUID(),
      buyerOrganizationId: tenantId,
      supplierOrganizationId: id,
      status: 'Inativo',
      connectionType: 'network',
      connectedAt: new Date(),
      approvedBy: '',
      notes: '',
      createdAt: new Date()
    });

    const company = companies.find((c) => c.id === id);
    if (company) {
      addMockNotification({
        type: 'connection_request_received',
        title: 'Convite Enviado',
        message: `Convite de conexão enviado para ${company.name}.`,
        action_url: '/suppliers',
        metadata: { company_name: company.name },
        is_read: false,
      });
    }
  };

  const handleCancelInvite = (id: string) => {
    setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, invited: false } : c));
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      {/* HEADER BANNER - Azul Escuro */}
      <div className="bg-slate-900 rounded-[2rem] mx-4 sm:mx-6 mt-6 mb-2 px-6 py-8 shadow-xl">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Network className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-400" />
                Rede de Empresas
              </h1>
              <p className="text-slate-400 mt-1 text-sm max-w-2xl">
                Descubra e conecte-se com empresas da plataforma SupplyHub.IA.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {isHubIA && (
                <Button onClick={() => setIsCreateModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-5 shadow-md shadow-indigo-900/20 border-0">
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar Fornecedor na Rede
                </Button>
              )}
              <Button variant="outline" onClick={() => window.location.href = '/suppliers'} className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 h-10 px-4 font-bold shadow-sm">
                <Building2 className="mr-2 h-4 w-4" />
                Meus Parceiros
              </Button>
            </div>
          </div>

          {/* Filtros dentro do banner */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
              <ClearableInput
                placeholder="Buscar empresa, segmento..."
                className="pl-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12 rounded-xl focus:border-indigo-500 shadow-inner"
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
              />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {SEGMENTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSegment(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
                    segment === s
                      ? 'bg-indigo-500 text-white border-indigo-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1600px] mx-auto">

      {/* Contagem */}
      <p className="text-sm text-slate-500 mb-6">
        {filtered.length} empresa{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* CONVITES ENVIADOS */}
      {filtered.filter(c => c.invited).length > 0 && (
        <div className="space-y-4 mb-10">
          <h3 className="text-sm font-bold text-slate-900 px-1">Convites Enviados</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.filter(c => c.invited).map(c => (
              <EntityCard
                key={c.id}
                type="empresa"
                title={c.name}
                subtitle={`CNPJ: ${c.document}`}
                status="enviado"
                sentDate={new Date().toLocaleDateString('pt-BR')}
                onCancel={() => handleCancelInvite(c.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Grid de empresas (Não convidadas) */}
      {filtered.filter(c => !c.invited).length === 0 && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Building2 className="h-14 w-14 mb-4 text-slate-200" />
          <p className="font-medium">Nenhuma empresa encontrada.</p>
          <p className="text-sm mt-1">Tente ajustar os filtros de busca.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.filter(c => !c.invited).map((c) => (
            <CompanyCard
              key={c.id}
              company={c}
              onConnect={handleConnect}
              onCancelInvite={handleCancelInvite}
            />
          ))}
        </div>
      )}
      {/* Modal: Cadastrar Empresa na Rede B2B */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 flex flex-col">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-600" /> Cadastrar Empresa na Rede B2B
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Adicione empresas para convidar e conectar no ecossistema real.</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newCompName.trim() || !newCompDoc.trim() || !newCompEmail.trim()) return;

              // Em produção isso chamaria InvitationService
              // Simulação para atualização da UI local:
              const newCompany: Company = {
                id: `net-${Date.now()}`,
                name: newCompName,
                document: newCompDoc,
                segment: newCompSeg || 'Geral',
                city: newCompCity || 'São Paulo',
                state: newCompState || 'SP',
                description: newCompDesc || 'Convidado via Rede B2B.',
                website: newCompWeb || undefined,
                employeesRange: '10–50',
                connected: false,
                invited: true
              };

              const updatedList = [newCompany, ...companies];
              setCompanies(updatedList);
              
              // Persist to Supabase
              repo.save({
                id: crypto.randomUUID(),
                buyerOrganizationId: tenantId,
                supplierOrganizationId: newCompany.id,
                status: 'Inativo',
                connectionType: 'network',
                connectedAt: new Date(),
                approvedBy: '',
                notes: newCompDesc,
                createdAt: new Date()
              }).catch(err => {
                console.error("Erro ao salvar connection_request:", err);
                alert("Falha ao salvar convite na rede.");
              });
              
              // Simula notificação UI
              addMockNotification({
                title: 'Convite enviado!',
                message: `O e-mail foi disparado para ${newCompEmail}.`,
                type: 'connection_request_received',
                is_read: false,
                });

              // Reseta campos e fecha
              setNewCompName('');
              setNewCompDoc('');
              setNewCompEmail('');
              setNewCompSeg('');
              setNewCompCity('');
              setNewCompState('');
              setNewCompDesc('');
              setNewCompWeb('');
              setIsCreateModalOpen(false);
            }} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-slate-700">CNPJ *</label>
                  <div className="relative">
                    <Input placeholder="Ex: 00.000.000/0001-00" value={newCompDoc} onChange={e => setNewCompDoc(e.target.value)} onBlur={handleCnpjBlur} required />
                    {isFetchingCnpj && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">E-mail do Fornecedor *</label>
                  <Input type="email" placeholder="contato@fornecedor.com.br" value={newCompEmail} onChange={e => setNewCompEmail(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Razão Social / Nome Fantasia *</label>
                <Input placeholder="Ex: Metalúrgica Norte" value={newCompName} onChange={e => setNewCompName(e.target.value)} required />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Segmento Principal</label>
                <Input placeholder="Ex: EPI / Proteção ou Material Elétrico" value={newCompSeg} onChange={e => setNewCompSeg(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Cidade</label>
                  <Input placeholder="Ex: São Paulo" value={newCompCity} onChange={e => setNewCompCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Estado (UF)</label>
                  <Input placeholder="Ex: SP" value={newCompState} onChange={e => setNewCompState(e.target.value)} maxLength={2} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
                <Button type="submit" disabled={isFetchingCnpj} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold shadow-sm">
                  Convidar para a Rede
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      </div>
      </div>
    </div>
  );
}
