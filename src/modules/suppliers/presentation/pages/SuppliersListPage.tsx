import { useState, useMemo, useEffect } from 'react';
import {
  Network, Clock, CheckCircle2, XCircle, MoreVertical,
  Search, MapPin, UserMinus, Building2, Package,
  Phone, Mail, Globe, Star, MessageSquare, FileText
} from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import { useChatDrawer } from '@/modules/messages/presentation/context/ChatDrawerContext';
import { SupabaseSupplierRepository } from '../../infrastructure/repositories/SupabaseSupplierRepository';
import { SupabaseOrganizationConnectionRepository } from '../../infrastructure/repositories/SupabaseOrganizationConnectionRepository';

const supplierRepo = new SupabaseSupplierRepository();
const connectionRepo = new SupabaseOrganizationConnectionRepository();
const tenantId = '00000000-0000-0000-0000-000000000000';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Partner {
  id: string;
  name: string;
  document: string;
  segment: string;
  city: string;
  state: string;
  status: 'accepted' | 'pending_sent' | 'pending_received';
  since?: string;
  connectionId: string;
  // Campos enriquecidos
  phone?: string;
  email?: string;
  website?: string;
  employeesRange: string;
  rating: number;          // 0–5
  responseTime: string;    // ex: "~2h"
  quotationsCount: number; // cotações trocadas
  products: string[];      // produtos/serviços que oferece
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

// Mocks removidos para transição de dados reais.

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GRADIENTS: Record<string, string> = {
  'Manufatura':             'from-indigo-500 to-violet-600',
  'TI & Software':          'from-cyan-500 to-blue-600',
  'Construção Civil':       'from-amber-500 to-orange-600',
  'Transporte & Logística': 'from-emerald-500 to-teal-600',
  'Embalagens':             'from-pink-500 to-rose-600',
};

function getGradient(segment: string) {
  return GRADIENTS[segment] ?? 'from-slate-500 to-slate-700';
}

function StarRating({ value }: { value: number }) {
  if (value === 0) return <span className="text-[11px] text-slate-400">Sem avaliação</span>;
  return (
    <span className="flex items-center gap-1">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      <span className="text-[12px] font-bold text-amber-600">{value.toFixed(1)}</span>
    </span>
  );
}

// ─── PartnerCard ──────────────────────────────────────────────────────────────

function PartnerCard({ partner, onRemove, onAccept, onReject, highlight }: {
  partner: Partner;
  onRemove: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  highlight?: string; // termo buscado, para destacar produtos
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { openChat } = useChatDrawer();

  const initials = partner.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const gradient = getGradient(partner.segment);

  // Destaca produto que bate com a busca
  const matchedProduct = highlight
    ? partner.products.find(p => p.toLowerCase().includes(highlight.toLowerCase()))
    : null;

  return (
    <div className="relative flex flex-col bg-white border border-slate-200 rounded-3xl overflow-hidden hover:border-indigo-200 hover:shadow-lg transition-all duration-200 group">

      {/* Faixa colorida topo */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

      {/* Menu 3 pontos */}
      {partner.status === 'accepted' && (
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                <button
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={() => { setMenuOpen(false); navigate('/quotations/new'); }}
                >
                  <FileText className="h-4 w-4 text-indigo-500" />
                  Solicitar Cotação
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={() => { setMenuOpen(false); openChat(partner.id); }}
                >
                  <MessageSquare className="h-4 w-4 text-indigo-500" />
                  Enviar Mensagem
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  onClick={() => { setMenuOpen(false); onRemove(partner.id); }}
                >
                  <UserMinus className="h-4 w-4" />
                  Remover Parceiro
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Corpo */}
      <div className="flex flex-col px-5 pt-5 pb-3 gap-3 flex-1">

        {/* Avatar + Nome + Segmento */}
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-base shadow-sm flex-shrink-0`}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-slate-900 text-sm leading-tight truncate">{partner.name}</p>
              {partner.status === 'accepted' && (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{partner.segment}</p>
          </div>
        </div>

        {/* Avaliação + Tempo de resposta */}
        {partner.status === 'accepted' && (
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
            <StarRating value={partner.rating} />
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Clock className="h-3 w-3" />
              Responde em <span className="font-semibold text-slate-700 ml-1">{partner.responseTime}</span>
            </div>
          </div>
        )}

        {/* Produto em destaque (quando pesquisado) */}
        {matchedProduct && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-amber-800">Vende: {matchedProduct}</span>
          </div>
        )}

        {/* Produtos/Serviços */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Package className="h-3 w-3" />
            Produtos & Serviços
          </p>
          <div className="flex flex-wrap gap-1">
            {partner.products.slice(0, 3).map(prod => (
              <span
                key={prod}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                  matchedProduct === prod
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {prod}
              </span>
            ))}
            {partner.products.length > 3 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 font-medium">
                +{partner.products.length - 3} mais
              </span>
            )}
          </div>
        </div>

        {/* Contatos */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
            {partner.city}, {partner.state} · {partner.employeesRange} func.
          </div>
          {partner.email && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{partner.email}</span>
            </div>
          )}
          {partner.phone && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
              {partner.phone}
            </div>
          )}
          {partner.website && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Globe className="h-3 w-3 text-slate-400 flex-shrink-0" />
              {partner.website}
            </div>
          )}
        </div>

        {/* Badges de status pendente */}
        {partner.status === 'pending_received' && (
          <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 self-start">
            Aguardando sua resposta
          </Badge>
        )}
        {partner.status === 'pending_sent' && (
          <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 self-start">
            Convite enviado
          </Badge>
        )}
      </div>

      {/* Rodapé */}
      <div className="border-t border-slate-100 px-5 py-3 mt-auto">
        {partner.status === 'accepted' && (
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-400">
              Parceiro desde <span className="font-semibold text-slate-600">{partner.since}</span>
            </p>
            <span className="text-[11px] text-indigo-600 font-semibold">
              {partner.quotationsCount} cotaç{partner.quotationsCount === 1 ? 'ão' : 'ões'}
            </span>
          </div>
        )}
        {partner.status === 'pending_received' && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onAccept(partner.id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs h-8">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Aceitar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onReject(partner.id)} className="flex-1 border-red-300 text-red-600 hover:bg-red-50 text-xs h-8">
              <XCircle className="h-3.5 w-3.5 mr-1" />Recusar
            </Button>
          </div>
        )}
        {partner.status === 'pending_sent' && (
          <p className="text-[11px] text-amber-600 text-center font-medium">Aguardando resposta...</p>
        )}
      </div>
    </div>
  );
}

// ─── SuppliersListPage ────────────────────────────────────────────────────────

type Tab = 'partners' | 'invites';
type InviteFilter = 'all' | 'received' | 'sent';
type SearchMode = 'name' | 'product' | 'segment';

export default function SuppliersListPage() {
  const [activeTab, setActiveTab]       = useState<Tab>('partners');
  const [inviteFilter, setInviteFilter] = useState<InviteFilter>('all');
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
      // Filtro de segmento (sempre aplicado)
      const matchSegment = segmentFilter === 'Todos' || p.segment === segmentFilter;

      // Filtro de busca conforme modo
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
  const invitesAll      = filtered.filter(p => p.status === 'pending_sent' || p.status === 'pending_received');
  const totalInvites    = partners.filter(p => p.status === 'pending_sent' || p.status === 'pending_received').length;
  const totalReceived   = partners.filter(p => p.status === 'pending_received').length;

  const invitesToShow =
    inviteFilter === 'received' ? invitesReceived :
    inviteFilter === 'sent'     ? invitesSent :
    invitesAll;

  const handleRemove = (id: string) => {
    const updated = partners.filter(p => p.id !== id);
    setPartners(updated);
    // Persist to Supabase if needed (omitted for local mock transition logic)
  };
  const handleAccept = (id: string) => {
    const updated = partners.map(p => p.id === id ? { ...p, status: 'accepted' as const, since: new Date().toLocaleDateString('pt-BR') } : p);
    setPartners(updated);
    // Persist to Supabase if needed
  };
  const handleReject = (id: string) => {
    const updated = partners.filter(p => p.id !== id);
    setPartners(updated);
    // Persist to Supabase if needed
  };

  const SEARCH_MODES: { key: SearchMode; label: string }[] = [
    { key: 'name',    label: 'Nome da Empresa' },
    { key: 'product', label: 'Produto / Serviço' },
    { key: 'segment', label: 'Segmento' },
  ];

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">

      {/* HEADER BANNER - Azul Escuro */}
      <div className="bg-slate-900 rounded-[2rem] mx-4 sm:mx-6 mt-6 mb-2 px-6 py-8 shadow-xl">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                Meus Parceiros
              </h1>
              <p className="text-slate-400 mt-1 text-sm max-w-2xl">
                Gerencie seus vínculos de parceria na plataforma.
              </p>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <Button onClick={() => window.location.href = '/suppliers/network'} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 font-bold shadow-md shadow-indigo-900/20">
                <Network className="h-4 w-4 mr-1.5" />
                Rede de Empresas
              </Button>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
              <Input 
                placeholder={
                  searchMode === 'name'    ? 'Ex: Alfa Industrial, Tech Solutions...' :
                  searchMode === 'product' ? 'Ex: Peças Torneadas, Frete, Licenças...' :
                                             'Ex: Manufatura, TI, Logística...'
                }
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12 rounded-xl focus:border-indigo-500 shadow-inner"
              />
            </div>
          </div>
          
          {/* Modos de busca & Filtro de Segmento (dentro do banner) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 mr-1">Buscar por:</span>
              {SEARCH_MODES.map(mode => (
                <button
                  key={mode.key}
                  onClick={() => { setSearchMode(mode.key); setSearch(''); }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    searchMode === mode.key
                      ? 'bg-indigo-500 text-white border-indigo-500'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-indigo-400 hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="hidden sm:block w-px h-5 bg-slate-700"></div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Segmento:</span>
              {allSegments.map(seg => (
                <button
                  key={seg}
                  onClick={() => setSegmentFilter(seg)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                    segmentFilter === seg
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {seg}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">

      {/* Resultado da busca */}
      {search && (
        <p className="text-sm text-slate-500">
          {searchMode === 'product'
            ? `Parceiros que vendem "${search}": `
            : searchMode === 'segment'
            ? `Segmento "${search}": `
            : `Resultados para "${search}": `}
          <span className="font-semibold text-slate-900">{accepted.length + invitesAll.length} encontrado(s)</span>
        </p>
      )}

      {/* ── Tabs ── */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {/* Aba PARCEIROS */}
          <button
            id="tab-partners"
            onClick={() => setActiveTab('partners')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'partners'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            PARCEIROS
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'partners' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
            }`}>{accepted.length}</span>
          </button>

          {/* Aba CONVITES */}
          <button
            id="tab-invites"
            onClick={() => { setActiveTab('invites'); setInviteFilter('all'); }}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'invites'
                ? 'border-violet-500 text-violet-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Mail className="h-4 w-4" />
            CONVITES
            {totalInvites > 0 && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                activeTab === 'invites' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {totalInvites}
              </span>
            )}
            {/* Badge especial para convites recebidos não respondidos */}
            {totalReceived > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white animate-pulse">
                {totalReceived} novo{totalReceived > 1 ? 's' : ''}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* ── Aba: PARCEIROS ── */}
      {activeTab === 'partners' && (
        accepted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Building2 className="h-14 w-14 mb-4 text-slate-200" />
            <p className="font-medium">
              {search ? `Nenhum parceiro encontrado para "${search}"` : 'Nenhum parceiro ainda.'}
            </p>
            {!search && (
              <>
                <p className="text-sm mt-1">Explore a Rede de Empresas para se conectar.</p>
                <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => window.location.href = '/suppliers/network'}>
                  <Network className="mr-2 h-4 w-4" />Explorar REDE DE EMPRESAS
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accepted.map(p => (
              <PartnerCard
                key={p.id} partner={p}
                onRemove={handleRemove} onAccept={handleAccept} onReject={handleReject}
                highlight={searchMode === 'product' ? search : undefined}
              />
            ))}
          </div>
        )
      )}

      {/* ── Aba: CONVITES ── */}
      {activeTab === 'invites' && (
        <div className="space-y-4">

          {/* Sub-filtro Enviados | Recebidos */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {([
              { key: 'all',      label: `Todos (${invitesAll.length})` },
              { key: 'received', label: `Recebidos (${invitesReceived.length})` },
              { key: 'sent',     label: `Enviados (${invitesSent.length})` },
            ] as { key: InviteFilter; label: string }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setInviteFilter(f.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  inviteFilter === f.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Legenda de cores */}
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
              Recebidos — aguardando sua resposta
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />
              Enviados — aguardando resposta deles
            </span>
          </div>

          {/* Cards ou estado vazio */}
          {invitesToShow.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Mail className="h-14 w-14 mb-4 text-slate-200" />
              <p className="font-medium">
                {inviteFilter === 'received' ? 'Nenhum convite recebido.' :
                 inviteFilter === 'sent'     ? 'Nenhum convite enviado.' :
                                              'Nenhum convite pendente.'}
              </p>
              {inviteFilter !== 'received' && (
                <p className="text-sm mt-1">Explore a Rede de Empresas para se conectar.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {invitesToShow.map(p => (
                <div
                  key={p.id}
                  className={`rounded-3xl ring-2 ${
                    p.status === 'pending_received'
                      ? 'ring-blue-200'
                      : 'ring-amber-200'
                  }`}
                >
                  <PartnerCard
                    partner={p}
                    onRemove={handleRemove}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    highlight={searchMode === 'product' ? search : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      </div>
      </div>
    </div>
  );
}
