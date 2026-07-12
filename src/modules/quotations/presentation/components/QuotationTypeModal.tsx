import { useState, useEffect } from 'react';
import { X, Globe, Building2, Package, Search, AlertCircle, ArrowRight, ArrowLeft, Check, Trash2, FileText } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';

interface Partner {
  id: string;
  name: string;
  products: string[];
}

// Carrega parceiros e produtos do localStorage de forma dinâmica e reativa
const getConnectedPartners = (): Partner[] => {
  const saved = localStorage.getItem('supplyhub_partners');
  const list = saved ? JSON.parse(saved) : [];
  return list.map((p: any) => ({
    id: p.id,
    name: p.name,
    products: p.products || [p.segment]
  }));
};

interface CatalogProduct {
  id: string;
  name: string;
  sku: string;
  supplier: string;
  category: string;
  manufacturer: string;
  price: number;
  measures?: string;
}

const getCatalogProducts = (): CatalogProduct[] => {
  const saved = localStorage.getItem('supplyhub_products');
  const list = saved ? JSON.parse(saved) : [];
  return list.map((p: any) => ({
    id: p.id,
    name: p.name,
    sku: p.sku || `PROD-${p.id}`,
    supplier: p.supplierName || 'Fornecedor Geral',
    category: p.category || 'Geral',
    manufacturer: p.manufacturer || 'Outros',
    price: p.price || 0,
    measures: p.unit || 'unidade'
  }));
};

interface QuotationTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: {
    type: 'BID' | 'DIRECT';
    code: string;
    productName: string;
    partnerId?: string;
    quantity: number;
    deliveryDate: string;
    requester: string;
    manufacturerCode: string;
    materialInfo: string;
    additionalDesc: string;
    paymentTerm: string;
    isDraft?: boolean;
    draftId?: string;
  }) => void;
  defaultPartnerId?: string;
  productNames?: string;
  prefilledProductName?: string;
  preselectedProductIds?: string[];
  selectedProductIds?: string[];
  initialDraftData?: any; // Rascunho para continuar preenchendo
}

