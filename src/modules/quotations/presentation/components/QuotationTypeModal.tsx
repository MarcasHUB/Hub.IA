import { useState, useEffect } from 'react';
import { X, Globe, Building2, FileText } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { useQuotationCart } from '../context/QuotationCartContext';
import { SupabaseSupplierRepository } from '@/modules/suppliers/infrastructure/repositories/SupabaseSupplierRepository';
import { SupabaseProductSupplierRepository } from '@/modules/products/infrastructure/repositories/SupabaseProductSupplierRepository';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';

interface QuotationTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: {
    type: 'BID' | 'DIRECT';
    code: string;
    productName: string;
    partnerId?: string;
    quantity: number;
    deliveryDate: string;
    requester: string;
    manufacturerCode: string;
    materialInfo: string;
    additionalDesc: string;
    paymentTerm: string;
    isDraft?: boolean;
    draftId?: string;
    targetSupplierName?: string;
  }) => void;
  defaultPartnerId?: string;
  productNames?: string;
  preselectedProductIds?: string[];
  selectedProductIds?: string[];
}

export function QuotationTypeModal({
  isOpen,
  onClose,
  onSubmit,
}: QuotationTypeModalProps) {
  const { data: identity } = useAuthenticatedIdentity();
  const tenantId = identity?.organizationId || '';
  const { items } = useQuotationCart();

  const [type, setType] = useState<'BID' | 'DIRECT'>('BID');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [linkedSuppliers, setLinkedSuppliers] = useState<Record<string, any[]>>({});
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  
  // Custom global fields
  const [deliveryDate, setDeliveryDate] = useState('');
  const [priority, setPriority] = useState<'Baixa' | 'Normal' | 'Alta' | 'Crítica'>('Normal');
  const [additionalDesc, setAdditionalDesc] = useState('');
  const [requester, setRequester] = useState(() => {
    const saved = localStorage.getItem('supplyhub_logged_operator');
    if (saved) {
      try {
        const obj = JSON.parse(saved);
        const fullName = `${obj.nome || ''} ${obj.sobrenome || ''}`.trim();
        return fullName || 'Comprador B2B';
      } catch (e) {
        return 'Comprador B2B';
      }
    }
    return 'Comprador B2B';
  });
  const paymentTerm = '30 dias';

  // Load suppliers and linkages
  useEffect(() => {
    if (isOpen && items.length > 0) {
      const supplierRepo = new SupabaseSupplierRepository();
      supplierRepo.findAll(tenantId)
        .then(data => setSuppliers(data))
        .catch(err => console.error("Failed to load suppliers", err));

      const productSupplierRepo = new SupabaseProductSupplierRepository();
      const promises = items.map(item => 
        productSupplierRepo.getSupplierLinksByProduct(item.productId)
          .then(links => ({ 
            productId: item.productId, 
            suppliers: links.map(l => ({
              id: l.suppliers?.id,
              name: l.suppliers?.name,
              isPreferred: l.is_preferred_supplier
            })).filter(s => s.id)
          }))
      );

      Promise.all(promises)
        .then(results => {
          const map: Record<string, any[]> = {};
          results.forEach(res => {
            map[res.productId] = res.suppliers;
          });
          setLinkedSuppliers(map);
        })
        .catch(err => console.error("Failed to load linked suppliers", err));
    }
  }, [isOpen, items]);

  if (!isOpen) return null;

  // Flatten linked suppliers ids
  const linkedSupplierIds = new Set(
    Object.values(linkedSuppliers).flatMap(list => list.map(s => s.id))
  );

  // Preferred suppliers ids
  const preferredSupplierIds = new Set(
    Object.values(linkedSuppliers).flatMap(list => list.filter(s => s.isPreferred).map(s => s.id))
  );

  const handleConfirm = () => {
    if (items.length === 0) return;
    if (type === 'DIRECT' && !selectedSupplierId) return;
    if (!deliveryDate) {
      alert('Por favor, informe a data desejada de remessa.');
      return;
    }

    // Format combined texts
    const combinedNames = items
      .map(item => `${item.quantity}x ${item.name}`)
      .join(', ');

    const combinedMfgCodes = items
      .map(item => `${item.name}: ${item.sku || 'N/A'}`)
      .join(' | ');

    const combinedInfo = items
      .map(item => `${item.manufacturer || 'ND'} (${item.uom})`)
      .join(' / ');

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    const randomNum = Math.floor(Math.random() * 90000) + 10000;
    const code = type === 'BID' ? `RC-2026-${randomNum}` : `RCD-2026-${randomNum}`;

    let targetSupplierName = '';
    if (type === 'DIRECT' && selectedSupplierId) {
      const sup = suppliers.find(s => s.id === selectedSupplierId);
      targetSupplierName = sup ? sup.name : 'Fornecedor';
    }

    onSubmit?.({
      type,
      code,
      productName: combinedNames,
      partnerId: type === 'DIRECT' ? selectedSupplierId : undefined,
      quantity: totalQuantity,
      deliveryDate,
      requester,
      manufacturerCode: combinedMfgCodes,
      materialInfo: combinedInfo,
      additionalDesc: additionalDesc + (priority !== 'Normal' ? ` (Prioridade: ${priority})` : ''),
      paymentTerm,
      targetSupplierName
    });

    // Reset local state
    setDeliveryDate('');
    setSelectedSupplierId('');
    setAdditionalDesc('');
    setPriority('Normal');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <FileText className="h-5 w-5 text-indigo-600" />
              Prévia da Requisição
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Revise os detalhes dos materiais antes de disparar.</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors" title="Fechar">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* List of items */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider block">Materiais Selecionados</label>
            <div className="space-y-2 border border-slate-150 p-3 rounded-xl bg-slate-50/50 max-h-40 overflow-y-auto">
              {items.map(item => (
                <div key={item.productId} className="bg-white border border-slate-200 rounded-lg p-3 text-xs shadow-sm flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      SKU: {item.sku || 'ND'} | Fab: {item.manufacturer || 'ND'} | PN: {item.partNumber || 'ND'}
                    </p>
                    {item.notes && (
                      <p className="text-[10px] text-slate-500 italic mt-1 bg-slate-50 px-2 py-1 rounded">
                        Obs: {item.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                      {item.quantity} {item.uom}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tipo de Cotação */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider block">Tipo de Cotação</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType('BID')}
                className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all gap-2 ${
                  type === 'BID' ? 'border-indigo-600 bg-indigo-50/40 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <Globe className={`h-5 w-5 ${type === 'BID' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div>
                  <p className="text-xs font-bold text-slate-900">Cotação a Mercado (BID)</p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                    Vários fornecedores receberão a solicitação para cotar.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('DIRECT')}
                className={`flex flex-col text-left p-4 rounded-xl border-2 transition-all gap-2 ${
                  type === 'DIRECT' ? 'border-indigo-600 bg-indigo-50/40 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <Building2 className={`h-5 w-5 ${type === 'DIRECT' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div>
                  <p className="text-xs font-bold text-slate-900">Cotação Direcionada</p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                    Apenas um fornecedor específico receberá a solicitação.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Dropdown de Fornecedores (Se Direcionada) */}
          {type === 'DIRECT' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider block">Escolha o Fornecedor *</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                required
              >
                <option value="">Selecione um fornecedor...</option>
                {suppliers.map(s => {
                  const isLinked = linkedSupplierIds.has(s.id);
                  const isPref = preferredSupplierIds.has(s.id);
                  let label = s.name;
                  if (isPref) {
                    label += ' ⭐ (Preferencial B2B)';
                  } else if (isLinked) {
                    label += ' 🔗 (Base de Abastecimento)';
                  }
                  return (
                    <option key={s.id} value={s.id}>{label}</option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Solicitante */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider block">Solicitante *</label>
            <Input
              type="text"
              value={requester}
              onChange={e => setRequester(e.target.value)}
              placeholder="Nome do solicitante da compra..."
              className="h-10 text-sm border-slate-300"
              required
            />
          </div>

          {/* Data de Remessa e Prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider block">Data desejada de remessa *</label>
              <div className="relative">
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  className="h-10 text-sm border-slate-300"
                  required
                />
              </div>
              <p className="text-[9px] text-slate-450 mt-0.5">Informe a data em que deseja receber os materiais.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider block">Prioridade</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="Baixa">Baixa</option>
                <option value="Normal">Normal</option>
                <option value="Alta">Alta</option>
                <option value="Crítica">Crítica (Parada de Produção)</option>
              </select>
            </div>
          </div>

          {/* Observações Gerais */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider block">Observações da Requisição</label>
            <textarea
              placeholder="Insira instruções comerciais adicionais, detalhes de logística, frete ou exigências especiais de faturamento..."
              value={additionalDesc}
              onChange={e => setAdditionalDesc(e.target.value)}
              maxLength={500}
              className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 h-20 resize-none text-slate-750"
            />
            <p className="text-[9px] text-slate-450 text-right">{additionalDesc.length}/500</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between gap-3 shrink-0">
          <Button variant="outline" onClick={onClose} className="h-10 text-xs">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={items.length === 0 || !deliveryDate || (type === 'DIRECT' && !selectedSupplierId)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 text-xs font-semibold"
          >
            {type === 'BID' ? 'Gerar RC' : 'Gerar RCD'}
          </Button>
        </div>

      </div>
    </div>
  );
}
