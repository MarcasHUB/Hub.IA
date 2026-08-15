import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/Badge';
import {
  ArrowLeft, Inbox, CheckCircle2, AlertTriangle, Calendar,
  ClipboardList, CreditCard, Sparkles, Medal
} from 'lucide-react';

interface InboundQuotationDetail {
  id: string;
  title: string;
  buyerName: string;
  items: {
    description: string;
    manufacturerCode: string;
    quantityRequested: number;
    deliveryDateRequested: string;
    buyerNotes: string;
    referencePrice: number;
    paymentTermRequested: string;
  }[];
}

const MOCK_INBOUND_DETAILS: Record<string, InboundQuotationDetail> = {
  'r-2001': {
    id: 'r-2001',
    title: 'Compra de Materiais Elétricos',
    buyerName: 'ElétricaMax Distribuidora',
    items: [
      {
        description: 'Cabo Flexível 35mm2 Antichama 750V Preto',
        manufacturerCode: 'CAB-35-FLX',
        quantityRequested: 100,
        deliveryDateRequested: '15/07/2026',
        buyerNotes: 'Necessitamos de cabos homologados com certificação INMETRO recente.',
        referencePrice: 18.50,
        paymentTermRequested: '30 dias'
      }
    ]
  },
  'r-2002': {
    id: 'r-2002',
    title: 'Uniforme Corporativo Q3/2026',
    buyerName: 'Alfa Industrial Ltda',
    items: [
      {
        description: 'Camisa Polo Azul Marinho Com Logo Bordado',
        manufacturerCode: 'POLO-AZ-MAT',
        quantityRequested: 50,
        deliveryDateRequested: '20/07/2026',
        buyerNotes: 'Tamanhos variados M, G e GG de acordo com planilha anexa.',
        referencePrice: 45.00,
        paymentTermRequested: '21 dias'
      }
    ]
  },
  'r-2003': {
    id: 'r-2003',
    title: 'Serviços de Limpeza Mensal',
    buyerName: 'Construtora Horizonte',
    items: [
      {
        description: 'Limpeza pós-obra condomínio residencial',
        manufacturerCode: 'SERV-LIMP-PO',
        quantityRequested: 1,
        deliveryDateRequested: '12/07/2026',
        buyerNotes: 'Serviço pontual para entrega de condomínio no centro da cidade.',
        referencePrice: 1200.00,
        paymentTermRequested: '60 dias'
      }
    ]
  }
};

