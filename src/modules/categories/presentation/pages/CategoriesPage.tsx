import { useState, useEffect } from 'react';
import { Layers, Plus, Search, CheckCircle2, XCircle, Edit2, ToggleLeft, ToggleRight, Package } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Category, CategoryStatus } from '../../domain/entities/Category';
import { SupabaseCategoryRepository } from '../../infrastructure/repositories/SupabaseCategoryRepository';

function CategoryModal({
  cat, onClose, onSave,
}: {
  cat?: Category;
  onClose: () => void;
  onSave: (c: Category) => void;
}) {
  const [name, setName] = useState(cat?.name || '');
  const [description, setDescription] = useState(cat?.description || '');

  const handleSave = () => {
    if (!name.trim()) return;
    
    if (cat) {
      onSave(new Category(
        cat.id,
        cat.tenantId,
        name.trim(),
        description.trim(),
        cat.parentId,
        cat.status,
        cat.createdAt,
        new Date()
      ));
    } else {
      onSave(new Category(
        crypto.randomUUID(),
        'GLOBAL',
        name.trim(),
        description.trim(),
        undefined,
        CategoryStatus.ACTIVE,
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const repo = new SupabaseCategoryRepository();
  const tenantId = localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';

  const loadData = async () => {
    try {
      const data = await repo.findAll(tenantId);
      setCategories(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (c: Category) => {
    try {
      await repo.save(c);
      await loadData();
      setModalOpen(false);
      setEditingCategory(undefined);
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

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const ativos = categories.filter(c => c.status === CategoryStatus.ACTIVE).length;
  const inativos = categories.filter(c => c.status === CategoryStatus.INACTIVE).length;

  return (
    <div className="space-y-6 font-sans">
      {modalOpen && (
        <CategoryModal
          cat={editingCategory}
          onClose={() => { setModalOpen(false); setEditingCategory(undefined); }}
          onSave={handleSave}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total de Categorias', value: categories.length, color: 'text-slate-900', desc: 'Categorias cadastradas' },
          { label: 'Ativas', value: ativos, color: 'text-green-600', desc: 'Categorias em uso' },
          { label: 'Inativas', value: inativos, color: 'text-slate-400', desc: 'Categorias desativadas' },
        ].map(item => (
          <Card key={item.label} className="rounded-2xl border-slate-200 shadow-sm bg-white">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className={`text-2xl font-extrabold mt-1 ${item.color}`}>{item.value}</p>
              <p className="text-[10px] text-slate-400 mt-1">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros e Ações */}
      <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
        <CardContent className="p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <ClearableInput
              placeholder="Buscar categoria..."
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
              className="pl-10 h-10 text-sm"
            />
          </div>
          <Button
            onClick={() => { setEditingCategory(undefined); setModalOpen(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 text-sm font-bold flex items-center gap-2 shrink-0 w-full sm:w-auto rounded-xl"
          >
            <Plus className="h-4 w-4" /> Nova Categoria
          </Button>
        </CardContent>
      </Card>

      {/* GRID DE CATEGORIAS */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(cat => (
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
                {cat.description && (
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed line-clamp-2">{cat.description}</p>
                )}
                
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-4">
                  <Package className="h-3 w-3" />
                  <span>0 material(is)</span>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => { setEditingCategory(cat); setModalOpen(true); }}
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

          {/* Card de nova categoria */}
          <button
            onClick={() => { setEditingCategory(undefined); setModalOpen(true); }}
            className="rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-150 p-5 flex flex-col items-center justify-center gap-2 min-h-[160px] group"
          >
            <div className="h-10 w-10 rounded-xl bg-slate-100 group-hover:bg-indigo-100 transition-colors flex items-center justify-center">
              <Plus className="h-5 w-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </div>
            <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-700 transition-colors">Nova Categoria</span>
          </button>
        </div>
      </div>
    </div>
  );
}
