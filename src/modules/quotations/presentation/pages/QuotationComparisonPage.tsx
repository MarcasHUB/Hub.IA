import { useState } from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { Check, Trophy, AlertCircle, X, FileText, Bell, CheckCircle2, XCircle, PackageOpen, Clock } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type QuotationStatus = 'open' | 'finalized' | 'cancelled';

interface Proposal {
  supplierName: string;
  rank: string;
  rankColor: string;
  items: (string | null)[];  // null = não cotou
  prices: (number | null)[];
  deliveryDays: (number | null)[];
  totalGlobal: number | null;
  isBest: boolean;
}

interface QuotationData {
  id: string;
  title: string;
  itemsCount: number;
  recommendedSupplier: string;
  recommendedReason: string;
  proposals: Proposal[];
  itemsRef: { name: string; ref: string; refVal: number }[];
}

// ─── Mapeamento de Cotações Mockadas por ID ─────────────────────────────────────
const MOCK_DATA_BY_ID: Record<string, QuotationData> = {
  'RC-2026-00001': {
    id: 'RC-2026-00001',
    title: 'Manutenção Preventiva Mês 07',
    itemsCount: 5,
    recommendedSupplier: 'Brasil Cabos',
    recommendedReason: 'Menor preço global (-12%) com prazo de 2 dias. Score 93/100.',
    itemsRef: [
      { name: 'Cabo Flexível 35mm (100 MT)', ref: 'R$ 18,50/MT', refVal: 18.50 },
      { name: 'Luva Nitrílica P (50 CX)', ref: 'R$ 25,90/CX', refVal: 25.90 }
    ],
    proposals: [
      {
        supplierName: 'Brasil Cabos',
        rank: 'Ouro',
        rankColor: 'bg-amber-50 text-amber-700 border-amber-200',
        isBest: true,
        items: ['Cabo Flexível 35mm (100 MT)', 'Luva Nitrílica P (50 CX)'],
        prices: [17.90, 26.00],
        deliveryDays: [2, 2],
        totalGlobal: 3090.00,
      },
      {
        supplierName: 'Eletro Tudo B2B',
        rank: 'Prata',
        rankColor: 'bg-slate-100 text-slate-700 border-slate-200',
        isBest: false,
        items: ['Cabo Flexível 35mm (100 MT)', 'Luva Nitrílica P (50 CX)'],
        prices: [18.50, 24.50],
        deliveryDays: [1, 3],
        totalGlobal: 3075.00,
      },
      {
        supplierName: 'Fixação Ind.',
        rank: 'Bronze',
        rankColor: 'bg-orange-50 text-orange-850 border-orange-200',
        isBest: false,
        items: ['Cabo Flexível 35mm (100 MT)', null],
        prices: [19.20, null],
        deliveryDays: [5, null],
        totalGlobal: null,
      }
    ]
  },
  'RC-2026-00002': {
    id: 'RC-2026-00002',
    title: 'Aquisição de Licenças Microsoft',
    itemsCount: 15,
    recommendedSupplier: 'Tech Solutions Ltda',
    recommendedReason: 'Fornecedor único com melhor pontuação de prazo e compliance. Score 88/100.',
    itemsRef: [
      { name: 'Licenças Office 365 Business (15 UN)', ref: 'R$ 350,00/UN', refVal: 350.00 },
      { name: 'Windows 11 Pro Licença (15 UN)', ref: 'R$ 800,00/UN', refVal: 800.00 }
    ],
    proposals: [
      {
        supplierName: 'Tech Solutions Ltda',
        rank: 'Ouro',
        rankColor: 'bg-amber-50 text-amber-700 border-amber-200',
        isBest: true,
        items: ['Licenças Office 365 Business (15 UN)', 'Windows 11 Pro Licença (15 UN)'],
        prices: [320.00, 750.00],
        deliveryDays: [3, 3],
        totalGlobal: 16050.00,
      },
      {
        supplierName: 'Alfa Industrial Ltda',
        rank: 'Prata',
        rankColor: 'bg-slate-100 text-slate-700 border-slate-200',
        isBest: false,
        items: ['Licenças Office 365 Business (15 UN)', 'Windows 11 Pro Licença (15 UN)'],
        prices: [340.00, 780.00],
        deliveryDays: [5, 5],
        totalGlobal: 16800.00,
      }
    ]
  },
  'RC-2026-00003': {
    id: 'RC-2026-00003',
    title: 'Compra de EPIs para Obra Matriz',
    itemsCount: 12,
    recommendedSupplier: 'Alfa Industrial Ltda',
    recommendedReason: 'Melhor pontuação de prazo e entrega antecipada de EPIs. Score 91/100.',
    itemsRef: [
      { name: 'Capacete de Segurança (100 UN)', ref: 'R$ 15,00/UN', refVal: 15.00 },
      { name: 'Bota de Segurança de Couro (50 PAR)', ref: 'R$ 45,00/PAR', refVal: 45.00 }
    ],
    proposals: [
      {
        supplierName: 'Alfa Industrial Ltda',
        rank: 'Ouro',
        rankColor: 'bg-amber-50 text-amber-700 border-amber-200',
        isBest: true,
        items: ['Capacete de Segurança (100 UN)', 'Bota de Segurança de Couro (50 PAR)'],
        prices: [14.50, 42.00],
        deliveryDays: [2, 2],
        totalGlobal: 3550.00,
      }
    ]
  }
};

