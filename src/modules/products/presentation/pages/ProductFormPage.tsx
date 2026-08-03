import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { ActionModal } from '@/shared/components/ui/ActionModal';
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
import { SupabaseProductSupplierRepository } from '../../infrastructure/repositories/SupabaseProductSupplierRepository';
import { SupabaseCategoryRepository } from '../../../categories/infrastructure/repositories/SupabaseCategoryRepository';
import { Product, ProductStatus } from '../../domain/entities/Product'; 
import { LinkSupplierModal } from '../components/LinkSupplierModal';
import { supabase } from '@/infrastructure/supabase/client';
import { CategoryModal } from '../../../categories/presentation/pages/CategoriesPage';
import { Category } from '../../../categories/domain/entities/Category';

const repo = new SupabaseProductRepository();
const productSupplierRepo = new SupabaseProductSupplierRepository();
const categoryRepo = new SupabaseCategoryRepository();
const tenantId = localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';

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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const canEditGlobalMaterial = isSuperAdmin === true;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState('basic');

  // Aggregates State
  const [basicInfo, setBasicInfo] = useState({
    name: '', sku: '', manufacturer: '', description: '', status: 'Active', imageUrl: '', manufacturerCode: '', technicalDescription: '', availableForPurchase: true, availableForSale: false,
    role: 'revenda', salesCode: '', materialId: ''
  });
  
  const [businessModel, setBusinessModel] = useState<'manufacturer' | 'reseller' | 'both'>('reseller');
  const [classification, setClassification] = useState({
    category: '',
    globalCategory: '',
    subcategory: '',
    purchasingGroup: '',
    baseUom: 'UN',
    description: ''
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
      const reader = new FileReader();
      reader.onloadend = () => {
        setBasicInfo(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Semelhantes / IA Search
  const [similarProduct, setSimilarProduct] = useState<Product | null>(null);
  const [isSimilarModalOpen, setIsSimilarModalOpen] = useState(false);

  // Action Modal State
  const [actionModal, setActionModal] = useState<{isOpen: boolean; type: 'save' | 'draft' | 'cancel' | 'delete'}>({ isOpen: false, type: 'save' });

  // Related data states
  const [availableCategories, setAvailableCategories] = useState<{id: string, name: string}[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [attachmentsList, setAttachmentsList] = useState<{type: string, filename: string, base64: string, uploadedAt: string, user: string}[]>([]);

  // Segmentos não mais usados no form, substituídos por categorias

  // Debounce search on manufacturerCode
  useEffect(() => {
    if (isEditing || !basicInfo.manufacturerCode || basicInfo.manufacturerCode.length < 3) return;

    const timer = setTimeout(async () => {
      try {
        const { data: materials, error } = await supabase
          .from('materials')
          .select('*')
          .or(`manufacturer_code.ilike.%${basicInfo.manufacturerCode}%,name.ilike.%${basicInfo.name}%`)
          .limit(10);
          
        if (error) throw error;
        
        // Busca determinística por Código do Fabricante
        const match = materials?.find(m => m.manufacturer_code === basicInfo.manufacturerCode);
        
        if (match && match.id !== basicInfo.materialId) {
          const matchedProduct = new Product(
            match.id,
            tenantId,
            '', // supplierId
            '', // categoryId
            match.name,
            match.description || '',
            '', // sku
            'UN', // unit
            match.manufacturer || '',
            0,
            ProductStatus.ACTIVE,
            match.id,
            new Date(),
            new Date(),
            undefined,
            match.manufacturer_code
          );
          setSimilarProduct(matchedProduct);
          setIsSimilarModalOpen(true);
        }
      } catch(e) {
        console.error(e);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [basicInfo.manufacturerCode, basicInfo.name, isEditing, basicInfo.materialId]);

  // Load existing data if editing
  useEffect(() => {
    async function loadData() {
      try {
        const cats = await categoryRepo.findAll(tenantId);
        setAvailableCategories(cats.filter(c => c.status === 'Active').map(c => ({id: c.id, name: c.name})));
      } catch(e) {
        console.error("Failed to load categories", e);
      }
      
      try {
        const { data: orgData } = await supabase.from('organizations').select('business_model').eq('id', tenantId).maybeSingle();
        if (orgData && orgData.business_model) {
           setBusinessModel(orgData.business_model as 'manufacturer' | 'reseller' | 'both');
        }
      } catch(e) {
        console.error("Failed to load organization profile", e);
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
           const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('user_id', user.id).maybeSingle();
           const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
           const hasGlobalRole = roles?.some(r => r.role === 'super_admin' || r.role === 'platform_admin');
           if (profile?.is_super_admin || hasGlobalRole) {
              setIsSuperAdmin(true);
           }
        }
      } catch(e) {
        console.error("Failed to load super admin status", e);
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
              technicalDescription: product.technicalDescription || '',
              description: product.description || '',
              imageUrl: product.imageUrl || '',
              availableForPurchase: product.availableForPurchase ?? true,
              availableForSale: product.availableForSale ?? false,
              status: product.status === ProductStatus.DRAFT ? 'Draft' : 'Active',
              materialId: product.materialId || ''
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
            
            // Se tiver materialId, buscar dados complementares do Material Global
            if (product.materialId) {
               try {
                 const { data: matData } = await supabase.from('materials').select('description').eq('id', product.materialId).maybeSingle();
                 if (matData) {
                   setClassification(prev => ({ ...prev, description: matData.description || '' }));
                 }
               } catch (e) { console.error('Erro ao buscar material global', e); }
            }
            
            // Mocked supplier mapping
            if (product.supplierId) {
               setSuppliers([{ id: '', name: 'Fornecedor', document: '' }]);
            }
            if (product.attachments && Array.isArray(product.attachments)) {
               setAttachmentsList(product.attachments);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    loadData();
  }, [id, isEditing]);

  const handleSaveCategory = async (c: Category) => {
    try {
      await categoryRepo.save(c);
      const cats = await categoryRepo.findAll(tenantId);
      setAvailableCategories(cats.filter(c => c.status === 'Active').map(c => ({id: c.id, name: c.name})));
      setClassification(prev => ({ ...prev, category: c.id }));
      setIsCategoryModalOpen(false);
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao salvar categoria: ${e?.message || JSON.stringify(e)}`);
    }
  };

  const handleSave = async (forceDraft: boolean = false) => {
    // Basic validation based on business model
    const statusToSave = forceDraft ? 'Draft' : basicInfo.status;
    
    if (statusToSave !== 'Draft') {
      const isComplete = Boolean(
        basicInfo.imageUrl && 
        basicInfo.name && 
        basicInfo.manufacturer &&
        classification.category && 
        basicInfo.manufacturerCode && 
        basicInfo.technicalDescription &&
        (businessModel === 'manufacturer' || basicInfo.sku)
      );
      if (!isComplete) {
        alert("Para Salvar Produto, preencha todos os campos obrigatórios (marcados com *). Para salvar incompleto, use Salvar Rascunho.");
        return;
      }
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
        statusToSave === 'Draft' ? ProductStatus.DRAFT : ProductStatus.ACTIVE,
        basicInfo.materialId || undefined, // Preserva o materialId caso exista
        new Date(),
        new Date(),
        undefined, // categoryName (not needed for save)
        basicInfo.manufacturerCode,
        basicInfo.availableForPurchase,
        basicInfo.availableForSale,
        basicInfo.imageUrl,
        basicInfo.technicalDescription,
        attachmentsList
      );

      // Save to products (tenant data)
      await repo.save(newProduct);

      // Update materials (global catalog) if admin
      if (canEditGlobalMaterial && basicInfo.materialId) {
        const { data: oldMaterial } = await supabase.from('materials').select('*').eq('id', basicInfo.materialId).limit(1).maybeSingle();
        
        const { error: updateError } = await supabase.from('materials').update({
          official_name: basicInfo.name,
          manufacturer_code: basicInfo.manufacturerCode,
          manufacturer_name: basicInfo.manufacturer,
          description: classification.description,
          updated_at: new Date().toISOString()
        }).eq('id', basicInfo.materialId);
        
        if (updateError) throw new Error(`Falha ao atualizar Material Global: ${updateError.message}`);
        
        const { data: authData } = await supabase.auth.getUser();
        await supabase.from('audit_logs').insert({
          action: 'UPDATE',
          entity_name: 'materials',
          entity_id: basicInfo.materialId,
          user_id: authData?.user?.id || null,
          organization_id: tenantId,
          old_data: oldMaterial || {},
          new_data: {
             official_name: basicInfo.name,
             manufacturer_code: basicInfo.manufacturerCode,
             manufacturer_name: basicInfo.manufacturer,
             description: classification.description
          },
          details: 'Edição do Material Master pelo ADM GLOBAL'
        });
      }

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
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao salvar produto: ${e?.message || JSON.stringify(e)}`);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Informações Básicas', icon: Package },
    { id: 'classification', label: 'Classificação', icon: Tags },
    { id: 'commercial', label: 'Comercial', icon: Briefcase },
    { id: 'logistics', label: 'Logística', icon: Truck },
    { id: 'suppliers', label: 'Base de Abastecimento do Material', icon: Users },
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
                  Os dados globais identificam o material na rede Hub.IA. Os dados internos pertencem somente à sua empresa.
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
          <div className="flex flex-wrap border-b border-slate-200 gap-y-2 gap-x-4 sm:gap-x-6 w-full px-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2 sm:pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
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
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Bloco 1 - Identificação Global do Material */}
                <div className="border border-indigo-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-indigo-50/50 p-4 border-b border-indigo-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                        <Package className="h-4 w-4" /> 
                        Identificação Global do Material
                      </h3>
                      <p className="text-xs text-indigo-700/80 mt-1">
                        Estes dados identificam o material no Catálogo Global da Hub.IA. 
                        {basicInfo.materialId && " Como este material já está vinculado à rede, os campos estão protegidos."}
                      </p>
                    </div>
                    <div>
                      {basicInfo.materialId ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                          Catálogo Global
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                          Material Global Pendente
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-6 bg-white space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center h-5">
                          <Label>Nome Global do Material *</Label>
                        </div>
                        <Input 
                          value={basicInfo.name} 
                          onChange={e => setBasicInfo({...basicInfo, name: e.target.value})}
                          placeholder="Ex: Motor Elétrico Trifásico 15CV"
                          disabled={!!basicInfo.materialId && !canEditGlobalMaterial}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center h-5">
                          <Label>Fabricante / Marca Global *</Label>
                        </div>
                        <Input 
                          value={basicInfo.manufacturer} 
                          onChange={e => setBasicInfo({...basicInfo, manufacturer: e.target.value})}
                          placeholder="Ex: WEG, SKF, 3M"
                          disabled={!!basicInfo.materialId && !canEditGlobalMaterial}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center h-5">
                          <Label>Código do Fabricante Global *</Label>
                        </div>
                        <Input 
                          value={basicInfo.manufacturerCode} 
                          onChange={e => setBasicInfo({...basicInfo, manufacturerCode: e.target.value})}
                          placeholder="Ex: W22-100CV"
                          disabled={!!basicInfo.materialId && !canEditGlobalMaterial}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between h-5">
                          <Label>Categoria do Material Global</Label>
                        </div>
                        <select 
                           value={classification.globalCategory} 
                           onChange={e => setClassification({...classification, globalCategory: e.target.value})}
                           className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:opacity-50 disabled:bg-slate-50"
                           disabled={!!basicInfo.materialId && !canEditGlobalMaterial}
                        >
                          <option value="" disabled>Selecione a categoria global</option>
                          {availableCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>Descrição Completa Global</Label>
                        <textarea 
                          className="w-full min-h-[40px] max-h-[80px] resize-y p-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-50"
                          placeholder="Descrição geral do material..."
                          maxLength={500}
                          value={classification.description}
                          onChange={e => setClassification({...classification, description: e.target.value})}
                          disabled={!!basicInfo.materialId && !canEditGlobalMaterial}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Bloco 2 - Dados Internos da Empresa */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 p-4 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Briefcase className="h-4 w-4" /> 
                      Dados Internos da Sua Empresa
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Identificação comercial, logística interna e dados complementares que pertencem exclusivamente à sua empresa.
                    </p>
                  </div>
                  
                  <div className="p-6 bg-white space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {businessModel !== 'manufacturer' && (
                        <div className="space-y-2">
                          <Label>Código Interno * <span className="text-slate-400 font-normal ml-1">(SKU interno)</span></Label>
                          <p className="text-[10px] text-slate-500 mb-1">Código utilizado internamente pela sua empresa para identificar este material.</p>
                          <Input 
                            value={basicInfo.sku} 
                            onChange={e => setBasicInfo({...basicInfo, sku: e.target.value})}
                            placeholder="Ex: MOT-00123"
                          />
                        </div>
                      )}
                      {businessModel === 'manufacturer' && (
                        <div className="space-y-2">
                          <Label>Código Interno (Opcional) <span className="text-slate-400 font-normal ml-1">(SKU interno)</span></Label>
                          <p className="text-[10px] text-slate-500 mb-1">Código utilizado internamente pela sua empresa para identificar este material.</p>
                          <Input 
                            value={basicInfo.sku} 
                            onChange={e => setBasicInfo({...basicInfo, sku: e.target.value})}
                            placeholder="Uso interno (Opcional)"
                          />
                        </div>
                      )}
                      
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col gap-3">
                        <Label className="text-xs text-slate-500">Seu papel no fluxo operacional deste material:</Label>
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer bg-white px-3 h-9 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                            <input 
                              type="checkbox" 
                              checked={basicInfo.availableForPurchase} 
                              onChange={e => setBasicInfo({...basicInfo, availableForPurchase: e.target.checked})}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <span className="text-xs font-medium text-slate-700">Compra</span>
                          </label>
                          
                          <label className="flex items-center gap-2 cursor-pointer bg-white px-3 h-9 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                            <input 
                              type="checkbox" 
                              checked={basicInfo.availableForSale} 
                              onChange={e => setBasicInfo({...basicInfo, availableForSale: e.target.checked})}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <span className="text-xs font-medium text-slate-700">Venda</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-5 border-t border-slate-100 pt-5">
                      <div className="w-full md:w-64 shrink-0 space-y-3">
                        <Label>Foto do Produto (Local)</Label>
                        <div 
                          className={`aspect-[4/3] w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 cursor-pointer flex flex-col items-center justify-center text-slate-400 transition-colors overflow-hidden relative group`}
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

                      <div className="flex-1 flex flex-col gap-4">
                        <div className="space-y-2">
                          <Label>Descrição Técnica Completa</Label>
                          <textarea 
                            className="w-full min-h-[80px] max-h-[100px] resize-y p-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Detalhes completos, norma técnica, material..."
                            maxLength={500}
                            value={basicInfo.technicalDescription}
                            onChange={e => setBasicInfo({...basicInfo, technicalDescription: e.target.value})}
                          />
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-medium">
                              {basicInfo.technicalDescription.length}/500
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between h-5">
                            <Label htmlFor="category">Categoria Interna *</Label>
                            <button 
                              onClick={() => setIsCategoryModalOpen(true)}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" /> Nova Categoria
                            </button>
                          </div>
                          <select 
                             value={classification.category} 
                             onChange={e => setClassification({...classification, category: e.target.value})}
                             className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                          >
                             <option value="">Selecione...</option>
                             {availableCategories.map(c => (
                               <option key={c.id} value={c.id}>{c.name}</option>
                             ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-slate-100 pt-5">
                      <Label>Evidência Técnica</Label>
                      <div className="flex flex-wrap gap-3">
                        {['Catálogo', 'Desenho', 'Ficha técnica'].map(type => {
                          const isAttached = attachmentsList.some(a => a.type === type);
                          return (
                            <label key={type} className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold cursor-pointer transition-colors shadow-sm ${
                              isAttached 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}>
                              <input 
                                type="file" 
                                className="hidden" 
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    const file = e.target.files[0];
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      const newAttachment = {
                                        type,
                                        filename: file.name,
                                        base64: reader.result as string,
                                        uploadedAt: new Date().toISOString(),
                                        user: 'Usuário Atual'
                                      };
                                      setAttachmentsList(prev => {
                                        const filtered = prev.filter(a => a.type !== type);
                                        return [...filtered, newAttachment];
                                      });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              <FileText className={`h-4 w-4 ${isAttached ? 'text-emerald-600' : 'text-slate-400'}`} /> 
                              {isAttached ? 'Anexo: ' + type : 'Adicionar ' + type}
                              <div className="ml-2 relative flex h-2.5 w-2.5">
                                {isAttached ? (
                                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                ) : (
                                  <>
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                  </>
                                )}
                              </div>
                            </label>
                          );
                        })}
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
                    <Label>Categoria do Material</Label>
                    <select 
                      value={classification.category} 
                      onChange={e => setClassification({...classification, category: e.target.value})}
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                    >
                      <option value="">Selecione a categoria...</option>
                      {availableCategories.map(c => (
                        <option key={c.id} value={c.id}>
                           {c.name}
                        </option>
                      ))}
                    </select>
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
            {activeTab === 'history' && (
              <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <History className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  Módulo em Construção
                </h3>
                <p className="text-slate-500 max-w-sm">
                  A visualização detalhada desta aba estará disponível na próxima etapa da implementação.
                </p>
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Documentos Técnicos</h3>
                    <p className="text-sm text-slate-500">Documentos e anexos técnicos vinculados a este material.</p>
                  </div>
                </div>

                {attachmentsList.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-sm font-medium text-slate-900">Nenhum documento anexado</h4>
                    <p className="text-sm text-slate-500 mt-1">Vá na aba "Informações Básicas" para fazer upload de evidências técnicas.</p>
                  </div>
                ) : (
                  <div className="border rounded-xl bg-white overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-slate-50 border-b text-slate-600 font-medium">
                        <tr>
                          <th className="px-4 py-3">Nome do Arquivo</th>
                          <th className="px-4 py-3">Tipo</th>
                          <th className="px-4 py-3 text-center">Data Upload</th>
                          <th className="px-4 py-3">Usuário</th>
                          <th className="px-4 py-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {attachmentsList.map((doc, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {doc.filename}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {doc.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-500">
                              {new Date(doc.uploadedAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {doc.user}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-3">
                                <a href={doc.base64} download={doc.filename} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold">
                                  Download
                                </a>
                                <a href={doc.base64} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold">
                                  Visualizar
                                </a>
                                <button 
                                  onClick={() => setAttachmentsList(prev => prev.filter(a => a.type !== doc.type))}
                                  className="text-red-600 hover:text-red-800 text-xs font-semibold"
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'suppliers' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Base de Abastecimento</h3>
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
        <div className="max-w-[1600px] mx-auto mt-8 mb-12 flex justify-center sm:justify-end gap-3 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => setActionModal({ isOpen: true, type: 'cancel' })} 
            className="h-10 px-6 font-bold text-slate-600 bg-white border-slate-200 hover:bg-slate-50"
          >
            Cancelar
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              setBasicInfo({ ...basicInfo, status: 'Draft' });
              setActionModal({ isOpen: true, type: 'draft' });
            }} 
            className="h-10 px-6 font-bold text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
          >
            Salvar Rascunho
          </Button>
          <Button 
            onClick={() => {
              setBasicInfo({ ...basicInfo, status: 'Active' });
              setActionModal({ isOpen: true, type: 'save' });
            }} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-8 font-bold shadow-sm"
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar Material
          </Button>
        </div>

        {/* Action Modal */}
        <ActionModal
          isOpen={actionModal.isOpen}
          title={
            actionModal.type === 'cancel' ? 'Deseja cancelar?' :
            actionModal.type === 'save' ? 'Confirma novo material?' : 
            'Salvar como rascunho?'
          }
          description={
            actionModal.type === 'cancel' ? 'Todas as alterações não salvas serão perdidas.' :
            'O material será salvo na sua base de dados.'
          }
          confirmText={actionModal.type === 'cancel' ? 'Sim, cancelar' : 'Sim'}
          cancelText="Não"
          variant={actionModal.type === 'cancel' ? 'danger' : 'primary'}
          onConfirm={() => {
            if (actionModal.type === 'cancel') {
              setActionModal({ ...actionModal, isOpen: false });
              navigate('/products');
            } else {
              setActionModal({ ...actionModal, isOpen: false });
              handleSave(actionModal.type === 'draft');
            }
          }}
          onCancel={() => setActionModal({ ...actionModal, isOpen: false })}
        />

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

        {isCategoryModalOpen && (
          <CategoryModal 
            tenantId={tenantId}
            onClose={() => setIsCategoryModalOpen(false)}
            onSave={handleSaveCategory}
          />
        )}
      </div>
    </div>
  );
}