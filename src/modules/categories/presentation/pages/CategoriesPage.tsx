import { useState, useEffect } from 'react';
import { Layers, Plus, CheckCircle2, XCircle, Edit2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
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
      const tenantId = localStorage.getItem('supplyhub_organization_id') || '00000000-0000-0000-0000-000000000000';
      onSave(new Category(
        crypto.randomUUID(),
        tenantId,
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
              placeholder="Ex: EPI, Ferramentas, Tintas..."
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Descrição</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descreva a categoria..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
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
    } catch (e) {
      alert("Erro ao salvar categoria");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Categorias de Materiais</h2>
          <p className="text-sm text-slate-500 mt-1">Gerencie as categorias dos materiais utilizados na sua empresa.</p>
        </div>
        <Button 
          onClick={() => { setEditingCategory(undefined); setModalOpen(true); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-5 rounded-xl font-bold"
        >
          <Plus className="h-4 w-4 mr-2" /> Nova Categoria
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map(cat => (
          <Card key={cat.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{cat.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{cat.description || 'Sem descrição'}</p>
                </div>
                <button
                  onClick={() => { setEditingCategory(cat); setModalOpen(true); }}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12">
          <Layers className="h-12 w-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">Nenhuma categoria encontrada</h3>
          <p className="text-sm text-slate-500 mt-1">Clique em "Nova Categoria" para começar.</p>
        </div>
      )}

      {modalOpen && (
        <CategoryModal
          cat={editingCategory}
          onClose={() => { setModalOpen(false); setEditingCategory(undefined); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