// ─── Toast de Notificação ───────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-white text-sm font-bold animate-in fade-in slide-in-from-bottom-4 duration-300 ${
      type === 'success' ? 'bg-green-600' : 'bg-red-600'
    }`}>
      {type === 'success'
        ? <Bell className="h-4 w-4 animate-bounce" />
        : <XCircle className="h-4 w-4" />
      }
      {message}
    </div>
  );
}

// ─── Modal de Confirmação ───────────────────────────────────────────────────────
function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{message}</p>
        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="outline" onClick={onCancel} className="h-10 text-sm">Voltar</Button>
          <Button onClick={onConfirm} className={`h-10 text-sm text-white font-bold ${confirmColor}`}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── QuotationComparisonPage ──────────────────────────────────────────────────
export default function QuotationComparisonPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [status, setStatus] = useState<QuotationStatus>('open');
  const [winnerSupplier, setWinnerSupplier] = useState<string | null>(null);
  const [modal, setModal] = useState<'accept' | 'cancel' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Busca dados dinâmicos com base no ID da URL, senão carrega dados genéricos/mock 1
  const qData: QuotationData = (() => {
    if (id && MOCK_DATA_BY_ID[id]) {
      return MOCK_DATA_BY_ID[id];
    }
    
    // Tenta carregar do localStorage
    const savedQuotationsJson = localStorage.getItem('supplyhub_sent_quotations');
    if (savedQuotationsJson && id) {
      const savedList: any[] = JSON.parse(savedQuotationsJson);
      const found = savedList.find(q => q.id === id);
      if (found) {
        // Mapeia propostas comerciais
        const proposalsMapped = found.proposals.map((p: any) => {
          // Preços e prazos mapeados proporcionalmente para cada item
          const pricesMap = found.selectedProducts && found.selectedProducts.length > 0
            ? found.selectedProducts.map((sp: any) => {
                // Calcula variação simulada de preço por item do fornecedor
                const ratio = p.supplierName === 'Brasil Cabos' ? 0.96 : p.supplierName === 'Eletro Tudo B2B' ? 0.98 : 1.02;
                return sp.price * ratio;
              })
            : [p.price];

          const deliveryDaysMap = found.selectedProducts && found.selectedProducts.length > 0
            ? found.selectedProducts.map(() => p.deliveryDays)
            : [p.deliveryDays];

          return {
            supplierName: p.supplierName,
            rank: p.relationshipScore >= 90 ? 'Ouro' : p.relationshipScore >= 70 ? 'Prata' : 'Bronze',
            rankColor: p.relationshipScore >= 90 ? 'bg-amber-50 text-amber-700 border-amber-200' : p.relationshipScore >= 70 ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-orange-50 text-orange-850 border-orange-200',
            isBest: p.supplierName === 'Brasil Cabos' || found.type === 'DIRECT',
            items: found.selectedProducts?.map((sp: any) => sp.name) || [found.title],
            prices: pricesMap,
            deliveryDays: deliveryDaysMap,
            totalGlobal: p.price
          };
        });

        // Itens de referência na cotação
        const itemsRefMapped = found.selectedProducts && found.selectedProducts.length > 0
          ? found.selectedProducts.map((sp: any) => {
              const qty = Number(found.productQuantities?.[sp.id]) || 1;
              return {
                name: `${sp.name} (${qty} ${qty === 1 ? 'UN' : 'UNs'})`,
                ref: `R$ ${sp.price.toFixed(2).replace('.', ',')}/${sp.measures || 'UN'}`,
                refVal: sp.price
              };
            })
          : [{ name: found.title, ref: 'R$ 20,00/UN', refVal: 20.00 }];

        return {
          id: found.id,
          title: found.title,
          itemsCount: found.itemsCount,
          recommendedSupplier: found.proposals[0]?.supplierName || 'Fornecedor Parceiro',
          recommendedReason: `Menor preço global com score de relacionamento ${found.proposals[0]?.relationshipScore || 90}/100.`,
          proposals: proposalsMapped,
          itemsRef: itemsRefMapped
        };
      }
    }

    return MOCK_DATA_BY_ID['RC-2026-00001'];
  })();

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAccept = () => {
    const recommended = qData.proposals.find(p => p.isBest) || qData.proposals[0];
    setWinnerSupplier(recommended?.supplierName ?? qData.recommendedSupplier);
    setStatus('finalized');
    setModal(null);

    // Salva o status de finalização no localStorage
    const savedQuotationsJson = localStorage.getItem('supplyhub_sent_quotations');
    if (savedQuotationsJson && id) {
      const list: any[] = JSON.parse(savedQuotationsJson);
      const updatedList = list.map(q => q.id === id ? { 
        ...q, 
        status: 'Closed',
        proposals: q.proposals.map((p: any) => p.supplierName === (recommended?.supplierName ?? qData.recommendedSupplier) ? { ...p, isWinner: true } : p)
      } : q);
      localStorage.setItem('supplyhub_sent_quotations', JSON.stringify(updatedList));
    }

    showToast(`🏆 Proposta de "${recommended?.supplierName ?? qData.recommendedSupplier}" aceita! Notificação enviada ao fornecedor.`, 'success');
  };

  const handleCancel = () => {
    setStatus('cancelled');
    setModal(null);

    // Salva o status de cancelamento no localStorage
    const savedQuotationsJson = localStorage.getItem('supplyhub_sent_quotations');
    if (savedQuotationsJson && id) {
      const list: any[] = JSON.parse(savedQuotationsJson);
      const updatedList = list.map(q => q.id === id ? { ...q, status: 'Cancelled' } : q);
      localStorage.setItem('supplyhub_sent_quotations', JSON.stringify(updatedList));
    }

    showToast('Cotação cancelada. Nenhum fornecedor foi notificado.', 'error');
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const winner = qData.proposals.find(p => p.supplierName === winnerSupplier) || qData.proposals[0];

    const itemsHtml = qData.itemsRef.map((item: any, idx: number) => {
      const price = winner.prices[idx] || 0;
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #1e293b;">${item.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-family: monospace; color: #475569;">${item.ref || 'N/A'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center; color: #1e293b;">1</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; color: #475569;">R$ ${price.toFixed(2).replace('.', ',')}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: bold; color: #1e293b;">R$ ${price.toFixed(2).replace('.', ',')}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Cotação Finalizada - ${qData.id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 40px; margin: 0; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: 800; color: #4338ca; }
            .title { font-size: 18px; font-weight: 700; margin: 0; color: #0f172a; }
            .meta-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
            .meta-block { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; }
            .meta-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
            .meta-value { font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th { text-align: left; background: #f1f5f9; padding: 10px; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #475569; }
            .total-section { display: flex; justify-content: flex-end; font-size: 16px; font-weight: 800; border-top: 2px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <span class="logo">Hub.IA Suprimentos</span>
              <p style="font-size: 11px; color: #64748b; margin: 5px 0 0 0;">Relatório Oficial de Cotação de Compra</p>
            </div>
            <div style="text-align: right;">
              <h4 class="title">${qData.id}</h4>
              <p style="font-size: 11px; color: #64748b; margin: 5px 0 0 0;">Status: FINALIZADA</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-block">
              <div class="meta-title">Dados da Cotação</div>
              <div class="meta-value" style="font-size: 14px; color: #0f172a; margin-bottom: 8px;">${qData.title}</div>
              <div class="meta-value">ID Cotação: ${qData.id}</div>
            </div>
            <div class="meta-block">
              <div class="meta-title">Fornecedor Vencedor</div>
              <div class="meta-value" style="font-size: 14px; color: #10b981; margin-bottom: 8px;">🏆 ${winner.supplierName}</div>
              <div class="meta-value">Valor Global Proposto: R$ ${(winner.totalGlobal ?? 0).toFixed(2).replace('.', ',')}</div>
            </div>
          </div>

          <h4 style="font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #0f172a;">Itens da Cotação</h4>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Referência</th>
                <th style="text-align: center;">Qtd</th>
                <th style="text-align: right;">Preço Unit.</th>
                <th style="text-align: right;">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-section">
            <span>VALOR TOTAL DO PEDIDO: R$ ${(winner.totalGlobal ?? 0).toFixed(2).replace('.', ',')}</span>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative">

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Modal de Confirmação */}
      {modal === 'accept' && (
        <ConfirmModal
          title="Aceitar Proposta da Hub.IA?"
          message={`Confirma o aceite da proposta da ${qData.recommendedSupplier} (Rank A, menor custo global)? O fornecedor receberá uma notificação de que sua proposta venceu a cotação. Os demais participantes não serão notificados.`}
          confirmLabel="Aceitar e Finalizar"
          confirmColor="bg-green-600 hover:bg-green-700"
          onConfirm={handleAccept}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Modal de Cancelamento */}
      {modal === 'cancel' && (
        <ConfirmModal
          title="Cancelar esta Cotação?"
          message="A cotação será marcada como Cancelada e nenhum fornecedor receberá notificação. Esta ação não pode ser desfeita."
          confirmLabel="Cancelar Cotação"
          confirmColor="bg-red-600 hover:bg-red-700"
          onConfirm={handleCancel}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Comparação de Propostas</h2>
            {status === 'finalized' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> Finalizada
              </span>
            )}
            {status === 'cancelled' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                <XCircle className="h-3.5 w-3.5" /> Cancelada
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">Cotação #{qData.id} — {qData.title} ({qData.itemsCount} itens)</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/quotations')}>Voltar</Button>
      </div>

      {/* Banner de Inteligência da Hub.IA */}
      <Card className={`border-0 shadow-md ${status === 'finalized' ? 'bg-green-700' : status === 'cancelled' ? 'bg-slate-600' : 'bg-indigo-900'}`}>
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${status === 'finalized' ? 'bg-green-600' : status === 'cancelled' ? 'bg-slate-500' : 'bg-indigo-800'}`}>
              <Trophy className={`h-6 w-6 ${status === 'finalized' ? 'text-yellow-300' : status === 'cancelled' ? 'text-slate-300' : 'text-yellow-400'}`} />
            </div>
            <div>
              <p className="text-sm text-indigo-200">
                {status === 'open' ? 'Recomendação da Inteligência Hub.IA' : status === 'finalized' ? 'Proposta Aceita · Hub.IA' : 'Cotação Encerrada'}
              </p>
              <h3 className="font-bold text-xl text-white">
                {status === 'open' ? `Fornecedor Recomendado: ${qData.recommendedSupplier}` :
                 status === 'finalized' ? `🏆 ${winnerSupplier} — Proposta Vencedora!` :
                 'Esta cotação foi cancelada.'}
              </h3>
              <p className="text-sm text-indigo-200 mt-0.5">
                {status === 'open' ? qData.recommendedReason :
                 status === 'finalized' ? 'Notificação enviada ao fornecedor. Aguardando emissão do Pedido de Compra.' :
                 'Nenhum fornecedor recebeu notificação.'}
              </p>
            </div>
          </div>

          {/* Ações do Banner */}
          {status === 'open' && (
            <div className="flex gap-3 shrink-0">
              <Button
                onClick={() => setModal('cancel')}
                className="bg-white/10 hover:bg-red-600 text-white border border-white/20 font-bold h-10 px-4 text-sm flex items-center gap-2"
              >
                <X className="h-4 w-4" /> Cancelar Proposta
              </Button>
              <Button
                onClick={() => setModal('accept')}
                className="bg-white text-indigo-900 hover:bg-green-50 font-bold h-10 px-5 text-sm flex items-center gap-2 shadow-sm"
              >
                <Check className="h-4 w-4 text-green-600" /> Aceitar Proposta
              </Button>
            </div>
          )}

          {/* Ações quando Finalizada */}
          {status === 'finalized' && (
            <div className="flex gap-3 shrink-0">
              <Button
                onClick={handleDownloadPDF}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold h-10 px-4 text-sm flex items-center gap-2"
              >
                <FileText className="h-4 w-4" /> Emitir PDF
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalhes da Cotação (Grids Modulares) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Itens */}
        <Card className="lg:col-span-2 rounded-2xl border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <PackageOpen className="h-4 w-4 text-indigo-600" /> Itens da Cotação
            </h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-slate-400 text-[10px] uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Produto</th>
                  <th className="px-6 py-3">Referência</th>
                  <th className="px-6 py-3 text-center">Qtd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {qData.itemsRef.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3 font-semibold text-slate-700">{item.name}</td>
                    <td className="px-6 py-3 text-xs text-slate-500 font-mono">{item.ref}</td>
                    <td className="px-6 py-3 text-center font-bold text-slate-600">1</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Lateral: Observações e Histórico */}
        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" /> Observações
              </h3>
            </div>
            <CardContent className="p-5">
              <p className="text-xs text-slate-500 leading-relaxed">
                Prioridade alta para itens de segurança. Condições de pagamento: Faturamento 30/60/90. Entrega direto na Obra Matriz (Galpão 3).
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-600" /> Histórico
              </h3>
            </div>
            <CardContent className="p-5 space-y-4">
              <div className="flex gap-3">
                <div className="w-1.5 bg-indigo-500 rounded-full shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-700">Cotação Enviada</p>
                  <p className="text-[10px] text-slate-400">Ontem às 14:30</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1.5 bg-slate-200 rounded-full shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-700">Aprovação Solicitada</p>
                  <p className="text-[10px] text-slate-400">Ontem às 14:28</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-1.5 bg-slate-200 rounded-full shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-700">Rascunho Criado</p>
                  <p className="text-[10px] text-slate-400">Ontem às 10:15</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Matriz de Comparação de Preços */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold">Produto (Qtd)</th>
              {qData.proposals.map((p) => (
                <th key={p.supplierName} className={`px-6 py-4 font-semibold text-center border-l border-slate-200 ${p.isBest ? 'bg-indigo-50/50' : ''}`}>
                  <div className="flex flex-col items-center justify-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      {p.supplierName}
                      <Badge className={p.rankColor}>{p.rank}</Badge>
                    </div>
                    {winnerSupplier === p.supplierName ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700 uppercase tracking-wider">
                        <Trophy className="h-3 w-3" /> Vencedor
                      </span>
                    ) : p.isBest && status === 'open' ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                        <Trophy className="h-3 w-3" /> Hub.IA Recomenda
                      </span>
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {qData.itemsRef.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Ref: {item.ref}</p>
                </td>
                {qData.proposals.map((p) => {
                  const price = p.prices[idx];
                  const days = p.deliveryDays[idx];
                  const isLowest = price !== null && qData.proposals
                    .map(pp => pp.prices[idx])
                    .filter(v => v !== null)
                    .every(v => price <= (v ?? Infinity));
                  const isHighest = price !== null && qData.proposals
                    .map(pp => pp.prices[idx])
                    .filter(v => v !== null)
                    .every(v => price >= (v ?? -Infinity));

                  return (
                    <td key={p.supplierName} className={`px-6 py-4 text-center border-l border-slate-200 ${p.isBest ? 'bg-indigo-50/20' : ''}`}>
                      {price !== null ? (
                        <>
                          <p className={`font-bold text-base ${isLowest ? 'text-green-600' : isHighest ? 'text-red-500' : 'text-slate-900'}`}>
                            R$ {price.toFixed(2).replace('.', ',')}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">Prazo: {days} {days === 1 ? 'dia' : 'dias'}</p>
                        </>
                      ) : (
                        <span className="text-slate-400 italic text-xs flex items-center justify-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Não cotou
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Linha de Totais */}
            <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
              <td className="px-6 py-4 text-right text-xs font-extrabold uppercase tracking-wide text-slate-500">Valor Global:</td>
              {qData.proposals.map((p) => (
                <td key={p.supplierName} className={`px-6 py-4 text-center text-base border-l border-slate-200 ${p.isBest ? 'bg-indigo-100/50 text-indigo-700' : 'text-slate-900'}`}>
                  {p.totalGlobal !== null ? (
                    <>
                      R$ {p.totalGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      {p.isBest && <Check className="inline h-4 w-4 text-green-600 ml-1" />}
                    </>
                  ) : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Rodapé Pós-Finalização */}
      {status === 'finalized' && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-green-800 text-sm">Próximos Passos</p>
              <p className="text-xs text-green-600 mt-0.5">
                Emita o PDF desta cotação para o seu arquivo e histórico.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button onClick={handleDownloadPDF} variant="outline" className="border-green-300 text-green-700 hover:bg-green-100 h-9 text-xs font-bold flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Emitir PDF
            </Button>
          </div>
        </div>
      )}



    </div>
  );
}