export default function QuotationResponsePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const details = id ? MOCK_INBOUND_DETAILS[id] : null;

  // Estados dos inputs de proposta
  const [suppliedQty, setSuppliedQty] = useState<string>(details ? String(details.items[0].quantityRequested) : '');
  const [proposedPrice, setProposedPrice] = useState<string>('');
  const [proposedDeliveryDate, setProposedDeliveryDate] = useState<string>('');
  const [proposedPaymentTerm, setProposedPaymentTerm] = useState<string>('30 dias');
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const item = details?.items[0];

  // Cálculo Dinâmico do Score e Classificação Hub.IA
  const computedStats = useMemo(() => {
    if (!item) return { score: 0, rating: 'Bronze' as const };
    let score = 75; // Score inicial base

    // 1. Fator Preço Proposto
    if (proposedPrice && Number(proposedPrice) > 0) {
      const priceNum = Number(proposedPrice);
      const refPrice = item.referencePrice;
      if (priceNum < refPrice) {
        const savingsPct = ((refPrice - priceNum) / refPrice) * 100;
        score += Math.min(15, Math.round(savingsPct * 2));
      } else if (priceNum > refPrice) {
        const excessPct = ((priceNum - refPrice) / refPrice) * 100;
        score -= Math.min(25, Math.round(excessPct * 1.5));
      } else {
        score += 5; // Preço idêntico ao solicitado
      }
    }

    // 2. Fator Data de Entrega (Prazo de remessa)
    if (proposedDeliveryDate) {
      const [reqD, reqM, reqY] = item.deliveryDateRequested.split('/');
      const reqDateObj = new Date(Number(reqY), Number(reqM) - 1, Number(reqD));
      const propDateObj = new Date(proposedDeliveryDate);
      
      const diffTime = reqDateObj.getTime() - propDateObj.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        // Entrega antecipada (Ponto positivo!)
        score += 15;
      } else if (diffDays < 0) {
        // Entrega em atraso
        score -= 20;
      } else {
        score += 5; // Entrega no prazo exato
      }
    }

    // 3. Fator Faturamento / Condição de Pagamento
    if (proposedPaymentTerm === '60 dias') {
      score += 10;
    } else if (proposedPaymentTerm === '21 dias') {
      score -= 5;
    } else {
      score += 3; // 30 dias
    }

    // Limites de score entre 0 e 100
    const finalScore = Math.max(0, Math.min(100, score));

    // Determina Classificação
    let rating: 'Ouro' | 'Prata' | 'Bronze' = 'Bronze';
    if (finalScore >= 90) rating = 'Ouro';
    else if (finalScore >= 70) rating = 'Prata';

    return { score: finalScore, rating };
  }, [proposedPrice, proposedDeliveryDate, proposedPaymentTerm, item]);

  if (!details || !item) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <AlertTriangle className="h-14 w-14 mb-4 text-red-400 animate-bounce" />
        <p className="font-bold text-slate-900">Cotação não encontrada!</p>
        <p className="text-sm mt-1">A cotação solicitada não existe ou foi removida.</p>
        <Button onClick={() => navigate('/quotations')} className="mt-4 bg-indigo-600 text-white">
          Voltar para Cotações
        </Button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!proposedPrice.trim() || Number(proposedPrice) <= 0) {
      setErrorMessage('Erro: O preço de envio é obrigatório e deve ser preenchido!');
      return;
    }

    if (!suppliedQty.trim() || Number(suppliedQty) <= 0) {
      setErrorMessage('Erro: A quantidade que consegue atender deve ser preenchida!');
      return;
    }

    if (!proposedDeliveryDate) {
      setErrorMessage('Erro: Selecione a data proposta de remessa!');
      return;
    }

    setErrorMessage(null);
    setIsSuccess(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Botão Voltar */}
      <button onClick={() => navigate('/quotations')} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wider">
        <ArrowLeft className="h-4 w-4" /> Voltar para Cotações
      </button>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <Badge className="bg-violet-100 text-violet-700 border-violet-200">Responder Cotação Recebida</Badge>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">{details.title}</h2>
          <p className="text-xs text-slate-400">Comprador solicitante: <span className="font-semibold text-slate-600">{details.buyerName}</span></p>
        </div>
        <Inbox className="h-10 w-10 text-violet-500 flex-shrink-0" />
      </div>

      {isSuccess ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xl animate-in zoom-in-95 duration-200">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-950">Proposta Comercial Enviada!</h3>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Sua proposta para a cotação <strong>{details.title}</strong> foi enviada para <strong>{details.buyerName}</strong>.
          </p>
          
          <div className="bg-slate-50 rounded-2xl p-4 my-5 border border-slate-100 text-left space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-200/60 pb-1.5 font-bold">
              <span>Classificação Hub.IA obtida:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                computedStats.rating === 'Ouro' ? 'bg-amber-100 text-amber-800' :
                computedStats.rating === 'Prata' ? 'bg-slate-100 text-slate-700' :
                'bg-orange-50 text-orange-850'
              }`}>
                Categoria {computedStats.rating} ({computedStats.score} pts)
              </span>
            </div>
            <p className="text-slate-600">Qtd. Ofertada: <span className="font-semibold text-slate-900">{suppliedQty}</span></p>
            <p className="text-slate-600">Preço Proposto: <span className="font-semibold text-green-700">R$ {Number(proposedPrice).toFixed(2)}</span></p>
            <p className="text-slate-600">Faturamento Proposto: <span className="font-semibold text-slate-900">{proposedPaymentTerm}</span></p>
            <p className="text-slate-600">Remessa Proposta: <span className="font-semibold text-slate-900">{new Date(proposedDeliveryDate).toLocaleDateString('pt-BR')}</span></p>
          </div>

          <Button onClick={() => navigate('/quotations')} className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-semibold">
            Concluir e Voltar
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          
          {/* Detalhes do Material Solicitado */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4 text-slate-400" /> Detalhes do Item Solicitado
            </h3>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-400">Nome do Material / Descrição</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{item.description}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400">Código do Fabricante</p>
                  <p className="text-xs font-mono font-bold text-slate-800 mt-0.5">{item.manufacturerCode}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400">Faturamento Exigido</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5 text-slate-400" /> {item.paymentTermRequested}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400">Remessa Desejada</p>
                  <p className="text-xs font-bold text-slate-850 mt-0.5 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" /> {item.deliveryDateRequested}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400">Observações adicionais do Comprador</p>
                <p className="text-xs text-slate-650 mt-0.5 bg-white border border-slate-200 rounded-lg p-2.5 leading-relaxed">
                  {item.buyerNotes}
                </p>
              </div>
            </div>
          </div>

          {/* Área Reativa da IA de Score */}
          <div className="mx-6 mt-6 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between shadow-inner">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-150 px-2 py-0.5 rounded-full flex items-center gap-1 self-start w-fit">
                <Sparkles className="h-3 w-3 animate-pulse" /> Inteligência de Score Hub.IA
              </span>
              <p className="text-xs font-bold text-slate-900 mt-1">Pontuação Projetada da sua Proposta</p>
              <p className="text-[10px] text-slate-500">A pontuação considera preço, entrega antecipada e prazo de faturamento.</p>
            </div>
            
            {/* Pontuação + Medalha */}
            <div className="flex flex-col items-center gap-1 bg-white p-3 rounded-xl border border-indigo-100 shadow-sm shrink-0">
              <div className="text-2xl font-black text-indigo-750">{computedStats.score} <span className="text-xs font-bold text-slate-400">/ 100</span></div>
              <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                computedStats.rating === 'Ouro' ? 'bg-amber-100 text-amber-800' :
                computedStats.rating === 'Prata' ? 'bg-slate-100 text-slate-700' :
                'bg-orange-50 text-orange-850'
              }`}>
                <Medal className="h-3 w-3 fill-current" /> {computedStats.rating}
              </span>
            </div>
          </div>

          {/* Formulário de Resposta Comercial */}
          <div className="p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sua Proposta Comercial</h3>

            {errorMessage && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 font-bold">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Quantidade a atender */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quantidade que consigo atender *</label>
                <Input
                  type="number"
                  placeholder="Ex: 100"
                  value={suppliedQty}
                  onChange={(e) => setSuppliedQty(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Data da remessa proposta */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data da Remessa Proposta *</label>
                <Input
                  type="date"
                  value={proposedDeliveryDate}
                  onChange={(e) => setProposedDeliveryDate(e.target.value)}
                  className="h-10 text-sm"
                />
                <p className="text-[9px] text-slate-400 leading-snug">Nota: Entregar antes do prazo aumenta a pontuação comercial.</p>
              </div>

              {/* Preço de referência */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preço de Referência do Comprador</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                  <Input
                    type="number"
                    disabled
                    value={item.referencePrice}
                    className="pl-9 bg-slate-100 border-slate-200 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Preço proposto */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preço Proposto de Venda *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={proposedPrice}
                    onChange={(e) => {
                      setProposedPrice(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className="pl-9 h-10 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Faturamento proposto */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Condição de Faturamento Proposta *</label>
                <select
                  value={proposedPaymentTerm}
                  onChange={(e) => setProposedPaymentTerm(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 bg-white"
                >
                  <option value="21 dias">21 dias (Faturamento)</option>
                  <option value="30 dias">30 dias (Faturamento)</option>
                  <option value="60 dias">60 dias (Faturamento)</option>
                </select>
              </div>

            </div>
          </div>

          {/* Rodapé Form */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate('/quotations')} className="h-10 text-xs">Cancelar</Button>
            <Button type="submit" className="bg-violet-650 bg-violet-600 hover:bg-violet-750 hover:bg-violet-700 text-white h-10 text-xs font-bold shadow-sm">
              Enviar Proposta de Venda
            </Button>
          </div>

        </form>
      )}
    </div>
  );
}
