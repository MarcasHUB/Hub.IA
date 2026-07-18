import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';
import { Search, Plus, Send, Inbox, FileText, Globe, Calendar, Building2, PackageOpen, Users } from 'lucide-react';
import { QuotationTypeModal } from '../components/QuotationTypeModal';

interface Proposal {
  supplierName: string;
  price: number;
  deliveryDays: number;
}

interface Quotation {
  id: string;
  title: string;
  type: 'BID' | 'DIRECT' | 'INTERNAL';
  itemsCount: number;
  status: 'Open' | 'Closed' | 'Draft' | 'Cancelled';
  date: string;
  targetSupplierName?: string;
  proposals: Proposal[];
}

export default function QuotationsListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'sent' | 'received' | 'drafts' | 'internal_requests'>('sent');
  const [search, setSearch] = useState('');
  
  // Mocks simplificados para a transição
  const [sentQuotations] = useState<Quotation[]>(() => {
    const saved = localStorage.getItem('supplyhub_quotations');
    return saved ? JSON.parse(saved).filter((q: any) => q.status !== 'Draft') : [];
  });
  
  const [draftQuotations] = useState<Quotation[]>(() => {
    const saved = localStorage.getItem('supplyhub_quotations');
    return saved ? JSON.parse(saved).filter((q: any) => q.status === 'Draft') : [];
  });

  const receivedQuotations: any[] = [];
  const internalRequestsQuotations: any[] = [
    {
      id: 'REQ-2026',
      title: 'Monitores Dell 24"',
      type: 'INTERNAL',
      itemsCount: 2,
      status: 'Open',
      date: new Date().toLocaleDateString('pt-BR'),
      requester: 'João Silva',
      proposals: [],
      selectedProducts: [
        { name: 'Monitor Dell 24" P2422H', sku: 'DELL-P2422H' },
        { name: 'Cabo HDMI 2m', sku: 'CAB-HDMI-2M' }
      ]
    }
  ];

  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  const filteredItems = useMemo(() => {
    let source = sentQuotations;
    if (activeTab === 'received') source = receivedQuotations;
    if (activeTab === 'drafts') source = draftQuotations;
    if (activeTab === 'internal_requests') source = internalRequestsQuotations;

    if (!search) return source;
    const s = search.toLowerCase();
    return source.filter(q => {
      const matchesId = q.id?.toLowerCase().includes(s);
      const matchesTitle = q.title?.toLowerCase().includes(s);
      const matchesRequester = (q as any).requester?.toLowerCase().includes(s);
      const matchesSupplier = q.targetSupplierName?.toLowerCase().includes(s);
      const matchesProducts = (q as any).selectedProducts?.some((p: any) =>
        p.name?.toLowerCase().includes(s) ||
        p.sku?.toLowerCase().includes(s) ||
        p.partNumber?.toLowerCase().includes(s)
      );

      return matchesId || matchesTitle || matchesRequester || matchesSupplier || matchesProducts;
    });
  }, [activeTab, search, sentQuotations, receivedQuotations, draftQuotations]);

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      
      {/* HEADER BANNER - Azul Escuro */}
      <div className="bg-slate-900 rounded-2xl mx-6 mt-6 mb-4 px-8 pt-8 pb-0 shadow-md overflow-hidden">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                Cotações
              </h1>
              <p className="text-slate-400 mt-1 text-sm max-w-2xl">
                Gerencie solicitações de compra e orçamentos da rede B2B.
              </p>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <Button onClick={() => setIsQuoteModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 font-bold shadow-md shadow-indigo-900/20">
                <Plus className="h-4 w-4 mr-1.5" />
                Nova Cotação
              </Button>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
              <ClearableInput 
                placeholder="Busque por ID (ex: RC-2026), SKU, Material ou Solicitante..." 
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                className="pl-11 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-11 rounded-xl focus:border-indigo-500"
              />
            </div>
          </div>

          {/* ABAS */}
          <div className="flex items-center gap-6 mt-4">
            <button 
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'sent' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <Send className="h-4 w-4" /> Enviadas
            </button>
            <button 
              onClick={() => setActiveTab('received')}
              className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'received' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <Inbox className="h-4 w-4" /> Recebidas
            </button>
            <button 
              onClick={() => setActiveTab('drafts')}
              className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'drafts' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <FileText className="h-4 w-4" /> Rascunhos
            </button>
            <button 
              onClick={() => setActiveTab('internal_requests')}
              className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-colors relative ${activeTab === 'internal_requests' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <div className="relative">
                <Users className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              </div>
              Solicitações Internas
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1600px] mx-auto">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 bg-indigo-50 rounded-3xl flex items-center justify-center mb-4 border border-indigo-100">
                <PackageOpen className="h-8 w-8 text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {activeTab === 'sent' && 'Você ainda não enviou cotações.'}
                {activeTab === 'received' && 'Não há cotações recebidas.'}
                {activeTab === 'drafts' && 'Não há rascunhos salvos.'}
                {activeTab === 'internal_requests' && 'Não há solicitações internas.'}
              </h3>
              <p className="text-sm text-slate-500 mt-2 max-w-sm">
                {activeTab === 'internal_requests' 
                  ? 'Você não possui solicitações de compra pendentes ou em andamento.' 
                  : 'Você não possui parceiros ativos ou não iniciou nenhuma solicitação. Retorne à rede de empresas e conecte-se a empresas do segmento.'
                }
              </p>
              {activeTab !== 'internal_requests' && (
                <Button onClick={() => navigate('/suppliers/network')} className="mt-6 bg-slate-900 hover:bg-slate-800 text-white font-bold h-10 px-6 shadow-sm">
                  <Globe className="h-4 w-4 mr-2" /> Explorar Rede Hub.IA
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map(item => {
                const materialsList = (item as any).selectedProducts && (item as any).selectedProducts.length > 0
                  ? (item as any).selectedProducts.map((p: any) => {
                      const qty = (item as any).productQuantities?.[p.id] || '1';
                      return `${qty}x ${p.name}`;
                    })
                  : item.title.split(',').map(s => s.trim());

                return (
                  <div key={item.id} className="bg-white border border-slate-200 hover:border-slate-350 rounded-3xl p-5 shadow-sm transition-all group flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0">
                          <button
                            onClick={() => navigate(item.status === 'Draft' ? `/quotations/new` : `/quotations/${item.id}/compare`)}
                            className="font-extrabold text-slate-900 text-lg hover:text-indigo-600 hover:underline transition-colors text-left focus:outline-none truncate block w-full"
                          >
                            {item.id}
                          </button>
                          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                            {item.itemsCount} {item.itemsCount === 1 ? 'material' : 'materiais'} · Solicitante: {(item as any).requester || 'Comprador B2B'}
                          </p>
                        </div>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                          item.status === 'Open' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          item.status === 'Closed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {item.status === 'Open' ? 'Pendente' : item.status === 'Closed' ? 'Finalizada' : 'Rascunho'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 mt-4 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400" />
                          <span className="font-semibold text-slate-500">
                            {item.type === 'INTERNAL' ? 'Solicitação Interna' : item.type === 'BID' ? 'Cotação a Mercado (BID)' : 'Cotação Direcionada'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span>Criação: {item.date}</span>
                          {(item as any).deliveryDate && (
                            <span className="text-slate-400">· Remessa: {(item as any).deliveryDate}</span>
                          )}
                        </div>

                        {/* Resumo de Itens */}
                        <div className="border-t border-slate-100 pt-2.5 mt-2">
                          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Resumo de Itens</p>
                          <ul className="text-xs text-slate-500 space-y-1 mt-1.5 list-disc list-inside">
                            {materialsList.slice(0, 3).map((mat: string, idx: number) => (
                              <li key={idx} className="truncate">{mat}</li>
                            ))}
                            {materialsList.length > 3 && (
                              <li className="text-indigo-600 font-bold list-none pl-4 text-[10px] mt-0.5">
                                +{materialsList.length - 3} itens
                              </li>
                            )}
                          </ul>
                        </div>

                        {/* Fornecedor se Direcionada */}
                        {item.type === 'DIRECT' && item.targetSupplierName && (
                          <div className="flex items-center gap-2 text-indigo-650 border-t border-slate-100 pt-2 mt-1">
                            <Building2 className="h-4 w-4 text-indigo-500" />
                            <span className="font-bold">Fornecedor: {item.targetSupplierName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                      <Button onClick={() => navigate(item.status === 'Draft' ? `/quotations/new` : `/quotations/${item.id}/compare`)} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-10">
                        {item.status === 'Draft' ? 'Continuar' : 'Ver Detalhes'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <QuotationTypeModal 
        isOpen={isQuoteModalOpen} 
        onClose={() => setIsQuoteModalOpen(false)} 
        productNames="Nenhum item selecionado" 
        selectedProductIds={[]}
      />
    </div>
  );
}