export function QuotationTypeModal({
  isOpen,
  onClose,
  onSubmit,
  defaultPartnerId,
  prefilledProductName,
  preselectedProductIds,
  initialDraftData
}: QuotationTypeModalProps) {
  const CONNECTED_PARTNERS = getConnectedPartners();
  const CATALOG_PRODUCTS = getCatalogProducts();

  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<'BID' | 'DIRECT'>('BID');
  const [selectedPartnerId, setSelectedPartnerId] = useState(defaultPartnerId || '');
  const [validationMsg, setValidationMsg] = useState<'ok' | 'no_partners' | null>(null);

  // Lista de produtos na cotação
  const [selectedProducts, setSelectedProducts] = useState<CatalogProduct[]>([]);

  // Pesquisa local
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Quantidades e Fabricantes individuais por item
  const [productQuantities, setProductQuantities] = useState<Record<string, string>>({});
  const [productMfgCodes, setProductMfgCodes] = useState<Record<string, string>>({});

  // Campos globais
  const [deliveryDate, setDeliveryDate] = useState('');
  const [requester, setRequester] = useState('');
  const [additionalDesc, setAdditionalDesc] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('30 dias');

  // Inicializa a partir de props ou rascunho
  useEffect(() => {
    if (isOpen) {
      if (initialDraftData) {
        // Carrega dados de rascunho
        setStep(initialDraftData.step || 1);
        setType(initialDraftData.type || 'BID');
        setSelectedPartnerId(initialDraftData.selectedPartnerId || '');
        setSelectedProducts(initialDraftData.selectedProducts || []);
        setProductQuantities(initialDraftData.productQuantities || {});
        setProductMfgCodes(initialDraftData.productMfgCodes || {});
        setDeliveryDate(initialDraftData.deliveryDate || '');
        setRequester(initialDraftData.requester || '');
        setAdditionalDesc(initialDraftData.additionalDesc || '');
        setPaymentTerm(initialDraftData.paymentTerm || '30 dias');
      } else if (preselectedProductIds && preselectedProductIds.length > 0) {
        const found = CATALOG_PRODUCTS.filter(p => preselectedProductIds.includes(p.id));
        setSelectedProducts(found);
        // Inicializa as quantidades como '1'
        const qMap: Record<string, string> = {};
        const pMap: Record<string, string> = {};
        found.forEach(p => {
          qMap[p.id] = '1';
          pMap[p.id] = p.sku;
        });
        setProductQuantities(qMap);
        setProductMfgCodes(pMap);
        setStep(1);
      } else if (prefilledProductName) {
        const names = prefilledProductName.split(',').map(n => n.trim().toLowerCase());
        const found = CATALOG_PRODUCTS.filter(p => names.includes(p.name.toLowerCase()));
        if (found.length > 0) {
          setSelectedProducts(found);
          const qMap: Record<string, string> = {};
          const pMap: Record<string, string> = {};
          found.forEach(p => {
            qMap[p.id] = '1';
            pMap[p.id] = p.sku;
          });
          setProductQuantities(qMap);
          setProductMfgCodes(pMap);
        } else {
          setSelectedProducts([{
            id: 'temp-1',
            name: prefilledProductName,
            sku: 'TEMP-SKU',
            supplier: 'Geral',
            category: 'Geral',
            manufacturer: 'Generico',
            price: 10.00
          }]);
          setProductQuantities({ 'temp-1': '1' });
          setProductMfgCodes({ 'temp-1': 'TEMP-SKU' });
        }
        setStep(1);
      } else {
        setSelectedProducts([]);
        setProductQuantities({});
        setProductMfgCodes({});
        setDeliveryDate('');
        setRequester('');
        setAdditionalDesc('');
        setPaymentTerm('30 dias');
        setStep(1);
      }
      setValidationMsg(null);
    }
  }, [isOpen, preselectedProductIds, prefilledProductName, initialDraftData]);

  if (!isOpen) return null;

  // Filtro de pesquisa de catálogo
  const filteredCatalog = CATALOG_PRODUCTS.filter(p => {
    if (!searchQuery) return false;
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      p.manufacturer.toLowerCase().includes(query)
    );
  });

  const handleAddProduct = (prod: CatalogProduct) => {
    if (!selectedProducts.find(p => p.id === prod.id)) {
      setSelectedProducts([...selectedProducts, prod]);
      setProductQuantities(prev => ({ ...prev, [prod.id]: '1' }));
      setProductMfgCodes(prev => ({ ...prev, [prod.id]: prod.sku }));
    }
    setSearchQuery('');
    setIsDropdownOpen(false);
    setValidationMsg(null);
  };

  const handleRemoveProduct = (id: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== id));
    setValidationMsg(null);
  };

  const handleValidateBID = () => {
    if (selectedProducts.length === 0) return;
    const query = selectedProducts[0].name.toLowerCase();
    const hasSupplier = CONNECTED_PARTNERS.some(partner =>
      partner.products.some(prod => prod.toLowerCase().includes(query))
    );

    if (hasSupplier) {
      setValidationMsg('ok');
    } else {
      setValidationMsg('no_partners');
    }
  };

  // Salvar Rascunho Automaticamente no Fechamento se houver dados
  const handleCloseAndSaveDraft = () => {
    const hasData = selectedProducts.length > 0 || requester.trim() || additionalDesc.trim();
    if (hasData) {
      const existingDraftsJson = localStorage.getItem('supplyhub_drafts');
      let drafts: any[] = existingDraftsJson ? JSON.parse(existingDraftsJson) : [];

      // Se for atualização de um rascunho existente
      if (initialDraftData?.id) {
        drafts = drafts.filter(d => d.id !== initialDraftData.id);
      }

      const newDraft = {
        id: initialDraftData?.id || `draft-${Date.now()}`,
        date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type,
        selectedPartnerId,
        selectedProducts,
        productQuantities,
        productMfgCodes,
        deliveryDate,
        requester,
        additionalDesc,
        paymentTerm,
        step
      };

      drafts.unshift(newDraft); // Insere no topo
      localStorage.setItem('supplyhub_drafts', JSON.stringify(drafts));
    }
    onClose();
  };

  const handleConfirm = () => {
    if (selectedProducts.length === 0) return;
    if (type === 'DIRECT' && !selectedPartnerId) return;

    // Formata o nome do produto concatenando as quantidades no título da cotação
    const combinedNames = selectedProducts
      .map(p => `${productQuantities[p.id] || '1'}x ${p.name}`)
      .join(', ');

    // Fabricantes e Part Numbers combinados para informações do material
    const combinedMfgCodes = selectedProducts
      .map(p => `${p.name}: ${productMfgCodes[p.id] || p.sku}`)
      .join(' | ');

    const combinedInfo = selectedProducts
      .map(p => `${p.manufacturer} (${p.measures || 'N/A'})`)
      .join(' / ');

    const totalQuantity = selectedProducts.reduce((sum, p) => sum + (Number(productQuantities[p.id]) || 1), 0);

    const randomNum = Math.floor(Math.random() * 90000) + 10000;
    const code = type === 'BID' ? `RC-2026-${randomNum}` : `RCD-2026-${randomNum}`;

    onSubmit?.({
      type,
      code,
      productName: combinedNames,
      partnerId: type === 'DIRECT' ? selectedPartnerId : undefined,
      quantity: totalQuantity,
      deliveryDate,
      requester,
      manufacturerCode: combinedMfgCodes,
      materialInfo: combinedInfo,
      additionalDesc,
      paymentTerm,
      isDraft: !!initialDraftData,
      draftId: initialDraftData?.id
    });

    // Se salvamos a cotação finalizada com sucesso, removemos o rascunho correspondente
    if (initialDraftData?.id) {
      const existingDraftsJson = localStorage.getItem('supplyhub_drafts');
      if (existingDraftsJson) {
        let drafts: any[] = JSON.parse(existingDraftsJson);
        drafts = drafts.filter(d => d.id !== initialDraftData.id);
        localStorage.setItem('supplyhub_drafts', JSON.stringify(drafts));
      }
    }

    // Reset local
    setStep(1);
    setSelectedProducts([]);
    setProductQuantities({});
    setProductMfgCodes({});
    setDeliveryDate('');
    setRequester('');
    setAdditionalDesc('');
    setPaymentTerm('30 dias');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 bg-indigo-50/20">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <FileText className="h-4.5 w-4.5 text-indigo-650" />
              {initialDraftData ? 'Editar Rascunho de Cotação' : 'Configurar Nova Cotação'}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Etapa {step} de 2 · {initialDraftData ? 'Editando Rascunho' : 'Novo Envio'}</p>
          </div>
          <button onClick={handleCloseAndSaveDraft} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors" title="Fechar e Salvar Rascunho">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Passo 1 */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            {/* Itens na Cotação */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Itens da Cotação *</label>
              
              {selectedProducts.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-150 p-2 rounded-xl bg-slate-50">
                  {selectedProducts.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-sm">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          Código/SKU: {p.sku} | Fab: {p.manufacturer}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(p.id)}
                        className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full shrink-0 ml-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center bg-slate-50/50">
                  <Package className="h-7 w-7 text-slate-350 mx-auto mb-1.5" />
                  <p className="text-xs text-slate-500 font-medium">Nenhum produto selecionado.</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Use o campo de busca abaixo para adicionar itens.</p>
                </div>
              )}
            </div>

            {/* Pesquisa e Filtro */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Pesquisar produto no catálogo</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Pesquise por nome, código/SKU ou fabricante..."
                  className="pl-9 h-10 text-sm border-slate-300 focus-visible:ring-indigo-500"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setIsDropdownOpen(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-455 hover:text-slate-700"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {isDropdownOpen && searchQuery && (
                <div className="absolute top-16 left-0 right-0 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50 divide-y divide-slate-100">
                  {filteredCatalog.length > 0 ? (
                    filteredCatalog.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProduct(p)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50/50 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-455 mt-0.5 font-mono">
                            SKU: {p.sku} | Categoria: {p.category}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded">
                            {p.manufacturer}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-1 font-bold">R$ {p.price.toFixed(2)}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-slate-400" />
                      Nenhum produto com código encontrado no catálogo.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tipo */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={() => { setType('BID'); setValidationMsg(null); }}
                className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all gap-2 ${
                  type === 'BID' ? 'border-indigo-600 bg-indigo-50/40 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <Globe className={`h-5 w-5 ${type === 'BID' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div>
                  <p className="text-xs font-bold text-slate-900">Cotação a Mercado (BID)</p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                    Busca parceiros e envia automaticamente.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setType('DIRECT'); setValidationMsg(null); }}
                className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all gap-2 ${
                  type === 'DIRECT' ? 'border-indigo-600 bg-indigo-50/40 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <Building2 className={`h-5 w-5 ${type === 'DIRECT' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div>
                  <p className="text-xs font-bold text-slate-900">Cotação Direcionada</p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                    Envia para um fornecedor parceiro específico.
                  </p>
                </div>
              </button>
            </div>

            {/* Validação */}
            {type === 'BID' && selectedProducts.length > 0 && (
              <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Verificação de Parceiros:</span>
                  {!validationMsg && (
                    <Button size="sm" onClick={handleValidateBID} className="bg-indigo-600 text-white h-7 text-[11px]">
                      <Search className="h-3 w-3 mr-1" /> Verificar Parceiros
                    </Button>
                  )}
                </div>

                {validationMsg === 'ok' && (
                  <div className="flex items-start gap-2 text-green-700 bg-green-50 rounded-lg p-2.5 border border-green-200">
                    <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
                    <p className="text-[11px] leading-relaxed font-bold">
                      Parceiros Encontrados! Temos parceiros aptos para fornecer este material.
                    </p>
                  </div>
                )}

                {validationMsg === 'no_partners' && (
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2 text-amber-800 bg-amber-50 rounded-lg p-2.5 border border-amber-200">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] leading-relaxed">
                        <strong>Aviso:</strong> Seus parceiros conectados não possuem este produto.
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        handleCloseAndSaveDraft();
                        window.location.href = `/suppliers/network?q=${encodeURIComponent(selectedProducts[0].name)}`;
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs h-9 flex items-center justify-center gap-1"
                    >
                      Buscar na REDE DE EMPRESAS <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {type === 'DIRECT' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selecione o Fornecedor Parceiro</label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Escolher parceiro...</option>
                  {CONNECTED_PARTNERS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Passo 2: Detalhes dos Itens Selecionados com Quantidades Individuais */}
        {step === 2 && (
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Lista com o resumo dos produtos com o campo para selecionar as quantidades individuais */}
            <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider flex items-center gap-1">
                <Package className="h-3.5 w-3.5 text-indigo-650 shrink-0" /> Resumo dos Produtos Selecionados
              </span>
              
              <div className="space-y-2 mt-2">
                {selectedProducts.map(p => (
                  <div key={p.id} className="grid grid-cols-12 gap-3 items-center bg-white border border-slate-250 p-3 rounded-xl shadow-sm">
                    <div className="col-span-6 min-w-0">
                      <p className="font-bold text-xs text-slate-800 truncate" title={p.name}>{p.name}</p>
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">SKU: {p.sku} | Fab: {p.manufacturer}</p>
                    </div>
                    
                    <div className="col-span-3">
                      <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Qtd *</label>
                      <Input
                        type="number"
                        min="1"
                        value={productQuantities[p.id] || '1'}
                        onChange={e => setProductQuantities({ ...productQuantities, [p.id]: e.target.value })}
                        className="h-8 text-xs text-center border-slate-300 font-bold focus-visible:ring-indigo-500"
                        required
                      />
                    </div>
                    
                    <div className="col-span-3">
                      <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">Fab/Code *</label>
                      <Input
                        type="text"
                        value={productMfgCodes[p.id] || p.sku}
                        onChange={e => setProductMfgCodes({ ...productMfgCodes, [p.id]: e.target.value })}
                        className="h-8 text-[10px] font-mono border-slate-300 focus-visible:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data da remessa e Solicitante global */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data da Remessa *</label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  className="h-9 text-sm border-slate-300"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Solicitante *</label>
                <Input
                  type="text"
                  placeholder="Seu Nome / Setor"
                  value={requester}
                  onChange={e => setRequester(e.target.value)}
                  className="h-9 text-sm border-slate-300"
                  required
                />
              </div>
            </div>

            {/* Prazo de Pagamento solicitado */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Prazo de Pagamento Solicitado *</label>
              <select
                value={paymentTerm}
                onChange={e => setPaymentTerm(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="21 dias">21 dias (Faturamento)</option>
                <option value="30 dias">30 dias (Faturamento)</option>
                <option value="60 dias">60 dias (Faturamento)</option>
              </select>
            </div>

            {/* Descrição adicional */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Descrição Adicional</label>
              <textarea
                placeholder="Insira detalhes adicionais sobre o frete, embalagem ou requisitos específicos..."
                value={additionalDesc}
                onChange={e => setAdditionalDesc(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 h-16 resize-none"
              />
            </div>
          </div>
        )}

        {/* Rodapé Dinâmico */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between gap-2 shrink-0">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleCloseAndSaveDraft} className="h-9 text-xs">Salvar como Rascunho & Fechar</Button>
              <Button
                type="button"
                onClick={() => setStep(2)}
                disabled={selectedProducts.length === 0 || (type === 'DIRECT' && !selectedPartnerId)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-semibold"
              >
                Avançar: Quantidades e Detalhes <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                type="button"
                onClick={() => setStep(1)}
                className="h-9 text-xs flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!deliveryDate || !requester || selectedProducts.some(p => !(productQuantities[p.id]?.trim()) || !(productMfgCodes[p.id]?.trim()))}
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-semibold"
              >
                {initialDraftData ? 'Salvar Alterações e Criar' : 'Confirmar e Criar Cotação'}
              </Button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
