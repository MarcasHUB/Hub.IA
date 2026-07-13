import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/Badge';
import { Search, Plus, Upload, Filter, ShoppingCart, PackageOpen, MoreVertical, ImageOff } from 'lucide-react';
import { QuotationTypeModal } from '@/modules/quotations/presentation/components/QuotationTypeModal';
import { SupabaseProductRepository } from '../../infrastructure/repositories/SupabaseProductRepository';

const repo = new SupabaseProductRepository();

interface Product {
  id: string;
  name: string;
  sku: string;
  supplier: string;
  category: string;
  manufacturer: string;
  price: number;
  status: 'Active' | 'Draft';
  updatedAt: string;
  description?: string;
  imageUrl?: string;
}

export default function ProductsListPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);

  // Tenant ID mockado temporariamente (em produção virá do auth context)
  const tenantId = '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await repo.findAll(tenantId);
        // Map domain to UI format
        setProducts(data.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          supplier: p.supplierId || 'Fornecedor',
          category: p.categoryId || 'Categoria',
          manufacturer: p.manufacturer || 'Desconhecido',
          price: p.price,
          status: p.status === 'Draft' ? 'Draft' : 'Active',
          updatedAt: p.updatedAt.toISOString().split('T')[0],
          description: p.description
        })));
      } catch (err) {
        console.error('Failed to load products', err);
      }
    }
    loadProducts();
  }, []);
  
  const [search, setSearch] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const s = search.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(s) || 
      p.sku.toLowerCase().includes(s) ||
      p.manufacturer.toLowerCase().includes(s)
    );
  }, [products, search]);

  const handleToggleSelect = (id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectedProductNames = useMemo(() => {
    const selected = products.filter(p => selectedProductIds.includes(p.id));
    return selected.map(p => p.name).join(', ');
  }, [selectedProductIds, products]);

  return (
    <div className="flex-1 bg-slate-50 min-h-full flex flex-col font-sans">
      
      {/* HEADER BANNER - Azul Escuro */}
      <div className="bg-slate-900 rounded-[2rem] mx-4 sm:mx-6 mt-6 mb-2 px-6 py-8 shadow-xl">
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
              <Button variant="outline" className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 h-10 px-4 font-bold shadow-sm">
                <Upload className="h-4 w-4 mr-2 text-indigo-400" />
                Importar em Massa
              </Button>
              <Button onClick={() => navigate('/products/new')} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 font-bold shadow-md shadow-indigo-900/20">
                <Plus className="h-4 w-4 mr-1.5" />
                Novo Produto
              </Button>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
              <Input 
                placeholder="Busque por Nome, SKU, Fabricante..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12 rounded-xl focus:border-indigo-500 shadow-inner"
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
            <Button variant="ghost" onClick={() => setSelectedProductIds([])} className="text-slate-400 hover:text-white hover:bg-slate-800 text-xs">
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
              <Button onClick={() => navigate('/products/new')} className="mt-6 bg-indigo-600 hover:bg-indigo-700 font-bold">
                <Plus className="h-4 w-4 mr-1.5" /> Adicionar Primeiro Produto
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
              {filteredProducts.map(product => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <div 
                    key={product.id}
                    className={`group relative bg-white border rounded-3xl overflow-hidden transition-all duration-200 ${isSelected ? 'border-indigo-500 shadow-md shadow-indigo-100 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}
                  >
                    {/* Imagem Cover / Placeholder */}
                    <div className="aspect-[4/3] w-full bg-slate-50 border-b border-slate-100 flex flex-col items-center justify-center relative overflow-hidden group-hover:bg-slate-100/50 transition-colors">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-900 to-transparent"></div>
                          <ImageOff className="h-12 w-12 text-slate-300 mb-2 drop-shadow-sm" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sem Imagem</span>
                        </>
                      )}
                      
                      <div className="absolute top-3 right-3 flex gap-2">
                        <div className="relative">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === product.id ? null : product.id); }}
                            className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          
                          {/* Dropdown Menu */}
                          {activeMenu === product.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)}></div>
                              <div className="absolute right-0 top-10 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                                <button 
                                  onClick={() => navigate(`/products/${product.id}/edit`)}
                                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 font-medium"
                                >
                                  Editar Produto
                                </button>
                                <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium">
                                  Excluir
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-5 flex flex-col h-full">
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-[10px] font-bold bg-slate-50 text-slate-600 border-slate-200 uppercase tracking-wider">
                            SKU: {product.sku}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-bold bg-blue-50 text-blue-600 border-blue-200">
                            {product.category}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-slate-900 leading-snug line-clamp-2" title={product.name}>
                          {product.name}
                        </h3>
                      </div>

                      <div className="mt-auto space-y-3 pt-4 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-500">Fab: <strong className="text-slate-700">{product.manufacturer}</strong></span>
                        </div>
                        
                        <Button 
                          onClick={() => handleToggleSelect(product.id)}
                          className={`w-full font-bold h-10 ${isSelected ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'}`}
                          variant="outline"
                        >
                          {isSelected ? 'Na Requisição' : 'Adicionar à RC'}
                        </Button>
                      </div>
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
        selectedProductIds={selectedProductIds}
      />
    </div>
  );
}
