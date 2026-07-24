import { useState, useMemo, useEffect } from 'react';
import { 
  Network, Users, Mail, MailOpen, History, CheckCircle2, 
  XCircle, Clock, Building2, Search 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { PartnerCard, Partner } from '../components/PartnerCard';
import { SupabaseSupplierRepository } from '../../infrastructure/repositories/SupabaseSupplierRepository';

const supplierRepo = new SupabaseSupplierRepository();
const tenantId = '00000000-0000-0000-0000-000000000000';

type Tab = 'parceiros' | 'convites_recebidos' | 'convites_enviados' | 'historico';
type SearchMode = 'name' | 'product' | 'segment';

export default function SuppliersListPage() {
  const [activeTab, setActiveTab]       = useState<Tab>('parceiros');
  const [partners, setPartners]         = useState<Partner[]>([]);
  
  useEffect(() => {
    async function load() {
       try {
         const suppliers = await supplierRepo.findAll(tenantId);
         const mapped = suppliers.map(s => ({
            id: s.id,
            name: s.name,
            document: s.document,
            segment: 'Não definido',
            city: '-',
            state: '-',
            status: 'accepted' as const,
            connectionId: '',
            employeesRange: '-',
            rating: 0,
            responseTime: '-',
            quotationsCount: 0,
            products: []
         }));
         setPartners(mapped);
       } catch(e) {}
    }
    load();
  }, []);

  const [search, setSearch]             = useState('');
  const [searchMode, setSearchMode]     = useState<SearchMode>('name');
  const [segmentFilter, setSegmentFilter] = useState('Todos');

  const allSegments = useMemo(() => {
    return ['Todos', ...Array.from(new Set(partners.map(p => p.segment)))];
  }, [partners]);

  // ── Filtragem inteligente ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return partners.filter(p => {
      const matchSegment = segmentFilter === 'Todos' || p.segment === segmentFilter;
      const q = search.toLowerCase().trim();
      let matchSearch = true;
      if (q) {
        if (searchMode === 'name') {
          matchSearch = p.name.toLowerCase().includes(q);
        } else if (searchMode === 'product') {
          matchSearch = p.products.some(prod => prod.toLowerCase().includes(q));
        } else if (searchMode === 'segment') {
          matchSearch = p.segment.toLowerCase().includes(q);
        }
      }
      return matchSegment && matchSearch;
    });
  }, [partners, search, searchMode, segmentFilter]);

  const accepted       = filtered.filter(p => p.status === 'accepted');
  const invitesSent     = filtered.filter(p => p.status === 'pending_sent');
  const invitesReceived = filtered.filter(p => p.status === 'pending_received');

  const handleRemove = (id: string) => {
    const updated = partners.filter(p => p.id !== id);
    setPartners(updated);
  };
  const handleAccept = (id: string) => {
    const updated = partners.map(p => p.id === id ? { ...p, status: 'accepted' as const, since: new Date().toLocaleDateString('pt-BR') } : p);
    setPartners(updated);
  };
  const handleReject = (id: string) => {
    const updated = partners.filter(p => p.id !== id);
    setPartners(updated);
  };
  const handleCancel = (id: string) => {
    const updated = partners.filter(p => p.id !== id);
    setPartners(updated);
  };

  const SIDEBAR_SECTIONS = [
    {
      title: 'REDE DE NEGÓCIOS',
      items: [
        { id: 'parceiros', label: 'Parceiros', icon: Users, count: accepted.length },
        { id: 'convites_recebidos', label: 'Convites Recebidos', icon: Mail, count: invitesReceived.length },
        { id: 'convites_enviados', label: 'Convites Enviados', icon: MailOpen, count: invitesSent.length },
        { id: 'historico', label: 'Histórico', icon: History }
      ]
    }
  ];

  const SEARCH_MODES: { key: SearchMode; label: string }[] = [
    { key: 'name',    label: 'Nome da Empresa' },
    { key: 'product', label: 'Produto / Serviço' },
    { key: 'segment', label: 'Segmento' },
  ];

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      {/* HERO BANNER INSTITUCIONAL (Sem Busca) */}
      <div className="bg-slate-900 rounded-2xl mx-6 mt-6 mb-6 px-8 py-8 shadow-md flex justify-between items-start">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Rede de Negócios
          </h1>
          <p className="text-slate-400 mt-2 text-sm max-w-2xl leading-relaxed">
            Gerencie suas conexões com fornecedores e compradores na plataforma. <br />
            Descubra novos parceiros, acompanhe convites e expanda suas oportunidades comerciais.
          </p>
        </div>
        <Button onClick={() => window.location.href = '/suppliers/network'} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 font-bold shadow-md shadow-indigo-900/20 shrink-0">
          <Network className="h-4 w-4 mr-1.5" />
          Descobrir Parceiros
        </Button>
      </div>

      {/* CONTEÚDO E SIDEBAR */}
      <div className="flex-1 px-6 pb-8">
        <div className="max-w-[1600px] mx-auto flex gap-6">

          {/* Sidebar de navegação */}
          <aside className="w-56 shrink-0 space-y-6">
            {SIDEBAR_SECTIONS.map((section, idx) => (
              <div key={idx} className="space-y-1">
                <h3 className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{section.title}</h3>
                {section.items.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as Tab)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" />
                        {tab.label}
                      </span>
                      {tab.count !== undefined && tab.count > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive ? 'bg-indigo-400 text-indigo-50' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>

          {/* Área de conteúdo */}
          <main className="flex-1 min-w-0">
            {/* Filtros da listagem */}
            {activeTab !== 'historico' && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 space-y-4">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder={
                        searchMode === 'name'    ? 'Buscar empresa...' :
                        searchMode === 'product' ? 'Buscar produto/serviço...' :
                                                   'Buscar segmento...'
                      }
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-10 h-10 border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Buscar por:</span>
                    {SEARCH_MODES.map(mode => (
                      <button
                        key={mode.key}
                        onClick={() => { setSearchMode(mode.key); setSearch(''); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          searchMode === mode.key
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Segmento:</span>
                  {allSegments.map(seg => (
                    <button
                      key={seg}
                      onClick={() => setSegmentFilter(seg)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                        segmentFilter === seg
                          ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {seg}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conteúdo Dinâmico */}
            {activeTab === 'parceiros' && (
              accepted.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white border border-slate-200 rounded-2xl border-dashed">
                  <Building2 className="h-12 w-12 mb-4 text-slate-300" />
                  <p className="font-medium text-slate-600">Nenhum parceiro encontrado.</p>
                  <p className="text-sm mt-1 text-slate-500">Conecte-se com novas empresas para expandir seus negócios.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {accepted.map(p => (
                    <PartnerCard
                      key={p.id} partner={p}
                      onRemove={handleRemove} onAccept={handleAccept} onReject={handleReject} onCancel={handleCancel}
                      highlight={searchMode === 'product' ? search : undefined}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === 'convites_recebidos' && (
              invitesReceived.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white border border-slate-200 rounded-2xl border-dashed">
                  <Mail className="h-12 w-12 mb-4 text-slate-300" />
                  <p className="font-medium text-slate-600">Nenhum convite recebido no momento.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {invitesReceived.map(p => (
                    <PartnerCard
                      key={p.id} partner={p}
                      onRemove={handleRemove} onAccept={handleAccept} onReject={handleReject} onCancel={handleCancel}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === 'convites_enviados' && (
              invitesSent.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white border border-slate-200 rounded-2xl border-dashed">
                  <MailOpen className="h-12 w-12 mb-4 text-slate-300" />
                  <p className="font-medium text-slate-600">Nenhum convite pendente enviado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {invitesSent.map(p => (
                    <PartnerCard
                      key={p.id} partner={p}
                      onRemove={handleRemove} onAccept={handleAccept} onReject={handleReject} onCancel={handleCancel}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === 'historico' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-400 py-32">
                <History className="h-12 w-12 mb-4 text-slate-300" />
                <p className="font-medium text-slate-600">Histórico de Conexões</p>
                <p className="text-sm mt-1 text-slate-500 max-w-sm text-center">Aqui ficará o registro de todas as conexões aceitas, recusadas, expiradas e canceladas da sua organização.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
