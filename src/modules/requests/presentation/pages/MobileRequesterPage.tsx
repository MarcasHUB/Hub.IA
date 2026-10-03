import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, Camera, CheckCircle2, ChevronRight, ClipboardList, Clock3,
  Image as ImageIcon, LogOut, PackageSearch, Plus, RefreshCw, Search,
  Smartphone, Trash2, UserRound, X,
} from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';
import { usePrivateSession } from '@/modules/auth/presentation/context/PrivateSessionBoundary';

type RequestStatus = 'pendente'|'em_aprovacao'|'aprovada'|'rejeitada'|'em_cotacao'|'pedido_emitido'|'entregue'|'cancelada';
type Priority = 'normal'|'emergencial';

type MaterialOption = {
  material_id: string;
  name: string;
  description: string | null;
  unit: string;
  internal_sku: string | null;
  erp_code: string | null;
  category_id: string | null;
  linked_to_company?: boolean;
};

type RequestItemSummary = {
  id: string;
  description: string;
  quantity: number;
  uom: string;
  item_notes: string | null;
  photo_path: string | null;
};

type InternalRequest = {
  id: string;
  priority: string;
  status: RequestStatus;
  expected_date: string | null;
  department: string | null;
  notes: string | null;
  created_at: string;
  internal_request_items?: RequestItemSummary[] | null;
  quotation_id?: string | null;
  quotation_title?: string | null;
  quotation_status?: string | null;
  quotation_destination_label?: string | null;
  quotation_destinations?: string[];
};

type DraftItem = {
  id: string;
  material_id: string | null;
  material_name: string;
  description: string;
  quantity: string;
  uom: string;
  notes: string;
  photo: File | null;
};

const STATUS_LABEL: Record<RequestStatus,string> = {
  pendente:'Recebida', em_aprovacao:'Em aprovação', aprovada:'Aprovada',
  rejeitada:'Rejeitada', em_cotacao:'Em cotação', pedido_emitido:'Pedido emitido',
  entregue:'Entregue', cancelada:'Cancelada',
};

const newItem = (): DraftItem => ({
  id: crypto.randomUUID(), material_id:null, material_name:'', description:'',
  quantity:'1', uom:'UN', notes:'', photo:null,
});

