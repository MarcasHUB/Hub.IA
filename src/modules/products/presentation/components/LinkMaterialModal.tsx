import { useEffect, useMemo, useState } from 'react';
import { Link2, Package, Search, X } from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';

type MaterialRow = {
  id: string;
  official_name: string;
  description: string | null;
  unit: string;
  manufacturer_code: string | null;
  validation_status: 'pending_review' | 'needs_correction' | 'validated';
  manufacturers: { name: string }[];
};

type CategoryRow = { id: string; name: string };

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Em análise',
  needs_correction: 'Necessita correção',
  validated: 'Validado',
};

export function LinkMaterialModal({ organizationId, onClose, onLinked }: {
  organizationId: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MaterialRow>();
  const [categoryId, setCategoryId] = useState('');
  const [internalSku, setInternalSku] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [availableForPurchase, setAvailableForPurchase] = useState(true);
  const [availableForSale, setAvailableForSale] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [materialResult, categoryResult, linksResult] = await Promise.all([
        supabase
          .from('materials')
          .select('id, official_name, description, unit, manufacturer_code, validation_status, manufacturers(name)')
          .eq('is_active', true)
          .in('validation_status', ['pending_review', 'needs_correction', 'validated'])
          .is('merged_into_material_id', null)
          .order('official_name'),
        supabase.from('categories').select('id, name').eq('is_active', true).order('name'),
        supabase.from('organization_materials').select('material_id').eq('organization_id', organizationId),
      ]);
      const firstError = materialResult.error || categoryResult.error || linksResult.error;
      if (firstError) setError(firstError.message);
      setMaterials((materialResult.data || []) as MaterialRow[]);
      setCategories((categoryResult.data || []) as CategoryRow[]);
      setLinkedIds(new Set((linksResult.data || []).map(item => item.material_id)));
      setIsLoading(false);
    };
    load();
  }, [organizationId]);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return materials.filter(material => !linkedIds.has(material.id)).filter(material => !normalized || [
      material.official_name,
      material.manufacturer_code || '',
      material.manufacturers?.[0]?.name || '',
    ].some(value => value.toLowerCase().includes(normalized)));
  }, [linkedIds, materials, search]);

  const chooseMaterial = (material: MaterialRow) => {
    setSelected(material);
    setDisplayName(material.official_name);
    setInternalSku('');
    setCategoryId('');
    setAvailableForPurchase(true);
    setAvailableForSale(false);
    setError('');
  };

  const linkMaterial = async () => {
    if (!selected) return;
    setIsSaving(true);
    setError('');
    try {
      const relationshipType = availableForSale ? 'fornecedor' : 'comprador';
      const { error: linkError } = await supabase.from('organization_materials').upsert({
        organization_id: organizationId,
        material_id: selected.id,
        category_id: categoryId || null,
        internal_sku: internalSku.trim() || null,
        erp_code: internalSku.trim() || null,
        display_name: displayName.trim() || selected.official_name,
        available_for_purchase: availableForPurchase,
        available_for_sale: availableForSale,
        commercial_config: {},
        logistics_config: {},
        relationship_type: relationshipType,
        is_active: true,
      }, { onConflict: 'organization_id,material_id' });
      if (linkError) throw linkError;

      const existingProduct = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('material_id', selected.id)
        .limit(1)
        .maybeSingle();
      if (existingProduct.error) throw existingProduct.error;

      if (!existingProduct.data) {
        const { error: productError } = await supabase.from('products').insert({
          organization_id: organizationId,
          material_id: selected.id,
          category_id: categoryId || null,
          sku: internalSku.trim() || null,
          name: displayName.trim() || selected.official_name,
          description: selected.description,
          unit: selected.unit || 'UN',
          manufacturer_code: selected.manufacturer_code,
          available_for_purchase: availableForPurchase,
          available_for_sale: availableForSale,
          metadata: {
            manufacturer: selected.manufacturers?.[0]?.name || '',
            manufacturer_code: selected.manufacturer_code || '',
            available_for_purchase: availableForPurchase,
            available_for_sale: availableForSale,
            status: 'Active',
          },
        });
        if (productError) throw productError;
      }

      setLinkedIds(current => new Set([...current, selected.id]));
      setSelected(undefined);
      onLinked();
    } catch (caught: any) {
      setError(caught?.message || 'Não foi possível vincular o material.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div><h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><Link2 className="h-5 w-5 text-indigo-600" /> Vincular material</h3><p className="text-xs text-slate-500">Use um material canônico existente sem criar duplicatas.</p></div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[1.2fr_0.8fr]">
          <div className="flex min-h-0 flex-col border-r p-5">
            <div className="relative mb-4"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><ClearableInput value={search} onChange={setSearch} onClear={() => setSearch('')} placeholder="Buscar por nome, fabricante ou código..." className="pl-9" /></div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {isLoading && <p className="py-12 text-center text-sm text-slate-500">Carregando catálogo compartilhado...</p>}
              {!isLoading && filtered.map(material => (
                <button key={material.id} onClick={() => chooseMaterial(material)} className={`w-full rounded-xl border p-4 text-left transition-colors ${selected?.id === material.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200'}`}>
                  <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{material.official_name}</p><p className="mt-1 text-xs text-slate-500">{material.manufacturers?.[0]?.name || 'Sem fabricante'} · {material.manufacturer_code || 'Sem código'}</p></div><span className="shrink-0 rounded-full border bg-white px-2 py-1 text-[10px] font-bold text-slate-600">{STATUS_LABELS[material.validation_status]}</span></div>
                </button>
              ))}
              {!isLoading && filtered.length === 0 && <div className="py-12 text-center"><Package className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm text-slate-500">Nenhum material disponível para vínculo.</p></div>}
            </div>
          </div>

          <div className="overflow-y-auto p-5">
            {!selected ? <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">Selecione um material para configurar o vínculo da sua empresa.</div> : (
              <div className="space-y-4">
                <div><p className="text-[10px] font-bold uppercase text-slate-400">Material selecionado</p><p className="font-bold text-slate-900">{selected.official_name}</p></div>
                <div><label className="mb-1 block text-xs font-bold text-slate-500">Nome de exibição</label><Input value={displayName} onChange={event => setDisplayName(event.target.value)} /></div>
                <div><label className="mb-1 block text-xs font-bold text-slate-500">SKU / código ERP</label><Input value={internalSku} onChange={event => setInternalSku(event.target.value)} placeholder="Código interno opcional" /></div>
                <div><label className="mb-1 block text-xs font-bold text-slate-500">Categoria</label><select value={categoryId} onChange={event => setCategoryId(event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm"><option value="">Sem categoria</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
                <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={availableForPurchase} onChange={event => setAvailableForPurchase(event.target.checked)} /><span><strong className="block">Disponível para compra</strong><span className="text-xs text-slate-500">A empresa compra ou deseja cotar este material.</span></span></label>
                <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={availableForSale} onChange={event => setAvailableForSale(event.target.checked)} /><span><strong className="block">Disponível para venda</strong><span className="text-xs text-slate-500">A empresa comercializa este material.</span></span></label>
                {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
                <Button onClick={linkMaterial} disabled={isSaving || (!availableForPurchase && !availableForSale)} className="w-full bg-indigo-600 text-white">{isSaving ? 'Vinculando...' : 'Vincular material'}</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
