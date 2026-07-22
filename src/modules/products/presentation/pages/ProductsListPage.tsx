import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';
import { Badge } from '@/shared/components/ui/Badge';
import { Search, Plus, Upload, Filter, ShoppingCart, PackageOpen, MoreVertical, ImageOff, X } from 'lucide-react';
import { QuotationTypeModal } from '@/modules/quotations/presentation/components/QuotationTypeModal';
import { useQuotationCart } from '@/modules/quotations/presentation/context/QuotationCartContext';
import { SupabaseProductRepository } from '../../infrastructure/repositories/SupabaseProductRepository';
import ProductFormPage from './ProductFormPage';

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
  status: 'Active' | 'Draft';
  updatedAt: string;
  description?: string;
  imageUrl?: string;
  availableForPurchase: boolean;
  isComplete: boolean;
  manufacturerCode: string;
  supplierId: string;
}

export default function ProductsListPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Tenant ID mockado temporariamente (em produção virá do auth context)
  const tenantId = '00000000-0000-0000-0000-000000000000';
  const [isSupplier, setIsSupplier] = useState(false);

  async function loadProducts() {
    try {
      const { supabase } = await import('@/infrastructure/supabase/client');
      const localTenant = localStorage.getItem('supplyhub_organization_id');
      if (localTenant) {
        const { data: orgData } = await supabase.from('organizations').select('company_role').eq('id', localTenant).single();
        if (orgData?.company_role === 'seller' || orgData?.company_role === 'both') {
          setIsSupplier(true);
        }
      }

      const data = await repo.findAll(tenantId);
      // Map domain to UI format
      setProducts(data.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.uom || 'UN',
        partNumber: 'PN-' + p.sku,
        supplier: p.supplierId || 'Fornecedor',
        category: p.categoryName || 'Sem segmento',
        manufacturer: p.manufacturer || 'Desconhecido',
        price: p.price,
        status: p.status === 'Draft' ? 'Draft' : 'Active',
        updatedAt: p.updatedAt.toISOString().split('T')[0],
        description: p.description,
        imageUrl: p.imageUrl,
        availableForPurchase: p.availableForPurchase ?? true,
        isComplete: p.isComplete,
        manufacturerCode: p.manufacturerCode || '',
        supplierId: p.supplierId || ''
      })));
    } catch (err) {
      console.error('Failed to load products', err);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);
  
  const [search, setSearch] = useState('');
  const { items, addItem, removeItem, clearCart } = useQuotationCart();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  const selectedProductIds = useMemo(() => items.map(item => item.productId), [items]);

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const s = search.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(s) || 
      p.sku.toLowerCase().includes(s) ||
      p.manufacturer.toLowerCase().includes(s)
    );
  }, [products, search]);

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
      
      {/* HEADER BANNER - Azul Escuro */}
      <div className="bg-slate-900 rounded-2xl mx-6 mt-6 mb-4 px-8 py-8 shadow-md">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                Catálogo de Suprimentos
              </h1>
              <p className="text-slate-400 mt-1 text-sm max-w-2xl">
                Gerencie materiais, cadastre novos itens ou importe em lote.
              </p>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              {isSupplier ? (
                <Button onClick={() => alert('Vincular Material ainda será implementado')} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 font-bold shadow-md shadow-indigo-900/20">
                  <Search className="h-4 w-4 mr-1.5" />
                  Vincular Material
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 h-10 px-4 font-bold shadow-sm">
                    <Upload className="h-4 w-4 mr-2 text-indigo-400" />
                    Importar em Massa
                  </Button>
                  <Button onClick={() => navigate('/products/new')} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 font-bold shadow-md shadow-indigo-900/20">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Novo Produto
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
              <ClearableInput 
                placeholder="Busque por Nome, SKU, Fabricante..." 
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                className="pl-11 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-11 rounded-xl focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-9 text-xs font-semibold rounded-lg border-slate-200 text-slate-700">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" /> Todas as categorias
            </Button>
            <Button variant="outline" className="h-9 text-xs font-semibold rounded-lg border-slate-200 text-slate-700">
              Todos os fornecedores
            </Button>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
            {filteredProducts.length} itens encontrados
          </span>
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
        <div className="max-w-[1600px] mx-auto">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4 border border-slate-200">
                <PackageOpen className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Nenhum produto encontrado.</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                Cadastre novos itens ou importe sua planilha de materiais para começar a gerenciar seu catálogo.
              </p>
              {isSupplier ? (
                <Button onClick={() => alert('Vincular Material ainda será implementado')} className="mt-6 bg-indigo-600 hover:bg-indigo-700 font-bold">
                  <Search className="h-4 w-4 mr-1.5" /> Adicionar Primeiro Produto
                </Button>
              ) : (
                <Button onClick={() => navigate('/products/new')} className="mt-6 bg-indigo-600 hover:bg-indigo-700 font-bold">
                  <Plus className="h-4 w-4 mr-1.5" /> Adicionar Primeiro Produto
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-24">
              {filteredProducts.map(product => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <div 
                    key={product.id}
                    className={`group relative bg-white border rounded-2xl flex flex-col transition-all duration-150 ease-out hover:-translate-y-[2px] hover:shadow-lg hover:border-slate-300 ${isSelected ? 'border-indigo-500 shadow-md shadow-indigo-100 ring-1 ring-indigo-500' : 'border-slate-200 hover:shadow-sm'}`}
                  >
                    {/* Imagem Cover / Placeholder */}
                    <div className="aspect-[4/3] w-full bg-slate-50 border-b border-slate-100 flex flex-col items-center justify-center relative rounded-t-2xl group-hover:bg-slate-100/50 transition-colors">
                      {/* Categoria Badge - Top Left */}
                      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
                        <Badge variant="outline" className="bg-white text-indigo-600 border-slate-200 font-medium px-2 py-0.5 rounded-lg shadow-sm text-[10px]">
                          {product.category}
                        </Badge>
                        {product.isComplete ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium px-2 py-0.5 rounded-lg shadow-sm text-[10px] w-fit">
                            Completo
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1.5 group/tooltip relative">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse border-2 border-white shadow-sm shadow-red-500/50"></div>
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-medium px-2 py-0.5 rounded-lg shadow-sm text-[10px] w-fit cursor-help">
                              Incompleto
                            </Badge>
                            
                            {/* Tooltip */}
                            <div className="absolute left-0 top-full mt-1 w-48 bg-slate-900 text-white text-[10px] p-2 rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none shadow-xl border border-slate-800">
                              Cadastro incompleto. Faltam informações obrigatórias.
                            </div>
                          </div>
                        )}
                      </div>

                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-t-2xl" />
                      ) : (
                        <>
                          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-900 to-transparent"></div>
                          <ImageOff className="h-12 w-12 text-slate-300 mb-2 drop-shadow-sm" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sem Imagem</span>
                        </>
                      )}
                      
                      <div className="absolute top-3 right-3 flex gap-2">
                        <div className="relative z-20">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === product.id ? null : product.id); }}
                            className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          
                          {/* Dropdown Menu */}
                          {activeMenu === product.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setActiveMenu(null); }}></div>
                              <div className="absolute right-0 top-10 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 overflow-hidden" onClick={e => e.stopPropagation()}>
                                <button 
                                  onClick={() => {
                                    setActiveMenu(null);
                                    setEditingProductId(product.id);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 font-medium"
                                >
                                  Editar Material
                                </button>
                                <button 
                                  onClick={async () => {
                                    setActiveMenu(null);
                                    if (window.confirm('Tem certeza que deseja inativar/excluir este material?')) {
                                      try {
                                        await repo.delete(product.id, tenantId);
                                        alert('O material foi inativado/excluído com sucesso.');
                                        loadProducts();
                                      } catch (e: any) {
                                        console.error(e);
                                        alert(e.message || 'Erro ao excluir material.');
                                      }
                                    }
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium"
                                >
                                  Excluir
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group/sku relative cursor-help">
                          Cód. Fab: {product.manufacturerCode || 'ND'}
                          {product.sku && (
                             <span className="absolute bottom-full left-0 mb-1 w-max opacity-0 invisible group-hover/sku:opacity-100 group-hover/sku:visible bg-slate-800 text-white text-[10px] py-1 px-2 rounded transition-all z-10 pointer-events-none">
                               SKU Revenda: {product.sku}
                             </span>
                          )}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-bold bg-slate-50 text-slate-600 border-slate-200">
                          {product.unit}
                        </Badge>
                      </div>

                      <div className="mb-2.5">
                        <h3 
                          className="font-bold text-slate-900 leading-snug line-clamp-2 hover:text-indigo-600 cursor-pointer transition-colors" 
                          title={product.name}
                          onClick={() => setEditingProductId(product.id)}
                        >
                          {product.name}
                        </h3>
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[9px] font-medium text-slate-500">Fab: {product.manufacturer || 'ND'}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[9px] font-medium text-slate-500">PN: {product.manufacturerCode || 'ND'}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[9px] font-medium text-slate-500">Fornec: {product.supplierId || 'ND'}</span>
                      </div>

                      {product.description && (
                        <p className="text-xs text-slate-500 mb-3 line-clamp-1">{product.description}</p>
                      )}

                      {product.availableForPurchase && (
                        <div className="mt-auto pt-2">
                          <Button 
                            onClick={() => handleToggleSelect(product)}
                            className={`w-full font-bold h-9 transition-all border-none ${isSelected ? 'bg-indigo-700 text-white shadow-sm' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                            variant="outline"
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            {isSelected ? 'No Carrinho' : 'Adicionar ao Carrinho'}
                          </Button>
                        </div>
                      )}
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
        productNames={selectedProductNames} 
        preselectedProductIds={selectedProductIds}
      />

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
