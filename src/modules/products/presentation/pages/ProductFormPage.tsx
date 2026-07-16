import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { 
  Package, 
  Tags, 
  Briefcase, 
  Truck, 
  Users, 
  FileText, 
  History,
  Image as ImageIcon,
  Save,
  ArrowLeft,
  Plus,
  Trash2
} from 'lucide-react';

import { SupabaseProductRepository } from '../../infrastructure/repositories/SupabaseProductRepository';
import { SupabaseProductSupplierRepository } from '../../infrastructure/repositories/SupabaseProductSupplierRepository';
import { SupabaseSegmentRepository } from '../../../employees/infrastructure/repositories/SupabaseSegmentRepository';
import { Product, ProductStatus } from '../../domain/entities/Product'; 
import { LinkSupplierModal } from '../components/LinkSupplierModal';

const repo = new SupabaseProductRepository();
const productSupplierRepo = new SupabaseProductSupplierRepository();
const segmentRepo = new SupabaseSegmentRepository();
const tenantId = '00000000-0000-0000-0000-000000000000'; // Mocked tenant ID

export default function ProductFormPage({
  productId,
  onClose,
  onSaveSuccess
}: {
  productId?: string;
  onClose?: () => void;
  onSaveSuccess?: () => void;
} = {}) {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const id = productId || routeId;
  const isEditing = Boolean(id);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState('basic');

  // Aggregates State
  const [basicInfo, setBasicInfo] = useState({
    name: '', sku: '', manufacturer: '', description: '', status: 'Active', imageUrl: '', manufacturerCode: '', availableForPurchase: true, availableForSale: false
  });
  const [classification, setClassification] = useState({
    category: '', subcategory: '', purchasingGroup: '', ncm: '', baseUom: ''
  });
  const [commercial, setCommercial] = useState({
    costCenter: '', targetPrice: '', moq: '', multiple: ''
  });
  const [logistics, setLogistics] = useState({
    grossWeight: '', netWeight: '', width: '', height: '', length: '', leadTime: '', storage: ''
  });
  
  // N:N relationships
  const [suppliers, setSuppliers] = useState<{id: string, name: string, document: string}[]>([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Generate a local preview URL
      const objectUrl = URL.createObjectURL(file);
      setBasicInfo(prev => ({ ...prev, imageUrl: objectUrl }));
    }
  };

  // Semelhantes / IA Search
  const [similarProduct, setSimilarProduct] = useState<Product | null>(null);
  const [isSimilarModalOpen, setIsSimilarModalOpen] = useState(false);

  // Segmentos
  const [availableSegments, setAvailableSegments] = useState<{id: string, nome: string}[]>([]);

  // Debounce search on manufacturerCode
  useEffect(() => {
    if (isEditing || !basicInfo.manufacturerCode || basicInfo.manufacturerCode.length < 3) return;

    const timer = setTimeout(async () => {
      try {
        const products = await repo.findAll(tenantId);
        // Busca determinística por Código do Fabricante ou Nome
        const match = products.find(p => 
          p.manufacturerCode === basicInfo.manufacturerCode ||
          p.name.toLowerCase() === basicInfo.name.toLowerCase()
        );
        
        if (match && match.id !== id) {
          setSimilarProduct(match);
          setIsSimilarModalOpen(true);
        }
      } catch(e) {
        console.error(e);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [basicInfo.manufacturerCode, basicInfo.name, isEditing, id]);

  // Load existing data if editing
  useEffect(() => {
    async function loadData() {
      try {
        const segs = await segmentRepo.listSegments(tenantId);
        setAvailableSegments(segs.filter(s => s.status === 'ativo').map(s => ({id: s.id, nome: s.nome})));
      } catch(e) {
        console.error("Failed to load segments", e);
      }

      if (isEditing && id) {
        try {
          const product = await repo.findById(id, tenantId);
          if (product) {
            setBasicInfo(prev => ({
              ...prev,
              name: product.name || '',
              sku: product.sku || '',
              manufacturer: product.manufacturer || '',
              manufacturerCode: product.manufacturerCode || '',
              description: product.description || '',
              imageUrl: product.imageUrl || '',
              availableForPurchase: product.availableForPurchase ?? true,
              availableForSale: product.availableForSale ?? false,
              status: product.status === ProductStatus.DRAFT ? 'Draft' : 'Active'
            }));
            setClassification(prev => ({
              ...prev,
              category: product.categoryName || product.categoryId || '',
              baseUom: product.uom || ''
            }));
            setCommercial(prev => ({
              ...prev,
              targetPrice: product.price?.toString() || ''
            }));
            
            // Mocked supplier mapping
            if (product.supplierId) {
               setSuppliers([{ id: '', name: 'Fornecedor', document: '' }]);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    loadData();
  }, [id, isEditing]);

  const handleSave = async () => {
    // Basic validation
    if (!basicInfo.name.trim() || !basicInfo.sku.trim()) {
      alert("Nome e SKU são obrigatórios");
      return;
    }

    try {
      const newProduct = new Product(
        isEditing && id ? id : crypto.randomUUID(),
        tenantId,
        suppliers.length > 0 ? 'supplier-id' : 'mocked-supplier-id', // supplierId
        classification.category || 'mocked-category-id', // categoryId
        basicInfo.name,
        basicInfo.description,
        basicInfo.sku,
        classification.baseUom || 'UN',
        basicInfo.manufacturer,
        Number(commercial.targetPrice) || 0,
        basicInfo.status === 'Draft' ? ProductStatus.DRAFT : ProductStatus.ACTIVE,
        new Date(),
        new Date(),
        undefined, // categoryName (not needed for save)
        basicInfo.manufacturerCode,
        basicInfo.availableForPurchase,
        basicInfo.availableForSale,
        basicInfo.imageUrl
      );

      await repo.save(newProduct);

      // Salvar os fornecedores se houver vinculados e o ID já existir
      // Se era um novo produto (não isEditing), o newProduct.id foi gerado e salvo
      if (suppliers.length > 0) {
         const supplierIds = suppliers.map(s => s.id);
         await productSupplierRepo.linkSuppliers(newProduct.id, supplierIds);
      }

      if (onSaveSuccess) {
        onSaveSuccess();
      } else {
        navigate('/products');
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar produto");
    }
  };

  const tabs = [
    { id: 'basic', label: 'Informações Básicas', icon: Package },
    { id: 'classification', label: 'Classificação', icon: Tags },
    { id: 'commercial', label: 'Comercial', icon: Briefcase },
    { id: 'logistics', label: 'Logística', icon: Truck },
    { id: 'suppliers', label: 'Fornecedores', icon: Users },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'history', label: 'Histórico', icon: History },
  ];

  return (
    <div className={`flex-1 flex flex-col font-sans ${onClose ? '' : 'bg-slate-50 min-h-full'}`}>
      {!onClose && (
        <div className="bg-slate-900 rounded-[2rem] mx-4 sm:mx-6 mt-6 mb-4 px-6 pt-8 pb-8 shadow-xl">
          <div className="max-w-[1600px] mx-auto">
            <button 
              onClick={() => navigate('/products')}
              className="flex items-center text-slate-400 hover:text-white transition-colors text-sm font-medium mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para Catálogo
            </button>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                  {isEditing ? 'Detalhes do Produto' : 'Novo Produto'}
                </h1>
                <p className="text-slate-400 mt-1 text-sm max-w-2xl">
                  Master Data Management: gerencie todos os aspectos do item.
                </p>
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                <Button onClick={() => navigate('/products')} className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 h-10 px-5 font-bold">
                  Voltar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT WITH TABS */}
      <div className={`flex-1 ${onClose ? 'p-6' : 'px-4 sm:px-6 pb-12'}`}>
        <div className={`mx-auto flex flex-col gap-6 ${onClose ? 'w-full' : 'max-w-[1600px]'}`}>
          
          {/* HORIZONTAL TABS */}
          <div className="flex border-b border-slate-200 gap-6 w-full overflow-x-auto px-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'border-indigo-600 text-indigo-900' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB CONTENT */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 min-h-[500px]">
            
            {activeTab === 'basic' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex flex-col gap-6">
                  {/* Utilização do Item */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex gap-6 items-center">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Utilização do Item</h4>
                      <p className="text-xs text-slate-500">Defina os fluxos operacionais B2B para este material.</p>
                    </div>
                    <div className="flex gap-4 ml-auto">
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                        <input 
                          type="checkbox" 
                          checked={basicInfo.availableForPurchase} 
                          onChange={e => setBasicInfo({...basicInfo, availableForPurchase: e.target.checked})}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span className="text-sm font-medium text-slate-700">Disponível para Compra</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                        <input 
                          type="checkbox" 
                          checked={basicInfo.availableForSale} 
                          onChange={e => setBasicInfo({...basicInfo, availableForSale: e.target.checked})}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span className="text-sm font-medium text-slate-700">Disponível para Venda</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex-1 space-y-5">
                    {/* Linha 1 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Código do Fabricante *</Label>
                        <Input 
                          value={basicInfo.manufacturerCode} 
                          onChange={e => setBasicInfo({...basicInfo, manufacturerCode: e.target.value})}
                          placeholder="Ex: PN-12345"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fabricante / Marca *</Label>
                        <Input 
                          value={basicInfo.manufacturer} 
                          onChange={e => setBasicInfo({...basicInfo, manufacturer: e.target.value})}
                          placeholder="Ex: Volk, 3M"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Segmento</Label>
                        <select 
                           value={classification.category} 
                           onChange={e => setClassification({...classification, category: e.target.value})}
                           className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                           <option value="">Selecione...</option>
                           {availableSegments.map(s => (
                             <option key={s.id} value={s.id}>{s.nome}</option>
                           ))}
                        </select>
                      </div>
                    </div>
                    
                    {/* Linha 2 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome do Produto *</Label>
                        <Input 
                          value={basicInfo.name} 
                          onChange={e => setBasicInfo({...basicInfo, name: e.target.value})}
                          placeholder="Ex: Luva de Proteção Térmica"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SKU / Código Interno</Label>
                        <Input 
                          value={basicInfo.sku} 
                          onChange={e => setBasicInfo({...basicInfo, sku: e.target.value})}
                          placeholder="Ex: EPI-LUV-001"
                        />
                      </div>
                    </div>

                    {/* Linha 3 */}
                    <div className="flex flex-col md:flex-row gap-5">
                      <div className="w-full md:w-64 shrink-0 space-y-3">
                        <Label>Foto do Produto</Label>
                        <div 
                          className="aspect-[4/3] w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer overflow-hidden relative group"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {basicInfo.imageUrl ? (
                            <img src={basicInfo.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <ImageIcon className="h-8 w-8 mb-2 text-slate-300" />
                              <span className="text-xs font-medium">Upload Imagem</span>
                            </>
                          )}
                        </div>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                        />
                        <Input 
                          placeholder="URL da imagem (Opcional)" 
                          value={basicInfo.imageUrl}
                          onChange={e => setBasicInfo({...basicInfo, imageUrl: e.target.value})}
                          className="text-xs h-9"
                        />
                      </div>

                      <div className="flex-1 space-y-2">
                        <Label>Descrição Técnica</Label>
                        <textarea 
                          className="w-full min-h-[80px] max-h-[100px] resize-y p-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Detalhes completos, norma técnica, material..."
                          maxLength={250}
                          value={basicInfo.description}
                          onChange={e => setBasicInfo({...basicInfo, description: e.target.value})}
                        />
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {basicInfo.description.length}/250
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'classification' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-bold text-slate-900">Classificação</h3>
                  <p className="text-sm text-slate-500">Categorização e dados fiscais.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Categoria Principal</Label>
                    <Input 
                      value={classification.category} 
                      onChange={e => setClassification({...classification, category: e.target.value})}
                      placeholder="Ex: Ferramentas, EPIs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Grupo de Compras (Purchasing Group)</Label>
                    <Input 
                      value={classification.purchasingGroup} 
                      onChange={e => setClassification({...classification, purchasingGroup: e.target.value})}
                      placeholder="Ex: Materiais Indiretos"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>NCM (Classificação Fiscal)</Label>
                    <Input 
                      value={classification.ncm} 
                      onChange={e => setClassification({...classification, ncm: e.target.value})}
                      placeholder="Ex: 8205.40.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unidade de Medida Base (UoM)</Label>
                    <Input 
                      value={classification.baseUom} 
                      onChange={e => setClassification({...classification, baseUom: e.target.value})}
                      placeholder="Ex: UN, KG, CX"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'commercial' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-bold text-slate-900">Comercial e Compras</h3>
                  <p className="text-sm text-slate-500">Parâmetros de aquisição e saving.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Centro de Custo Padrão</Label>
                    <Input 
                      value={commercial.costCenter} 
                      onChange={e => setCommercial({...commercial, costCenter: e.target.value})}
                      placeholder="Ex: CC-Manutenção-01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço de Referência / Custo Padrão (R$)</Label>
                    <Input 
                      type="number"
                      value={commercial.targetPrice} 
                      onChange={e => setCommercial({...commercial, targetPrice: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>MOQ (Quantidade Mínima de Pedido)</Label>
                    <Input 
                      type="number"
                      value={commercial.moq} 
                      onChange={e => setCommercial({...commercial, moq: e.target.value})}
                      placeholder="Ex: 100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lote Múltiplo</Label>
                    <Input 
                      type="number"
                      value={commercial.multiple} 
                      onChange={e => setCommercial({...commercial, multiple: e.target.value})}
                      placeholder="Ex: 10 (Compra de 10 em 10)"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'logistics' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-bold text-slate-900">Logística</h3>
                  <p className="text-sm text-slate-500">Dados de peso, dimensão e armazenagem.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Peso Bruto (Kg)</Label>
                    <Input value={logistics.grossWeight} onChange={e => setLogistics({...logistics, grossWeight: e.target.value})} placeholder="0.000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Peso Líquido (Kg)</Label>
                    <Input value={logistics.netWeight} onChange={e => setLogistics({...logistics, netWeight: e.target.value})} placeholder="0.000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Time Padrão (Dias)</Label>
                    <Input value={logistics.leadTime} onChange={e => setLogistics({...logistics, leadTime: e.target.value})} placeholder="Ex: 15" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Largura (cm)</Label>
                    <Input value={logistics.width} onChange={e => setLogistics({...logistics, width: e.target.value})} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Altura (cm)</Label>
                    <Input value={logistics.height} onChange={e => setLogistics({...logistics, height: e.target.value})} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Comprimento (cm)</Label>
                    <Input value={logistics.length} onChange={e => setLogistics({...logistics, length: e.target.value})} placeholder="0" />
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <Label>Instruções de Armazenamento</Label>
                  <textarea 
                    className="w-full min-h-[80px] p-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Armazenar em local seco, frágil, não empilhar mais de 5 caixas..."
                    value={logistics.storage}
                    onChange={e => setLogistics({...logistics, storage: e.target.value})}
                  />
                </div>
              </div>
            )}

            {/* Outras abas (Documentos, Histórico) */}
            {['documents', 'history'].includes(activeTab) && (
              <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  {activeTab === 'documents' && <FileText className="h-8 w-8 text-slate-400" />}
                  {activeTab === 'history' && <History className="h-8 w-8 text-slate-400" />}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  Módulo em Construção
                </h3>
                <p className="text-slate-500 max-w-sm">
                  A visualização detalhada desta aba estará disponível na próxima etapa da implementação.
                </p>
                {activeTab === 'documents' && (
                  <Button className="mt-6 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
                    <Plus className="h-4 w-4 mr-2" /> Upload de Documento Técnico
                  </Button>
                )}
              </div>
            )}

            {activeTab === 'suppliers' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Fornecedores Vinculados</h3>
                    <p className="text-sm text-slate-500">Gerencie a base de fornecimento para este produto</p>
                  </div>
                  <Button onClick={() => setIsLinkModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="h-4 w-4 mr-2" /> Vincular Fornecedor
                  </Button>
                </div>
                
                {suppliers.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-sm font-medium text-slate-900">Base de Abastecimento Vazia</h4>
                    <p className="text-sm text-slate-500 mt-1">Clique em "Vincular Fornecedor" para adicionar parceiros.</p>
                  </div>
                ) : (
                  <div className="border rounded-xl bg-white overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-slate-50 border-b text-slate-600 font-medium">
                        <tr>
                          <th className="px-4 py-3">Fornecedor</th>
                          <th className="px-4 py-3">Cód. no Fornec.</th>
                          <th className="px-4 py-3 text-center">Pref.</th>
                          <th className="px-4 py-3 text-right">Und. Compra</th>
                          <th className="px-4 py-3 text-right">MOQ</th>
                          <th className="px-4 py-3 text-right">Lead Time</th>
                          <th className="px-4 py-3 text-center">Contrato</th>
                          <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {suppliers.map(s => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {s.name}
                              <div className="text-xs text-slate-500">{s.document}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-500">{(s as any).supplierCode || '-'}</td>
                            <td className="px-4 py-3 text-center">
                              {(s as any).isPreferred ? (
                                <span className="inline-flex items-center justify-center bg-green-100 text-green-700 w-5 h-5 rounded-full text-xs">★</span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-500">{(s as any).purchaseUnit || 'UN'}</td>
                            <td className="px-4 py-3 text-right text-slate-500">{(s as any).moq || 1}</td>
                            <td className="px-4 py-3 text-right text-slate-500">{(s as any).leadTimeDays ? `${(s as any).leadTimeDays} d` : '-'}</td>
                            <td className="px-4 py-3 text-center">
                              {(s as any).hasContract ? <span className="text-green-600 text-xs font-bold">Sim</span> : <span className="text-slate-400 text-xs">Não</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={async () => {
                                  if (isEditing && id) {
                                    await productSupplierRepo.unlinkSupplier(id, s.id);
                                  }
                                  setSuppliers(prev => prev.filter(sup => sup.id !== s.id));
                                }}
                              >
                                Desvincular
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <LinkSupplierModal 
              isOpen={isLinkModalOpen}
              onClose={() => setIsLinkModalOpen(false)}
              alreadyLinkedIds={suppliers.map(s => s.id)}
              onLink={(selected) => {
                setSuppliers(prev => [...prev, ...selected]);
              }}
            />

          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="max-w-[1600px] mx-auto mt-8 mb-12 flex justify-center gap-4">
          <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white h-12 px-8 font-bold text-base shadow-lg shadow-indigo-900/20 rounded-xl">
            <Save className="h-5 w-5 mr-2" />
            Salvar Alterações
          </Button>
          {isEditing && (
            <Button 
              onClick={async () => {
                if (window.confirm('Tem certeza que deseja excluir este material? Esta ação não pode ser desfeita.')) {
                  try {
                    await repo.delete(id!, tenantId);
                    alert('O material foi excluído com sucesso.');
                    if (onSaveSuccess) {
                      onSaveSuccess();
                    } else {
                      navigate('/products');
                    }
                  } catch (e) {
                    console.error(e);
                    alert('Erro ao excluir material.');
                  }
                }
              }} 
              className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200 h-12 px-8 font-bold text-base shadow-sm rounded-xl"
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Excluir Material
            </Button>
          )}
        </div>

        {/* Similar Product Modal */}
        {isSimilarModalOpen && similarProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 border border-slate-200 animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center space-y-4 mb-6">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Encontramos um material semelhante.</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Deseja visualizar o cadastro antes de criar um novo?
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-full text-left">
                  <p className="text-sm font-semibold text-slate-900">{similarProduct.name}</p>
                  <p className="text-xs text-slate-500 mt-1">SKU: {similarProduct.sku}</p>
                  <p className="text-xs text-slate-500">Fabricante: {similarProduct.manufacturerCode || similarProduct.manufacturer}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => {
                    setIsSimilarModalOpen(false);
                    navigate(`/products/${similarProduct.id}`);
                  }} 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11"
                >
                  Visualizar cadastro
                </Button>
                <Button 
                  onClick={() => setIsSimilarModalOpen(false)} 
                  variant="outline"
                  className="w-full h-11 bg-white"
                >
                  Continuar criando novo
                </Button>
                <button 
                  onClick={() => {
                    setIsSimilarModalOpen(false);
                    setBasicInfo({...basicInfo, manufacturerCode: ''});
                  }}
                  className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}