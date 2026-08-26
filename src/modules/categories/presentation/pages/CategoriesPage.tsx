import { useState, useEffect } from 'react';
import { Layers, Plus, Search, CheckCircle2, XCircle, Edit2, ToggleLeft, ToggleRight, Package } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Category, CategoryStatus } from '../../domain/entities/Category';
import { SupabaseCategoryRepository } from '../../infrastructure/repositories/SupabaseCategoryRepository';
import { supabase } from '@/infrastructure/supabase/client';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';
import { useSearchParams } from 'react-router-dom';

export function CategoryModal({
  cat, tenantId = 'GLOBAL', parents = [], initialValues, onClose, onSave,
}: {
  cat?: Category;
  tenantId?: string;
  parents?: Category[];
  initialValues?: { name?: string; description?: string; parentId?: string };
  onClose: () => void;
  onSave: (c: Category) => void;
}) {
  const [name, setName] = useState(cat?.name || initialValues?.name || '');
  const [description, setDescription] = useState(cat?.description || initialValues?.description || '');
  const [parentId, setParentId] = useState(cat?.parentId || initialValues?.parentId || '');
  const [status, setStatus] = useState(cat?.status || CategoryStatus.ACTIVE);

  const handleSave = () => {
    if (!name.trim()) return;
    
    if (cat) {
      onSave(new Category(
        cat.id,
        cat.tenantId,
        name.trim(),
        description.trim(),
        parentId || undefined,
        status,
        cat.createdAt,
        new Date()
      ));
    } else {
      onSave(new Category(
        crypto.randomUUID(),
        tenantId,
        name.trim(),
        description.trim(),
        parentId || undefined,
        status,
        new Date(),
        new Date()
      ));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h3 className="text-base font-extrabold text-slate-900">
            {cat ? 'Editar Categoria' : 'Nova Categoria'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full">
            <XCircle className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome *</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: EPI, Rolamentos, Ferramenta Elétrica..."
              className="h-9 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Categoria pai</label>
              <select
                value={parentId}
                onChange={e => setParentId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">Sem categoria pai</option>
                {parents.filter(parent => parent.id !== cat?.id).map(parent => (
                  <option key={parent.id} value={parent.id}>{parent.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as CategoryStatus)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value={CategoryStatus.ACTIVE}>Ativa</option>
                <option value={CategoryStatus.INACTIVE}>Inativa</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Descrição</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descreva a finalidade desta categoria..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
            <p className="text-[10px] font-bold text-indigo-700 flex items-center gap-1.5">
              <Layers className="h-3 w-3" />
              Categorias classificam os Materiais e Produtos movimentados pelas empresas na plataforma.
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end px-6 pb-6">
          <Button variant="outline" onClick={onClose} className="h-9 text-xs">Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold flex items-center gap-2"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> {cat ? 'Salvar' : 'Criar Categoria'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const { data: identity } = useAuthenticatedIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'Ativos' | 'Inativos'>('Todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [initialValues, setInitialValues] = useState<{ name?: string; description?: string; parentId?: string }>();
  const repo = new SupabaseCategoryRepository();
  const tenantId = identity?.isPlatformAdmin ? 'GLOBAL' : (identity?.organizationId || '');

  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  
  const loadData = async () => {
    try {
      const data = await repo.findAll(tenantId);
      setCategories(data);
      
      const { data: countsData } = await supabase
         .from('products')
         .select('category_id');
         
      if (countsData) {
        const counts = countsData.reduce((acc: Record<string, number>, row: any) => {
           acc[row.category_id] = (acc[row.category_id] || 0) + 1;
           return acc;
        }, {});
        setProductCounts(counts);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (tenantId) loadData();
  }, [tenantId]);

  useEffect(() => {
    const name = searchParams.get('prefill_name');
    if (!name || tenantId !== 'GLOBAL') return;
    setEditingCategory(undefined);
    setInitialValues({
      name,
      description: searchParams.get('prefill_description') || '',
      parentId: searchParams.get('prefill_parent_id') || undefined,
    });
    setModalOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, tenantId]);

  const handleSave = async (c: Category) => {
    try {
      await repo.save(c);
      await loadData();
      setModalOpen(false);
      setEditingCategory(undefined);
      setInitialValues(undefined);
    } catch (e: any) {
      console.error("Erro ao salvar categoria:", e);
      alert(`Erro ao salvar categoria: ${e?.message || JSON.stringify(e)}`);
    }
  };

  const toggleStatus = async (cat: Category) => {
    const newStatus = cat.status === CategoryStatus.ACTIVE ? CategoryStatus.INACTIVE : CategoryStatus.ACTIVE;
    try {
      await handleSave(new Category(
        cat.id,
        cat.tenantId,
        cat.name,
        cat.description,
        cat.parentId,
        newStatus,
        cat.createdAt,
        new Date()
      ));
    } catch (e: any) {
      console.error("Erro ao alterar status:", e);
    }
  };

  const filtered = categories.filter(c => {
    if (filterStatus === 'Ativos' && c.status !== CategoryStatus.ACTIVE) return false;
    if (filterStatus === 'Inativos' && c.status !== CategoryStatus.INACTIVE) return false;
    return c.name.toLowerCase().includes(search.toLowerCase());
  });
  useEffect(() => setPage(1), [search, filterStatus, pageSize]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleCategories = filtered.slice((page - 1) * pageSize, page * pageSize);

  const ativos = categories.filter(c => c.status === CategoryStatus.ACTIVE).length;
  const inativos = categories.filter(c => c.status === CategoryStatus.INACTIVE).length;

  return (
    <div className="space-y-6 font-sans">
      {modalOpen && (
        <CategoryModal
          cat={editingCategory}
          tenantId={tenantId}
          parents={categories.filter(category => category.status === CategoryStatus.ACTIVE)}
          initialValues={initialValues}
          onClose={() => { setModalOpen(false); setEditingCategory(undefined); setInitialValues(undefined); }}
          onSave={handleSave}
        />
      )}

      {/* HEADER UNIFICADO (LIGHT MODE) */}
      <div className="max-w-[1600px] mx-auto w-full px-6 pt-6 pb-2 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              <Layers className="h-7 w-7 text-indigo-600" />
              Gestão de Categorias
            </h1>
            <p className="text-slate-500 mt-1 text-sm max-w-2xl">
              Gerencie o catálogo global de categorias disponível para toda a Rede Hub.IA.
            </p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <Button 
              onClick={() => { setEditingCategory(undefined); setInitialValues(undefined); setModalOpen(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 font-bold shadow-md shadow-indigo-600/20"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nova Categoria
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total de Categorias</p>
            <p className="text-2xl font-black text-slate-900">{categories.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Categorias Ativas</p>
            <p className="text-2xl font-black text-emerald-600">{ativos}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Categorias Inativas</p>
            <p className="text-2xl font-black text-slate-400">{inativos}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 w-full sm:w-auto overflow-x-auto">
            <button 
              onClick={() => setFilterStatus('Todos')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filterStatus === 'Todos' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setFilterStatus('Ativos')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filterStatus === 'Ativos' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Ativos
            </button>
            <button 
              onClick={() => setFilterStatus('Inativos')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filterStatus === 'Inativos' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Inativos
            </button>
          </div>
          <div className="relative w-full sm:max-w-xl">
            <Search className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
            <ClearableInput 
              placeholder="Busque por nome da categoria..." 
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              className="pl-11 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-500 h-11 rounded-xl focus:border-indigo-500 focus:bg-white transition-colors"
            />
          </div>
        </div>
      </div>

      {/* GRID DE CATEGORIAS */}
      <div className="max-w-[1600px] mx-auto w-full px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleCategories.map(cat => (
            <Card
              key={cat.id}
              className={`rounded-2xl border shadow-sm transition-all duration-150 ${
                cat.status === CategoryStatus.ACTIVE
                  ? 'border-slate-200 hover:border-indigo-200 hover:shadow-md'
                  : 'border-slate-100 opacity-60'
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Layers className="h-5 w-5 text-indigo-600" />
                  </div>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    cat.status === CategoryStatus.ACTIVE
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {cat.status === CategoryStatus.ACTIVE ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm mb-1">{cat.name}</h3>
                <p className="text-[10px] text-slate-400 mb-1">Pai: {categories.find(item => item.id === cat.parentId)?.name || '—'}</p>
                {cat.description && (
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed line-clamp-2">{cat.description}</p>
                )}
                
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-4">
                  <Package className="h-3 w-3" />
                  <span>{productCounts[cat.id] || 0} material(is) · Criada {cat.createdAt.toLocaleDateString('pt-BR')} · Atualizada {cat.updatedAt.toLocaleDateString('pt-BR')}</span>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => { setEditingCategory(cat); setInitialValues(undefined); setModalOpen(true); }}
                    className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 py-1.5 rounded-lg transition-colors"
                  >
                    <Edit2 className="h-3 w-3" /> Editar
                  </button>
                  <button
                    onClick={() => toggleStatus(cat)}
                    className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg transition-colors ${
                      cat.status === CategoryStatus.ACTIVE
                        ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                        : 'text-slate-500 hover:text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {cat.status === CategoryStatus.ACTIVE
                      ? <><ToggleLeft className="h-3 w-3" /> Inativar</>
                      : <><ToggleRight className="h-3 w-3" /> Ativar</>
                    }
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}

        </div>
        <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 sm:flex-row">
          <div className="flex items-center gap-2 text-xs text-slate-500"><span>Itens por página</span><select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="rounded border px-2 py-1"><option>10</option><option>25</option><option>50</option><option>100</option></select></div>
          <div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</Button><span className="text-xs text-slate-500">Página {page} de {pageCount}</span><Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage(value => value + 1)}>Próxima</Button></div>
        </div>
      </div>
    </div>
  );
}
