import { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Edit2, Plus, Search, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/infrastructure/supabase/client';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { ClearableInput } from '@/shared/components/ui/ClearableInput';

type Certification = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function CertificationModal({ certification, initialValues, onClose, onSave, isSaving }: {
  certification?: Certification;
  initialValues?: { name?: string; description?: string };
  onClose: () => void;
  onSave: (values: { name: string; description: string; is_active: boolean }) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(certification?.name || initialValues?.name || '');
  const [description, setDescription] = useState(certification?.description || initialValues?.description || '');
  const [isActive, setIsActive] = useState(certification?.is_active ?? true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="font-extrabold text-slate-900">{certification ? 'Editar Certificação' : 'Nova Certificação'}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome *</label>
            <Input value={name} onChange={event => setName(event.target.value)} placeholder="Ex: ISO 9001" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Descrição</label>
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Descreva a certificação."
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</label>
            <select value={isActive ? 'active' : 'inactive'} onChange={event => setIsActive(event.target.value === 'active')} className="h-10 w-full rounded-md border px-3 text-sm">
              <option value="active">Ativa</option>
              <option value="inactive">Inativa</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onSave({ name: name.trim(), description: description.trim(), is_active: isActive })}
            disabled={!name.trim() || isSaving}
            className="bg-indigo-600 text-white"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CertificationsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'name' | 'created_at'>('name');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Certification>();
  const [modalOpen, setModalOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<{ name?: string; description?: string }>();

  const { data: certifications = [], isLoading } = useQuery({
    queryKey: ['admin-certifications'],
    queryFn: async () => {
      const { data, error } = await supabase.from('certifications').select('*').order('name');
      if (error) throw error;
      return (data || []) as Certification[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: { id?: string; name: string; description: string; is_active: boolean }) => {
      const { id, ...fields } = values;
      const payload = { ...fields, description: fields.description || null };
      const result = id
        ? await supabase.from('certifications').update(payload).eq('id', id)
        : await supabase.from('certifications').insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-certifications'] });
      setModalOpen(false);
      setEditing(undefined);
      setInitialValues(undefined);
    },
    onError: (error: any) => alert(error?.code === '23505' ? 'Esta certificação já existe no catálogo.' : `Erro ao salvar certificação: ${error?.message || error}`),
  });

  useEffect(() => {
    const name = searchParams.get('prefill_name');
    if (!name) return;
    setInitialValues({ name, description: searchParams.get('prefill_description') || '' });
    setEditing(undefined);
    setModalOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const filtered = useMemo(() => certifications
    .filter(item => statusFilter === 'all' || item.is_active === (statusFilter === 'active'))
    .filter(item => !search || `${item.name} ${item.description || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : b.created_at.localeCompare(a.created_at)),
  [certifications, search, sort, statusFilter]);

  useEffect(() => setPage(1), [search, statusFilter, pageSize]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeCount = certifications.filter(item => item.is_active).length;

  return (
    <div className="space-y-6 p-6">
      {modalOpen && (
        <CertificationModal
          certification={editing}
          initialValues={initialValues}
          isSaving={saveMutation.isPending}
          onClose={() => { setModalOpen(false); setEditing(undefined); setInitialValues(undefined); }}
          onSave={values => saveMutation.mutate({ ...values, id: editing?.id })}
        />
      )}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-extrabold text-slate-900"><Award className="h-7 w-7 text-indigo-600" /> Gestão de Certificações</h1>
          <p className="mt-1 text-sm text-slate-500">Gerencie o catálogo global disponível para todas as empresas da Rede Hub.IA.</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setInitialValues(undefined); setModalOpen(true); }} className="bg-indigo-600 text-white">
          <Plus className="mr-2 h-4 w-4" /> Nova certificação
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-400">Total</p><p className="text-2xl font-black">{certifications.length}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-400">Ativas</p><p className="text-2xl font-black text-emerald-600">{activeCount}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-400">Inativas</p><p className="text-2xl font-black text-slate-400">{certifications.length - activeCount}</p></div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><ClearableInput value={search} onChange={setSearch} onClear={() => setSearch('')} placeholder="Buscar certificação..." className="pl-9" /></div>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as any)} className="h-10 rounded-md border px-3 text-sm"><option value="all">Todos os status</option><option value="active">Ativas</option><option value="inactive">Inativas</option></select>
        <select value={sort} onChange={event => setSort(event.target.value as any)} className="h-10 rounded-md border px-3 text-sm"><option value="name">Ordenar por nome</option><option value="created_at">Mais recentes</option></select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50"><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Criado em</th><th className="px-4 py-3">Ações</th></tr></thead>
            <tbody>
              {rows.map(item => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-bold text-slate-800">{item.name}</td>
                  <td className="max-w-md px-4 py-3 text-slate-500">{item.description || '—'}</td>
                  <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${item.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{item.is_active ? 'Ativa' : 'Inativa'}</span></td>
                  <td className="px-4 py-3 text-slate-500">{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setEditing(item); setModalOpen(true); }}><Edit2 className="mr-1 h-3 w-3" /> Editar</Button><Button size="sm" variant="ghost" onClick={() => saveMutation.mutate({ id: item.id, name: item.name, description: item.description || '', is_active: !item.is_active })}>{item.is_active ? <ToggleLeft className="mr-1 h-3 w-3" /> : <ToggleRight className="mr-1 h-3 w-3" />}{item.is_active ? 'Inativar' : 'Ativar'}</Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="p-8 text-center text-slate-500">Carregando certificações...</div>}
        {!isLoading && rows.length === 0 && <div className="p-8 text-center text-slate-500">Nenhuma certificação encontrada.</div>}
        <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
          <div className="flex items-center gap-2 text-xs text-slate-500"><span>Itens por página</span><select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="rounded border px-2 py-1"><option>10</option><option>25</option><option>50</option><option>100</option></select></div>
          <div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</Button><span className="text-xs text-slate-500">Página {page} de {pageCount}</span><Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage(value => value + 1)}>Próxima</Button></div>
        </div>
      </div>
    </div>
  );
}
