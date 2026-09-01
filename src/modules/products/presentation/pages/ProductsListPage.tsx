import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';
import { Badge } from '@/shared/components/ui/Badge';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Search, Plus, Upload, Filter, ShoppingCart, PackageOpen, MoreVertical, ImageOff, X, Edit2, ToggleLeft, ToggleRight, Layers, Package } from 'lucide-react';
import { QuotationTypeModal } from '@/modules/quotations/presentation/components/QuotationTypeModal';
import { useQuotationCart } from '@/modules/quotations/presentation/context/QuotationCartContext';
import { GlobalCatalogMaterial, SupabaseProductRepository } from '../../infrastructure/repositories/SupabaseProductRepository';
import ProductFormPage from './ProductFormPage';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';
import { LinkMaterialModal } from '../components/LinkMaterialModal';
import { supabase } from '@/infrastructure/supabase/client';

const repo = new SupabaseProductRepository();

interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  partNumber: string;
  supplier: string;
  category: string;
  manufacturer: string;
  price: number;
  status: 'Active' | 'Draft' | 'Inactive';
  updatedAt: string;
  description?: string;
  imageUrl?: string;
  availableForPurchase: boolean;
  isComplete: boolean;
  manufacturerCode: string;
  supplierId: string;
}

export default function ProductsListPage({
  masterMaintenanceMode = false,
}: {
  masterMaintenanceMode?: boolean;
} = {}) {
  const { data: identity } = useAuthenticatedIdentity();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isLinkMaterialOpen, setIsLinkMaterialOpen] = useState(false);
  const [linkMaterialId, setLinkMaterialId] = useState<string>();
  const [catalogScope, setCatalogScope] = useState<'ALL' | 'MINE' | 'HUBIA'>('MINE');
  const [globalMaterials, setGlobalMaterials] = useState<GlobalCatalogMaterial[]>([]);
  const [globalPage, setGlobalPage] = useState(0);
  const [globalHasMore, setGlobalHasMore] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const tenantId = identity?.organizationId || '';
  async function loadProducts() {
    try {
      const data = await repo.findAll(tenantId);
      const materialIds = data
        .map(product => product.materialId)
        .filter((materialId): materialId is string => Boolean(materialId));
      const { data: organizationMaterials, error: organizationMaterialsError } = materialIds.length
        ? await supabase
          .from('organization_materials')
          .select('material_id, internal_sku')
          .eq('organization_id', tenantId)
          .in('material_id', materialIds)
        : { data: [], error: null };
      if (organizationMaterialsError) throw organizationMaterialsError;
      const internalCodeByMaterial = new Map(
        (organizationMaterials || []).map(link => [link.material_id, link.internal_sku || '']),
      );
      // Map domain to UI format
      setProducts(data.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.materialId ? internalCodeByMaterial.get(p.materialId) || '' : '',
        unit: p.uom || 'UN',
        partNumber: p.manufacturerCode || '',
        supplier: p.supplierId || '',
        category: p.categoryName || 'Sem categoria',
        manufacturer: p.manufacturer || '',
        price: p.price,
        status: p.status, // Preserve Draft, Active, Inactive
        updatedAt: p.updatedAt.toISOString().split('T')[0],
        description: p.description,
        imageUrl: p.imageUrl,
        availableForPurchase: p.availableForPurchase ?? true,
        isComplete: p.isComplete,
        manufacturerCode: p.manufacturerCode || '',
        supplierId: p.supplierId || ''
      })));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar o catálogo da empresa.');
    }
  }

  useEffect(() => {
    if (tenantId) loadProducts();
  }, [tenantId]);

  useEffect(() => {
    if (searchParams.get('link') === '1') setIsLinkMaterialOpen(true);
  }, [searchParams]);
  
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const { items, addItem, removeItem, clearCart } = useQuotationCart();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  const loadGlobalMaterials = async (page: number, append = false) => {
    if (!tenantId) return;
    setGlobalLoading(true);
    setLoadError('');
    try {
      const result = await repo.findGlobalMaterials(tenantId, page, search);
      setGlobalMaterials(current => append ? [...current, ...result.rows] : result.rows);
      setGlobalPage(page);
      setGlobalHasMore(result.hasMore);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : 'Não foi possível carregar o catálogo global.');
    } finally {
      setGlobalLoading(false);
    }
  };

  useEffect(() => {
    if (catalogScope === 'MINE' || !tenantId) return;
    const timer = window.setTimeout(() => void loadGlobalMaterials(0), 250);
    return () => window.clearTimeout(timer);
  }, [catalogScope, search, tenantId]);

  const selectedProductIds = useMemo(() => items.map(item => item.productId), [items]);

  const ativos = products.filter(p => p.status === 'Active').length;
  const inativos = products.filter(p => p.status === 'Inactive').length;

  const filteredProducts = useMemo(() => {
    let result = products;
    if (filterStatus === 'ACTIVE') result = result.filter(p => p.status === 'Active');
    if (filterStatus === 'INACTIVE') result = result.filter(p => p.status === 'Inactive');
    
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(s) || 
        p.sku.toLowerCase().includes(s) ||
        p.manufacturer.toLowerCase().includes(s)
      );
    }
    return result;
  }, [products, search, filterStatus]);

  const toggleProductStatus = async (product: any) => {
    try {
      const fullProduct = await repo.findById(product.id, tenantId);
      if (fullProduct) {
        // We'll use 'Inactive' and 'Active' depending on what's defined in the domain
        const newStatus = fullProduct.status === 'Active' ? 'Inactive' : 'Active';
        fullProduct.status = newStatus as any; // Cast in case it requires enum
        await repo.save(fullProduct);
        loadProducts();
      }
    } catch(e) {
      console.error(e);
      alert('Erro ao alterar status do material.');
    }
  };

  const handleToggleSelect = (product: Product) => {
    const isSelected = selectedProductIds.includes(product.id);
    if (isSelected) {
      removeItem(product.id);
    } else {
      addItem({
        productId: product.id,
        name: product.name,
        uom: product.unit,
        quantity: 1,
        manufacturer: product.manufacturer,
        category: product.category,
        sku: product.sku,
        partNumber: product.partNumber,
        supplier: product.supplier
      });
    }
  };

  const selectedProductNames = useMemo(() => {
    return items.map(p => p.name).join(', ');
  }, [items]);

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      
      <div className="max-w-[1600px] mx-auto w-full px-6 pt-6 pb-2 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              <Package className="h-7 w-7 text-indigo-600" />
              Catálogo de Suprimentos
            </h1>
            <p className="text-slate-500 mt-1 text-sm max-w-2xl">
              Gerencie materiais, cadastre novos itens ou importe em lote.
            </p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
              <Button onClick={() => setIsLinkMaterialOpen(true)} variant="outline" className="h-10 px-5 font-bold shadow-sm">
                <Search className="h-4 w-4 mr-1.5" />
                Vincular Material
              </Button>
              <Button variant="outline" className="h-10 px-4 font-bold shadow-sm">
                <Upload className="h-4 w-4 mr-2 text-indigo-600" />
                Importar em Massa
              </Button>
              <Button onClick={() => navigate('/products/new')} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 font-bold shadow-md shadow-indigo-600/20">
                <Plus className="h-4 w-4 mr-1.5" />
                Novo Material
              </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total de Materiais</p>
            <p className="text-2xl font-black text-slate-900">{products.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Materiais Ativos</p>
            <p className="text-2xl font-black text-emerald-600">{ativos}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Materiais Inativos</p>
            <p className="text-2xl font-black text-slate-400">{inativos}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Itens Filtrados</p>
            <p className="text-2xl font-black text-indigo-600">{filteredProducts.length}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 overflow-x-auto">
              {([
                ['ALL', 'Todos'],
                ['MINE', 'Meu Catálogo'],
                ['HUBIA', 'Catálogo Hub.IA'],
              ] as const).map(([scope, label]) => (
                <button key={scope} onClick={() => setCatalogScope(scope)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${catalogScope === scope ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>
                  {label}
                </button>
              ))}
            </div>
            {catalogScope === 'MINE' && <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 overflow-x-auto">
              <button 
                onClick={() => setFilterStatus('ALL')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filterStatus === 'ALL' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setFilterStatus('ACTIVE')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filterStatus === 'ACTIVE' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Ativos
              </button>
              <button 
                onClick={() => setFilterStatus('INACTIVE')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filterStatus === 'INACTIVE' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Inativos
              </button>
            </div>}
          </div>
          <div className="relative w-full sm:max-w-xl">
            <Search className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
            <ClearableInput 
              placeholder="Busque por Nome, SKU, Fabricante..." 
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              className="pl-11 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-500 h-11 rounded-xl focus:border-indigo-500 focus:bg-white transition-colors"
            />
          </div>
        </div>
      </div>

      {/* FLOATING ACTION BAR FOR QUOTATION */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 shadow-2xl shadow-indigo-500/20 rounded-3xl p-4 flex items-center gap-6 animate-in slide-in-from-bottom-10 border border-indigo-500/30">
          <div className="flex items-center gap-3 border-r border-slate-700 pr-6">
            <div className="bg-indigo-500 text-white h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm">
              {selectedProductIds.length}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-300">Itens selecionados</p>
              <p className="text-[10px] text-slate-400 max-w-[150px] truncate">
                {selectedProductNames}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={clearCart} className="text-slate-400 hover:text-white hover:bg-slate-800 text-xs">
              Limpar
            </Button>
            <Button onClick={() => setIsQuoteModalOpen(true)} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold h-9">
              <ShoppingCart className="h-4 w-4 mr-2" /> Gerar Requisição
            </Button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          {loadError && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</p>}

          {catalogScope !== 'MINE' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {globalMaterials.map(material => (
                  <Card key={material.id} className="rounded-2xl border-slate-200 bg-white shadow-sm">
                    <CardContent className="flex h-full flex-col p-5">
                      <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{material.officialName}</p><p className="mt-1 text-xs text-slate-500">{material.manufacturer || 'Fabricante não informado'} · {material.manufacturerCode || 'Código não informado'}</p></div><Badge variant="outline">{material.unit}</Badge></div>
                      <p className="mt-3 line-clamp-2 text-xs text-slate-500">{material.description || 'Sem descrição técnica.'}</p>
                      <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-indigo-600">{material.category || 'Categoria em revisão'}</p>
                      <div className="mt-auto pt-5">{material.linked ? <div className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-700">Vinculado à minha empresa</div> : <Button variant="outline" className="w-full" onClick={() => { setLinkMaterialId(material.id); setIsLinkMaterialOpen(true); }} disabled={!material.categoryId}><Plus className="mr-1 h-4 w-4" /> Vincular</Button>}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {!globalLoading && globalMaterials.length === 0 && <div className="rounded-xl border bg-white p-12 text-center text-sm text-slate-500">Nenhum produto disponível para os filtros informados.</div>}
              {globalLoading && <p className="py-8 text-center text-sm text-slate-500">Carregando catálogo compartilhado...</p>}
              {globalHasMore && !globalLoading && <Button variant="outline" className="w-full" onClick={() => void loadGlobalMaterials(globalPage + 1, true)}>Carregar mais materiais</Button>}
            </div>
          )}
          
          {/* KPIs */}
          {catalogScope === 'MINE' && <><div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total de Materiais', value: products.length, color: 'text-slate-900', desc: 'Materiais cadastrados', filter: 'ALL' },
              { label: 'Ativos', value: ativos, color: 'text-green-600', desc: 'Materiais em uso', filter: 'ACTIVE' },
              { label: 'Inativos', value: inativos, color: 'text-slate-400', desc: 'Materiais desativados', filter: 'INACTIVE' },
            ].map(item => (
              <Card 
                key={item.label} 
                onClick={() => setFilterStatus(item.filter as any)}
                className={`rounded-2xl border-slate-200 shadow-sm cursor-pointer transition-all ${filterStatus === item.filter ? 'ring-2 ring-indigo-500 bg-indigo-50/30' : 'bg-white hover:bg-slate-50'}`}
              >
                <CardContent className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                  <p className={`text-2xl font-extrabold mt-1 ${item.color}`}>{item.value}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4 border border-slate-200">
                <PackageOpen className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Nenhum produto encontrado.</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                Cadastre novos itens ou importe sua planilha de materiais para começar a gerenciar seu catálogo.
              </p>
              <div className="mt-6 flex gap-3">
                <Button onClick={() => setIsLinkMaterialOpen(true)} variant="outline" className="font-bold">
                  <Search className="h-4 w-4 mr-1.5" /> Vincular material existente
                </Button>
                <Button onClick={() => navigate('/products/new')} className="mt-6 bg-indigo-600 hover:bg-indigo-700 font-bold">
                  <Plus className="h-4 w-4 mr-1.5" /> Cadastrar novo material
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24">
              {filteredProducts.map(product => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <div 
                    key={product.id}
                    className={`group relative bg-white border rounded-2xl flex flex-col transition-all duration-150 ease-out hover:-translate-y-[2px] hover:shadow-lg hover:border-slate-300 ${isSelected ? 'border-indigo-500 shadow-md shadow-indigo-100 ring-1 ring-indigo-500' : 'border-slate-200 hover:shadow-sm'}`}
                  >
                    {/* Imagem Cover / Placeholder */}
                    <div className="h-40 w-full bg-slate-50 border-b border-slate-100 flex flex-col items-center justify-center relative rounded-t-2xl group-hover:bg-slate-100/50 transition-colors shrink-0 overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-4" />
                      ) : (
                        <>
                          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-900 to-transparent"></div>
                          <ImageOff className="h-10 w-10 text-slate-300 mb-2 drop-shadow-sm" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sem Imagem</span>
                        </>
                      )}
                    </div>

                    <div className="p-5 flex flex-col flex-1">
                      {/* Nome do Material */}
                      <div className="mb-2 min-h-[40px]">
                        <h3 
                          className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-indigo-600 cursor-pointer transition-colors" 
                          title={product.name}
                          onClick={() => setEditingProductId(product.id)}
                        >
                          {product.name}
                        </h3>
                      </div>
                      
                      {/* Descrição Breve */}
                      <div className="mb-3 h-[32px]">
                        {product.description && (
                          <p className="text-xs text-slate-500 line-clamp-2">{product.description}</p>
                        )}
                      </div>

                      {/* Códigos Técnicos */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-center">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Cód. Fabr.</p>
                          <p className="text-xs font-bold text-slate-700 truncate">{product.manufacturerCode || 'ND'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-center">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Cód. interno</p>
                          <p className="text-xs font-bold text-slate-700 truncate">{product.sku || 'Não informado'}</p>
                        </div>
                      </div>

                      {/* Status e Categoria */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold text-indigo-700 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 truncate max-w-[120px]">
                          {product.category}
                        </span>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          product.isComplete 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {product.isComplete ? 'Completo' : 'Incompleto'}
                        </span>
                      </div>

                      {/* Ações: Editar e Ativar/Inativar */}
                      <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mb-3">
                        <button
                          onClick={() => setEditingProductId(product.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 py-1.5 rounded-lg transition-colors"
                        >
                          <Edit2 className="h-3 w-3" /> Editar
                        </button>
                        <button
                          onClick={() => toggleProductStatus(product)}
                          className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold py-1.5 rounded-lg transition-colors ${
                            product.status === 'Active'
                              ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                              : 'text-slate-500 hover:text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {product.status === 'Active'
                            ? <><ToggleLeft className="h-3 w-3" /> Inativar</>
                            : <><ToggleRight className="h-3 w-3" /> Ativar</>
                          }
                        </button>
                      </div>

                      {/* Botão Adicionar ao Carrinho */}
                      <div className="mt-auto">
                        <Button 
                          onClick={() => handleToggleSelect(product)}
                          disabled={product.status === 'Inactive'}
                          className={`w-full font-bold text-[11px] px-2 h-9 flex items-center justify-center transition-all border-none ${isSelected ? 'bg-indigo-700 text-white shadow-sm' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'}`}
                          variant="outline"
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          {isSelected ? 'No Carrinho' : 'Adicionar ao Carrinho'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}</>}
        </div>
      </div>

      <QuotationTypeModal 
        isOpen={isQuoteModalOpen} 
        onClose={() => setIsQuoteModalOpen(false)} 
        productNames={selectedProductNames} 
        preselectedProductIds={selectedProductIds}
      />

      {isLinkMaterialOpen && tenantId && (
        <LinkMaterialModal
          organizationId={tenantId}
          initialMaterialId={linkMaterialId}
          onClose={() => setIsLinkMaterialOpen(false)}
          onLinked={() => { void loadProducts(); if (catalogScope !== 'MINE') void loadGlobalMaterials(0); }}
        />
      )}

      {/* OVERLAY / MODAL CENTRAL DE EDIÇÃO DE MATERIAL */}
      {editingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 transition-all duration-300">
          <div className="w-full max-w-7xl h-[95vh] sm:h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <PackageOpen className="h-5 w-5 text-slate-800" />
                <h3 className="font-extrabold text-slate-800 text-lg">Editar Material</h3>
              </div>
              <button 
                onClick={() => setEditingProductId(null)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-0">
              <ProductFormPage 
                productId={editingProductId} 
                masterMaintenanceMode={masterMaintenanceMode}
                onClose={() => setEditingProductId(null)}
                onSaveSuccess={() => {
                  setEditingProductId(null);
                  loadProducts();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
