import { useEffect, useMemo, useState } from 'react';
import { Building2, FileText, Globe, Search, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { useQuotationCart } from '../context/QuotationCartContext';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';
import {
  CreatedQuotation,
  EligiblePartner,
  PurchaseMaterial,
  SupabaseQuotationRepository,
} from '../../infrastructure/repositories/SupabaseQuotationRepository';

interface QuotationTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (quotation: CreatedQuotation) => void;
  defaultPartnerId?: string;
  productNames?: string;
  preselectedProductIds?: string[];
  selectedProductIds?: string[];
}

const repository = new SupabaseQuotationRepository();

function errorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof Error) return caught.message;
  if (caught && typeof caught === 'object' && 'message' in caught && typeof caught.message === 'string') {
    return caught.message;
  }
  return fallback;
}

export function QuotationTypeModal({ isOpen, onClose, onSubmit }: QuotationTypeModalProps) {
  const navigate = useNavigate();
  const { data: identity } = useAuthenticatedIdentity();
  const organizationId = identity?.organizationId || '';
  const { items, addItem, removeItem, updateQuantity } = useQuotationCart();
  const [type, setType] = useState<'BID' | 'DIRECT'>('BID');
  const [partners, setPartners] = useState<EligiblePartner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialResults, setMaterialResults] = useState<PurchaseMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [priority, setPriority] = useState<'Baixa' | 'Normal' | 'Alta' | 'Crítica'>('Normal');
  const [additionalDesc, setAdditionalDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !organizationId) return;
    let cancelled = false;
    setMaterialsLoading(true);
    const timer = window.setTimeout(() => {
      repository.searchPurchaseMaterials(organizationId, materialSearch)
        .then(data => { if (!cancelled) setMaterialResults(data); })
        .catch(caught => { if (!cancelled) setError(errorMessage(caught, 'Materiais indisponíveis.')); })
        .finally(() => { if (!cancelled) setMaterialsLoading(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [isOpen, materialSearch, organizationId]);

  useEffect(() => {
    if (!isOpen || !organizationId) return;
    repository.listEligiblePartners(organizationId)
      .then(setPartners)
      .catch(caught => setError(errorMessage(caught, 'Parceiros indisponíveis.')));
  }, [isOpen, organizationId]);

  const selectedIds = useMemo(() => new Set(items.map(item => item.productId)), [items]);
  if (!isOpen) return null;

  const addMaterial = (material: PurchaseMaterial) => {
    if (selectedIds.has(material.productId)) return;
    addItem({
      productId: material.productId,
      name: material.displayName || material.officialName,
      uom: material.unit,
      quantity: 1,
      manufacturer: material.manufacturer,
      category: material.category,
      sku: material.internalSku,
      partNumber: material.manufacturerCode,
    });
    setMaterialSearch('');
  };

  const handleConfirm = async () => {
    if (!identity?.userId || !identity.fullName || !organizationId || items.length === 0 || !deliveryDate) return;
    if (type === 'DIRECT' && !selectedPartnerId) return;
    setIsSubmitting(true);
    setError('');
    try {
      const quotation = await repository.create({
        type,
        dueDate: deliveryDate,
        priority,
        notes: additionalDesc,
        targetOrganizationId: type === 'DIRECT' ? selectedPartnerId : undefined,
        items: items.map(item => ({ productId: item.productId, quantity: item.quantity })),
      });
      onSubmit?.(quotation);
      setDeliveryDate('');
      setSelectedPartnerId('');
      setAdditionalDesc('');
      setPriority('Normal');
    } catch (caught) {
      setError(errorMessage(caught, 'Não foi possível gerar a cotação.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5"><FileText className="h-5 w-5 text-indigo-600" />Prévia da Requisição</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Revise os detalhes dos materiais antes de disparar.</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors" title="Fechar"><X className="h-4 w-4 text-slate-500" /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Materiais Selecionados</label>
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={materialSearch} onChange={event => setMaterialSearch(event.target.value)} placeholder="Buscar material..." className="pl-9" /></div>
            {(materialSearch || items.length === 0) && (
              <div className="max-h-48 overflow-y-auto rounded-xl border bg-white shadow-sm">
                {materialsLoading ? <p className="p-4 text-xs text-slate-500">Buscando materiais disponíveis para compra...</p> : materialResults.length === 0 ? (
                  <div className="p-4 text-xs text-slate-600"><p>Você ainda não possui materiais disponíveis para compra.</p><button onClick={() => { onClose(); navigate('/products?link=1'); }} className="mt-2 font-bold text-indigo-600 hover:underline">Vincular material</button></div>
                ) : materialResults.map(material => (
                  <button key={material.organizationMaterialId} type="button" disabled={selectedIds.has(material.productId)} onClick={() => addMaterial(material)} className="w-full border-b p-3 text-left last:border-0 hover:bg-indigo-50 disabled:opacity-50">
                    <p className="text-xs font-bold text-slate-800">{material.displayName}</p>
                    <p className="mt-1 text-[10px] text-slate-500">Código interno: {material.internalSku} · Categoria: {material.category} · Unidade: {material.unit}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2 border border-slate-200 p-3 rounded-xl bg-slate-50/50 max-h-48 overflow-y-auto">
              {items.map(item => (
                <div key={item.productId} className="bg-white border border-slate-200 rounded-lg p-3 text-xs shadow-sm flex items-center justify-between gap-3">
                  <div className="min-w-0"><p className="font-bold text-slate-800 truncate">{item.name}</p><p className="text-[10px] text-slate-400 mt-0.5">SKU: {item.sku || 'ND'} · Categoria: {item.category || 'ND'} · Unidade: {item.uom}</p></div>
                  <div className="flex shrink-0 items-center gap-2"><Input type="number" min={1} value={item.quantity} onChange={event => updateQuantity(item.productId, Number(event.target.value))} className="h-8 w-20 text-right" /><button onClick={() => removeItem(item.productId)} title="Remover material" className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button></div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Tipo de Cotação</label>
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={() => setType('BID')} className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all gap-2 ${type === 'BID' ? 'border-indigo-600 bg-indigo-50/40 shadow-sm' : 'border-slate-200 bg-white'}`}><Globe className={`h-5 w-5 ${type === 'BID' ? 'text-indigo-600' : 'text-slate-400'}`} /><div><p className="text-xs font-bold text-slate-900">Cotação a Mercado (BID)</p><p className="text-[10px] text-slate-500 mt-1 leading-snug">Distribuição apenas para empresas reais elegíveis.</p></div></button>
              <button type="button" onClick={() => setType('DIRECT')} className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all gap-2 ${type === 'DIRECT' ? 'border-indigo-600 bg-indigo-50/40 shadow-sm' : 'border-slate-200 bg-white'}`}><Building2 className={`h-5 w-5 ${type === 'DIRECT' ? 'text-indigo-600' : 'text-slate-400'}`} /><div><p className="text-xs font-bold text-slate-900">Cotação Direcionada</p><p className="text-[10px] text-slate-500 mt-1 leading-snug">Somente um parceiro ativo e aceito.</p></div></button>
            </div>
          </div>

          {type === 'DIRECT' && <div className="space-y-1.5"><label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Escolha o Fornecedor *</label>{partners.length === 0 ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Você ainda não possui parceiros disponíveis para uma cotação direcionada. <button onClick={() => { onClose(); navigate('/suppliers'); }} className="font-bold underline">Ver Meus Parceiros</button></div> : <select value={selectedPartnerId} onChange={event => setSelectedPartnerId(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white"><option value="">Buscar parceiro...</option>{partners.map(partner => <option key={partner.organizationId} value={partner.organizationId}>{partner.tradeName}{partner.legalName !== partner.tradeName ? ` — ${partner.legalName}` : ''}</option>)}</select>}</div>}

          <div className="space-y-1"><label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Solicitante *</label><Input type="text" value={identity?.fullName || ''} readOnly className="h-10 text-sm border-slate-300 bg-slate-50" /></div>
          <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Data desejada de remessa *</label><Input type="date" value={deliveryDate} onChange={event => setDeliveryDate(event.target.value)} className="h-10 text-sm border-slate-300" required /></div><div className="space-y-1"><label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Prioridade</label><select value={priority} onChange={event => setPriority(event.target.value as typeof priority)} className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white"><option>Baixa</option><option>Normal</option><option>Alta</option><option>Crítica</option></select></div></div>
          <div className="space-y-1"><label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Observações da Requisição</label><textarea value={additionalDesc} onChange={event => setAdditionalDesc(event.target.value)} maxLength={500} className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5 h-20 resize-none" /><p className="text-[9px] text-slate-400 text-right">{additionalDesc.length}/500</p></div>
          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between gap-3 shrink-0"><Button variant="outline" onClick={onClose} className="h-10 text-xs">Cancelar</Button><Button onClick={() => void handleConfirm()} disabled={isSubmitting || items.length === 0 || !identity?.fullName || !deliveryDate || (type === 'DIRECT' && !selectedPartnerId)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 text-xs font-semibold">{isSubmitting ? 'Gerando...' : type === 'BID' ? 'Gerar RC' : 'Gerar RCD'}</Button></div>
      </div>
    </div>
  );
}
