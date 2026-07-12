import { useState, useEffect } from 'react';
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
  Plus
} from 'lucide-react';

import { SupabaseProductRepository } from '../../infrastructure/repositories/SupabaseProductRepository';
import { Product, ProductStatus } from '../../domain/entities/Product';

const repo = new SupabaseProductRepository();
const tenantId = '00000000-0000-0000-0000-000000000000'; // Mocked tenant ID

export default function ProductFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [activeTab, setActiveTab] = useState('basic');

  // Aggregates State
  const [basicInfo, setBasicInfo] = useState({
    name: '', sku: '', manufacturer: '', description: '', status: 'Active', imageUrl: ''
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
  
  // N:N relationships (mocked for UI)
  const [suppliers, setSuppliers] = useState<{name: string, sku: string, price: number}[]>([]);

  // Load existing data if editing
  useEffect(() => {
    async function loadData() {
      if (isEditing && id) {
        try {
          const product = await repo.findById(id, tenantId);
          if (product) {
            setBasicInfo(prev => ({
              ...prev,
              name: product.name || '',
              sku: product.sku || '',
              manufacturer: product.manufacturer || '',
              description: product.description || '',
              status: product.status === ProductStatus.DRAFT ? 'Draft' : 'Active'
            }));
            setClassification(prev => ({
              ...prev,
              category: product.categoryId || '',
              baseUom: product.uom || ''
            }));
            setCommercial(prev => ({
              ...prev,
              targetPrice: product.price?.toString() || ''
            }));
            
            // Mocked supplier mapping
            if (product.supplierId) {
               setSuppliers([{ name: 'Fornecedor', sku: product.sku, price: product.price }]);
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
        new Date()
      );

      await repo.save(newProduct);
      navigate('/products');
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
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      {/* HEADER BANNER */}
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
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 font-bold shadow-md shadow-indigo-900/20">
                <Save className="h-4 w-4 mr-1.5" />
                Salvar Produto
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT WITH TABS */}
      <div className="flex-1 px-4 sm:px-6 pb-12">
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6">
          
          {/* SIDEBAR TABS */}
          <div className="w-full lg:w-64 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm sticky top-6">
              <nav className="space-y-1">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-colors ${
                      activeTab === tab.id 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* TAB CONTENT */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 min-h-[500px]">
            
            {activeTab === 'basic' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-bold text-slate-900">Informações Básicas</h3>
                  <p className="text-sm text-slate-500">Dados principais de identificação do produto.</p>
                </div>
                
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Image Upload Area */}
                  <div className="w-full md:w-64 shrink-0 space-y-3">
                    <Label>Foto do Produto</Label>
                    <div className="aspect-square w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer overflow-hidden relative group">
                      {basicInfo.imageUrl ? (
                        <img src={basicInfo.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <ImageIcon className="h-8 w-8 mb-2 text-slate-300" />
                          <span className="text-xs font-medium">Upload Imagem</span>
                        </>
                      )}
                    </div>
                    <Input 
                      placeholder="URL da imagem (Opcional)" 
                      value={basicInfo.imageUrl}
                      onChange={e => setBasicInfo({...basicInfo, imageUrl: e.target.value})}
                      className="text-xs h-9"
                    />
                  </div>

                  {/* Fields */}
                  <div className="flex-1 space-y-6">
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
                        <Label>SKU / Código Interno *</Label>
                        <Input 
                          value={basicInfo.sku} 
                          onChange={e => setBasicInfo({...basicInfo, sku: e.target.value})}
                          placeholder="Ex: EPI-LUV-001"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Fabricante / Marca</Label>
                        <Input 
                          value={basicInfo.manufacturer} 
                          onChange={e => setBasicInfo({...basicInfo, manufacturer: e.target.value})}
                          placeholder="Ex: Volk, 3M"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Status Master</Label>
                        <select 
                          className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          value={basicInfo.status}
                          onChange={e => setBasicInfo({...basicInfo, status: e.target.value})}
                        >
                          <option value="Active">Ativo</option>
                          <option value="Inactive">Inativo</option>
                          <option value="Draft">Rascunho</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Descrição Técnica</Label>
                      <textarea 
                        className="w-full min-h-[120px] p-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Detalhes completos, norma técnica, material..."
                        value={basicInfo.description}
                        onChange={e => setBasicInfo({...basicInfo, description: e.target.value})}
                      />
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

            {/* Outras abas (Fornecedores, Documentos, Histórico) */}
            {['suppliers', 'documents', 'history'].includes(activeTab) && (
              <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  {activeTab === 'suppliers' && <Users className="h-8 w-8 text-slate-400" />}
                  {activeTab === 'documents' && <FileText className="h-8 w-8 text-slate-400" />}
                  {activeTab === 'history' && <History className="h-8 w-8 text-slate-400" />}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  Módulo em Construção
                </h3>
                <p className="text-slate-500 max-w-sm">
                  A visualização detalhada desta aba estará disponível na próxima etapa da implementação.
                </p>
                {activeTab === 'suppliers' && (
                  <Button className="mt-6 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
                    <Plus className="h-4 w-4 mr-2" /> Vincular Fornecedor
                  </Button>
                )}
                {activeTab === 'documents' && (
                  <Button className="mt-6 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
                    <Plus className="h-4 w-4 mr-2" /> Upload de Documento Técnico
                  </Button>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}