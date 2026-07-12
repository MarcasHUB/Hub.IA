import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Search, Plus, Send, Inbox, FileText, Globe, Calendar, Building2, PackageOpen } from 'lucide-react';
import { QuotationTypeModal } from '../components/QuotationTypeModal';

interface Proposal {
  supplierName: string;
  price: number;
  deliveryDays: number;
}

interface Quotation {
  id: string;
  title: string;
  type: 'BID' | 'DIRECT';
  itemsCount: number;
  status: 'Open' | 'Closed' | 'Draft' | 'Cancelled';
  date: string;
  targetSupplierName?: string;
  proposals: Proposal[];
}

export default function QuotationsListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'sent' | 'received' | 'drafts'>('sent');
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

  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  const filteredItems = useMemo(() => {
    let source = sentQuotations;
    if (activeTab === 'received') source = receivedQuotations;
    if (activeTab === 'drafts') source = draftQuotations;

    if (!search) return source;
    const s = search.toLowerCase();
    return source.filter(q => 
      q.id.toLowerCase().includes(s) || 
      q.title.toLowerCase().includes(s)
    );
  }, [activeTab, search, sentQuotations, receivedQuotations, draftQuotations]);

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      
      {/* HEADER BANNER - Azul Escuro */}
      <div className="bg-slate-900 rounded-[2rem] mx-4 sm:mx-6 mt-6 mb-4 px-6 pt-8 pb-0 shadow-xl overflow-hidden">
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
              <Input 
                placeholder="Busque por ID (ex: RC-2026) ou Título..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12 rounded-xl focus:border-indigo-500 shadow-inner"
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
              </h3>
              <p className="text-sm text-slate-500 mt-2 max-w-sm">
                Você não possui parceiros ativos ou não iniciou nenhuma solicitação. Retorne à rede de empresas e conecte-se a empresas do segmento.
              </p>
              <Button onClick={() => navigate('/suppliers/network')} className="mt-6 bg-slate-900 hover:bg-slate-800 text-white font-bold h-10 px-6 shadow-sm">
                <Globe className="h-4 w-4 mr-2" /> Explorar Rede Hub.IA
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map(item => (
                <div key={item.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-3xl p-5 shadow-sm transition-all group">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg leading-tight">{item.title}</h4>
                      <p className="text-xs font-bold text-slate-400 mt-1">{item.id}</p>
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      item.status === 'Open' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      item.status === 'Closed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {item.status === 'Open' ? 'Pendente' : item.status === 'Closed' ? 'Finalizada' : 'Rascunho'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mt-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span>{item.itemsCount} {item.itemsCount === 1 ? 'item' : 'itens'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>{item.date}</span>
                    </div>
                    {item.type === 'DIRECT' && item.targetSupplierName && (
                      <div className="flex items-center gap-2 text-indigo-600">
                        <Building2 className="h-4 w-4" />
                        <span className="font-semibold">{item.targetSupplierName}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                    <Button onClick={() => navigate(item.status === 'Draft' ? `/quotations/new` : `/quotations/${item.id}/compare`)} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-10">
                      {item.status === 'Draft' ? 'Continuar' : 'Ver Detalhes'}
                    </Button>
                  </div>
                </div>
              ))}
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
