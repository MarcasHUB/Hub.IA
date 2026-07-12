import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { useNavigate } from 'react-router-dom';
import { useQuotationCart } from '../context/QuotationCartContext';
import { FileText, Send, Building2 } from 'lucide-react';

export default function NewQuotationPage() {
  const navigate = useNavigate();
  const { items, clearCart } = useQuotationCart();

  const handleSendQuotation = (e: React.FormEvent) => {
    e.preventDefault();
    clearCart(); // Limpa o carrinho
    navigate('/quotations'); // Redireciona para a lista
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-slate-900">Nenhum item selecionado</h2>
        <p className="text-slate-500 mt-2">Você precisa adicionar itens à Cesta de Cotação primeiro.</p>
        <Button onClick={() => navigate('/search')} className="mt-6">Voltar para Pesquisa</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-indigo-600" />
          Revisar e Enviar Cotação
        </h2>
        <p className="text-slate-500">Configure os parâmetros e dispare a solicitação para o mercado.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário Principal */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-4">Dados da Solicitação</h3>
              <div className="space-y-2">
                <Label htmlFor="title">Título / Referência Interna</Label>
                <Input id="title" placeholder="Ex: Manutenção Preventiva - Julho" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Prazo para Respostas</Label>
                <Input id="deadline" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="obs">Observações para os Fornecedores</Label>
                <textarea id="obs" className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" placeholder="Especifique exigências de entrega, garantias, etc." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-4">Itens Solicitados ({items.length})</h3>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.manufacturer}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{item.quantity}</span>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{item.uom}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Painel Lateral Direito */}
        <div className="space-y-6">
          <Card className="bg-indigo-50 border-indigo-100">
            <CardContent className="p-6">
              <h3 className="font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Fornecedores Convidados
              </h3>
              <p className="text-sm text-indigo-700 mb-4">
                O SupplyHub selecionará automaticamente os <strong>8 melhores fornecedores</strong> homologados nas categorias dos itens solicitados.
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-indigo-800">
                  <input type="checkbox" defaultChecked className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500" />
                  Incluir fornecedores em homologação
                </label>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSendQuotation} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-base font-semibold shadow-md">
            <Send className="h-5 w-5" />
            Disparar Cotação
          </Button>
          <p className="text-xs text-center text-slate-400">Ao disparar, a cotação mudará para o status "Open" e e-mails serão enviados.</p>
        </div>
      </div>
    </div>
  );
}