export default function MobileRequesterPage() {
  const navigate = useNavigate();
  const { data: identity } = useAuthenticatedIdentity();
  const { transitionTo } = usePrivateSession();
  const [requests,setRequests] = useState<InternalRequest[]>([]);
  const [materials,setMaterials] = useState<MaterialOption[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [showNew,setShowNew] = useState(false);
  const [materialSearch,setMaterialSearch] = useState('');
  const [catalogItemId,setCatalogItemId] = useState<string|null>(null);
  const [priority,setPriority] = useState<Priority>('normal');
  const [expectedDate,setExpectedDate] = useState('');
  const [department,setDepartment] = useState('');
  const [notes,setNotes] = useState('');
  const [items,setItems] = useState<DraftItem[]>([newItem()]);
  const [selectedRequest,setSelectedRequest] = useState<InternalRequest|null>(null);
  const [requestPhotos,setRequestPhotos] = useState<Record<string,string>>({});

  const load = async () => {
    if (!identity?.userId) return;
    setLoading(true);
    setError('');
    const [requestsResult,materialsResult,progressResult] = await Promise.all([
      supabase.from('internal_requests')
        .select('id, priority, status, expected_date, department, notes, created_at, internal_request_items(id,description,quantity,uom,item_notes,photo_path)')
        .eq('requester_id',identity.userId).order('created_at',{ascending:false}),
      (supabase as any).rpc('get_requestable_materials'),
      (supabase as any).rpc('get_my_app_campo_quotation_progress'),
    ]);
    if (requestsResult.error) setError('Não foi possível carregar suas solicitações.');
    const progressRows=(Array.isArray(progressResult.data) ? progressResult.data : []) as Array<{
      request_id:string;
      quotation_id:string|null;
      quotation_title:string|null;
      quotation_status:string|null;
      destination_label:string|null;
      destinations:string[];
    }>;
    const progressByRequest=new Map(progressRows.map(row=>[row.request_id,row]));
    const enriched=((requestsResult.data || []) as InternalRequest[]).map(request=>{
      const progress=progressByRequest.get(request.id);
      return {
        ...request,
        quotation_id:progress?.quotation_id||null,
        quotation_title:progress?.quotation_title||null,
        quotation_status:progress?.quotation_status||null,
        quotation_destination_label:progress?.destination_label||null,
        quotation_destinations:progress?.destinations||[],
      };
    });
    setRequests(enriched);
    setMaterials((Array.isArray(materialsResult.data) ? materialsResult.data : []) as MaterialOption[]);
    setLoading(false);
  };

  useEffect(()=>{ void load(); },[identity?.userId]);

  const filteredMaterials = useMemo(()=>{
    const q=materialSearch.trim().toLowerCase();
    if (!q) return materials.slice(0,20);
    return materials.filter(m =>
      [m.name,m.description,m.internal_sku,m.erp_code].some(v=>String(v||'').toLowerCase().includes(q))
    ).slice(0,30);
  },[materials,materialSearch]);

  const stats=useMemo(()=>({
    open:requests.filter(r=>['pendente','em_aprovacao','aprovada','em_cotacao','pedido_emitido'].includes(r.status)).length,
    quote:requests.filter(r=>r.status==='em_cotacao').length,
    done:requests.filter(r=>r.status==='entregue').length,
  }),[requests]);

  const reset=()=>{setPriority('normal');setExpectedDate('');setDepartment('');setNotes('');setItems([newItem()]);setMaterialSearch('');setCatalogItemId(null);setError('');};
  const close=()=>{if(!saving){setShowNew(false);reset();}};
  const patchItem=(id:string,patch:Partial<DraftItem>)=>setItems(v=>v.map(i=>i.id===id?{...i,...patch}:i));
  const selectMaterial=(itemId:string,m:MaterialOption)=>{
    patchItem(itemId,{
      material_id:m.material_id,
      material_name:m.name,
      description:m.description?.trim() || m.name,
      uom:m.unit||'UN'
    });
    setMaterialSearch('');
    setCatalogItemId(null);
  };

  const uploadPhoto = async (requestId:string,item:DraftItem) => {
    if (!item.photo || !identity) return null;
    const safeName=item.photo.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path=`${identity.organizationId}/${requestId}/${item.id}-${safeName}`;
    const { error: uploadError }=await supabase.storage.from('request-attachments').upload(path,item.photo,{upsert:false});
    if(uploadError) throw uploadError;
    return path;
  };

  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    if(!identity) return;
    if(!expectedDate){setError('Informe a data necessária para recebimento.');return;}
    if(items.some(i=>!i.description.trim()||Number(i.quantity.replace(',','.'))<=0)){
      setError('Preencha material/descrição e quantidade de todos os itens.');return;
    }
    setSaving(true);setError('');
    try{
      const {data:created,error:createError}=await supabase.from('internal_requests').insert({
        organization_id:identity.organizationId,requester_id:identity.userId,
        requested_by_name:identity.fullName,priority,status:'pendente',expected_date:expectedDate,
        department:department.trim()||null,notes:notes.trim()||null,
      }).select('id').single();
      if(createError||!created?.id) throw createError||new Error('REQUEST_CREATE_FAILED');

      const rows=[];
      for(const item of items){
        const photoPath=await uploadPhoto(created.id,item);
        rows.push({
          request_id:created.id,material_id:item.material_id,description:item.description.trim(),
          quantity:Number(item.quantity.replace(',','.')),uom:item.uom.trim().toUpperCase()||'UN',
          category_id:null,product_id:null,photo_path:photoPath,item_notes:item.notes.trim()||null,
        });
      }
      const {error:itemsError}=await supabase.from('internal_request_items').insert(rows);
      if(itemsError) throw itemsError;
      setShowNew(false);reset();await load();
    }catch(err){
      console.error(err);
      setError('Não foi possível enviar a solicitação. Revise os dados e tente novamente.');
    }finally{setSaving(false);}
  };

  const openRequestSummary=async(request:InternalRequest)=>{
    setSelectedRequest(request);
    const withPhotos=(request.internal_request_items||[]).filter(item=>item.photo_path);
    if(!withPhotos.length)return;
    const urls:Record<string,string>={};
    await Promise.all(withPhotos.map(async item=>{
      const {data}=await supabase.storage.from('request-attachments').createSignedUrl(item.photo_path!,3600);
      if(data?.signedUrl)urls[item.id]=data.signedUrl;
    }));
    if(Object.keys(urls).length)setRequestPhotos(current=>({...current,...urls}));
  };

  const signOut=async()=>{await supabase.auth.signOut({scope:'local'});await transitionTo(null);navigate('/login',{replace:true});};
  const firstName=identity?.fullName?.split(' ')[0]||'Solicitante';

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-slate-50 pb-24 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-xl items-center justify-between px-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">SupplyHub • App Campo</p>
            <h1 className="truncate text-sm font-extrabold">{identity?.organizationName||'Minha empresa'}</h1>
          </div>
          <button onClick={signOut} className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white text-slate-500" aria-label="Sair">
            <LogOut className="h-4 w-4"/>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl space-y-5 px-4 py-4">
        <section className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs text-slate-300">Olá, {firstName}</p><h2 className="mt-1 text-2xl font-black">Solicitar material</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Escolha o item, informe quantidade e necessidade. Compras recebe e conduz a cotação.</p>
            </div>
            <div className="rounded-2xl bg-indigo-500/20 p-3 text-indigo-300"><Smartphone className="h-7 w-7"/></div>
          </div>
          <button onClick={()=>setShowNew(true)} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-sm font-extrabold">
            <Plus className="h-5 w-5"/>Nova solicitação
          </button>
        </section>

        <section className="grid grid-cols-3 gap-2">
          {[['Em andamento',stats.open,ClipboardList],['Em cotação',stats.quote,Clock3],['Entregues',stats.done,CheckCircle2]].map(([label,value,Icon]:any)=>(
            <div key={label} className="min-w-0 rounded-2xl border bg-white p-3 shadow-sm"><Icon className="h-4 w-4 text-indigo-600"/><p className="mt-2 text-xl font-black">{value}</p><p className="truncate text-[10px] font-semibold text-slate-500">{label}</p></div>
          ))}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between"><div><h3 className="text-base font-black">Minhas solicitações</h3><p className="text-xs text-slate-500">Acompanhe o processo de compra.</p></div>
            <button onClick={()=>void load()} className="flex h-9 w-9 items-center justify-center rounded-xl border bg-white text-slate-500"><RefreshCw className="h-4 w-4"/></button>
          </div>
          {loading?<div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Carregando...</div>:
          requests.length===0?<div className="rounded-3xl border border-dashed bg-white p-8 text-center"><PackageSearch className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-3 text-sm font-bold">Nenhuma solicitação</p></div>:
          <div className="space-y-3">{requests.map(r=><article key={r.id} onClick={()=>void openRequestSummary(r)} className="cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition active:scale-[0.995]">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase text-slate-400">{new Date(r.created_at).toLocaleDateString('pt-BR')}</p><h4 className="mt-1 truncate text-sm font-extrabold">{r.department||'Solicitação de compra'}</h4></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold">{STATUS_LABEL[r.status]}</span></div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{r.internal_request_items?.length??0} item(ns)</span><span>{r.priority==='emergencial'?'Emergencial':'Normal'}</span></div>
            {r.expected_date&&<div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><CalendarDays className="h-3.5 w-3.5"/>Necessidade: {new Date(r.expected_date+'T12:00:00').toLocaleDateString('pt-BR')}</div>}
            {r.quotation_title&&<div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Cotação</p>
              <p className="mt-0.5 text-xs font-extrabold text-indigo-900">{r.quotation_title}</p>
              <p className="mt-0.5 text-[10px] text-indigo-700">{r.quotation_destinations?.length ? `Enviada para: ${r.quotation_destinations.join(', ')}` : (r.quotation_destination_label||'Em processamento por Compras')}</p>
            </div>}
          </article>)}</div>}
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid h-16 max-w-xl grid-cols-3 px-6"><button className="flex flex-col items-center justify-center gap-1 text-indigo-600"><ClipboardList className="h-5 w-5"/><span className="text-[10px] font-bold">Início</span></button>
          <button onClick={()=>setShowNew(true)} className="flex flex-col items-center justify-center gap-1 text-slate-500"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white"><Plus className="h-5 w-5"/></div><span className="text-[10px] font-bold">Solicitar</span></button>
          <button className="flex flex-col items-center justify-center gap-1 text-slate-500"><UserRound className="h-5 w-5"/><span className="text-[10px] font-bold">Perfil</span></button></div>
      </nav>

      {selectedRequest&&<div className="fixed inset-0 z-50 flex items-end bg-slate-950/60 sm:items-center sm:justify-center sm:p-4">
        <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-8 shadow-2xl sm:max-w-xl sm:rounded-3xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">Resumo da solicitação</p>
              <h3 className="mt-1 text-xl font-black text-slate-900">{selectedRequest.department||'Solicitação de compra'}</h3>
              <p className="mt-1 text-xs text-slate-500">Enviada em {new Date(selectedRequest.created_at).toLocaleString('pt-BR')}</p>
            </div>
            <button onClick={()=>setSelectedRequest(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100"><X className="h-4 w-4"/></button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-400">Status</p><p className="mt-1 text-sm font-extrabold">{STATUS_LABEL[selectedRequest.status]}</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-400">Prioridade</p><p className="mt-1 text-sm font-extrabold">{selectedRequest.priority==='emergencial'?'Emergencial':'Normal'}</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-400">Data necessária</p><p className="mt-1 text-sm font-extrabold">{selectedRequest.expected_date?new Date(selectedRequest.expected_date+'T12:00:00').toLocaleDateString('pt-BR'):'Não informada'}</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-400">Itens</p><p className="mt-1 text-sm font-extrabold">{selectedRequest.internal_request_items?.length??0}</p></div>
          </div>

          <div className="mt-5 space-y-3">
            <h4 className="text-sm font-black">Itens solicitados</h4>
            {(selectedRequest.internal_request_items||[]).map(item=><div key={item.id} className="rounded-2xl border bg-white p-3">
              <div className="flex gap-3">
                {requestPhotos[item.id]?<img src={requestPhotos[item.id]} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover"/>:item.photo_path?<div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100"><ImageIcon className="h-5 w-5 text-slate-400"/></div>:null}
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900">{item.description}</p>
                  <p className="mt-1 text-sm font-black text-indigo-700">{item.quantity} {item.uom}</p>
                  {item.item_notes&&<p className="mt-2 text-xs leading-relaxed text-slate-500">{item.item_notes}</p>}
                </div>
              </div>
            </div>)}
          </div>

          {selectedRequest.notes&&<div className="mt-4 rounded-2xl border bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-400">Observação</p><p className="mt-1 text-xs leading-relaxed text-slate-700">{selectedRequest.notes}</p></div>}
          {selectedRequest.quotation_title&&<div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Cotação gerada por Compras</p>
            <p className="mt-1 text-base font-black text-indigo-950">{selectedRequest.quotation_title}</p>
            <p className="mt-2 text-xs font-semibold text-indigo-800">
              {selectedRequest.quotation_destinations?.length
                ? `Enviada para: ${selectedRequest.quotation_destinations.join(', ')}`
                : (selectedRequest.quotation_destination_label||'Aguardando definição dos fornecedores')}
            </p>
          </div>}
          <button onClick={()=>setSelectedRequest(null)} className="mt-5 h-11 w-full rounded-xl bg-slate-900 text-sm font-extrabold text-white">Fechar</button>
        </div>
      </div>}

      {showNew&&<div className="fixed inset-0 z-50 flex items-end bg-slate-950/60 sm:items-center sm:justify-center sm:p-4">
        <div className="max-h-[96dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-8 shadow-2xl sm:max-w-xl sm:rounded-3xl">
          <div className="mb-4 flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">App Campo</p><h3 className="text-xl font-black">Nova solicitação de compra</h3></div><button onClick={close} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100"><X className="h-4 w-4"/></button></div>
          <form onSubmit={submit} className="space-y-5">
            {error&&<div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={()=>setPriority('normal')} className={`h-11 rounded-xl border text-sm font-extrabold ${priority==='normal'?'border-indigo-600 bg-indigo-50 text-indigo-700':'border-slate-200'}`}>Normal</button>
              <button type="button" onClick={()=>setPriority('emergencial')} className={`h-11 rounded-xl border text-sm font-extrabold ${priority==='emergencial'?'border-red-500 bg-red-50 text-red-700':'border-slate-200'}`}>Emergencial</button>
            </div>
            <label className="block text-xs font-bold">Data necessária *
              <input required type="date" value={expectedDate} onChange={e=>setExpectedDate(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border px-3 text-sm"/>
            </label>
            <label className="block text-xs font-bold">Área / setor
              <input value={department} onChange={e=>setDepartment(e.target.value)} placeholder="Ex.: Manutenção, Produção..." className="mt-1.5 h-11 w-full rounded-xl border px-3 text-sm"/>
            </label>

            {items.map((item,index)=><div key={item.id} className="rounded-2xl border bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-500">Item {index+1}</span>{items.length>1&&<button type="button" onClick={()=>setItems(v=>v.filter(x=>x.id!==item.id))}><Trash2 className="h-4 w-4 text-slate-400"/></button>}</div>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"/>
                <input
                  value={item.material_name}
                  onFocus={()=>{setCatalogItemId(item.id);setMaterialSearch(item.material_name)}}
                  onChange={e=>{
                    patchItem(item.id,{material_id:null,material_name:e.target.value,description:e.target.value});
                    setCatalogItemId(item.id);
                    setMaterialSearch(e.target.value);
                  }}
                  placeholder="Pesquisar no Catálogo Global"
                  className="h-11 w-full rounded-xl border bg-white pl-9 pr-3 text-sm"
                />
              </div>
              {catalogItemId===item.id && <div className="mt-2 overflow-hidden rounded-xl border bg-white shadow-lg">
                <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Catálogo Global de Materiais</p>
                    <p className="text-[10px] text-slate-500">{materials.length} materiais disponíveis</p>
                  </div>
                  <button type="button" onClick={()=>setCatalogItemId(null)} className="rounded-lg p-1 text-slate-400"><X className="h-4 w-4"/></button>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filteredMaterials.length===0
                    ? <div className="p-4 text-center text-xs text-slate-500">Nenhum material encontrado. Você ainda pode usar uma descrição livre.</div>
                    : filteredMaterials.map(m=><button type="button" key={m.material_id} onClick={()=>selectMaterial(item.id,m)} className="block w-full border-b px-3 py-3 text-left last:border-0 hover:bg-indigo-50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900">{m.name}</p>
                            {m.description&&<p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{m.description}</p>}
                            <p className="mt-1 text-[10px] font-semibold text-slate-400">{[m.internal_sku,m.erp_code,m.unit].filter(Boolean).join(' • ') || m.unit}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${m.linked_to_company?'bg-emerald-50 text-emerald-700':'bg-indigo-50 text-indigo-700'}`}>
                            {m.linked_to_company?'Já vinculado':'Global'}
                          </span>
                        </div>
                      </button>)}
                </div>
              </div>}
              {item.material_id&&<div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div><p className="text-[10px] font-black uppercase text-emerald-700">Material selecionado</p><p className="text-xs font-semibold text-emerald-900">{item.material_name}</p></div>
                <button type="button" onClick={()=>{patchItem(item.id,{material_id:null});setCatalogItemId(item.id);setMaterialSearch(item.material_name)}} className="text-[10px] font-black text-indigo-700">Trocar</button>
              </div>}
              <div className="mt-2 grid grid-cols-[1fr_90px] gap-2"><input required inputMode="decimal" value={item.quantity} onChange={e=>patchItem(item.id,{quantity:e.target.value})} placeholder="Quantidade" className="h-11 rounded-xl border bg-white px-3 text-sm"/><input value={item.uom} onChange={e=>patchItem(item.id,{uom:e.target.value})} className="h-11 rounded-xl border bg-white px-3 text-sm uppercase"/></div>
              <textarea value={item.notes} onChange={e=>patchItem(item.id,{notes:e.target.value})} rows={2} placeholder="Descrição complementar / especificação" className="mt-2 w-full resize-none rounded-xl border bg-white p-3 text-sm"/>
              <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed bg-white px-3 text-xs font-bold text-slate-600"><Camera className="h-4 w-4"/>{item.photo?<span className="truncate">{item.photo.name}</span>:'Adicionar foto do item'}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>patchItem(item.id,{photo:e.target.files?.[0]||null})}/></label>
            </div>)}
            <button type="button" onClick={()=>setItems(v=>[...v,newItem()])} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 text-xs font-extrabold text-indigo-700"><Plus className="h-4 w-4"/>Adicionar outro item</button>
            <label className="block text-xs font-bold">Observação geral
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-xl border p-3 text-sm" placeholder="Informações para o comprador..."/>
            </label>
            <button disabled={saving} className="flex h-12 w-full items-center justify-center rounded-2xl bg-indigo-600 text-sm font-extrabold text-white disabled:opacity-50">{saving?'Enviando...':'Enviar para Compras'}</button>
          </form>
        </div>
      </div>}
    </div>
  );
}