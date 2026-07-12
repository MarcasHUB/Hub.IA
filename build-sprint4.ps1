$ErrorActionPreference = 'Stop'
$rootDir = "e:\SupplyHUB"

function Create-File ($path, $content) {
    $fullPath = "$rootDir\$path"
    $dir = Split-Path $fullPath
    if (!(Test-Path $dir)) {
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
    }
    New-Item -Path $fullPath -ItemType File -Force -Value $content | Out-Null
}

Write-Host "Criando módulo Quotations (Domínio)..."

Create-File "src\modules\quotations\domain\entities\QuotationRequest.ts" @'
export enum QuotationStatus {
    DRAFT = 'Draft',
    OPEN = 'Open',
    CLOSED = 'Closed',
    CANCELLED = 'Cancelled'
}

export class QuotationRequest {
    constructor(
        public readonly id: string,
        public readonly tenantId: string,
        public title: string,
        public description: string,
        public readonly requesterId: string,
        public status: QuotationStatus = QuotationStatus.DRAFT,
        public readonly createdAt: Date = new Date(),
        public updatedAt: Date = new Date()
    ) {}
}
'@

Create-File "src\modules\quotations\domain\entities\QuotationItem.ts" @'
export class QuotationItem {
    constructor(
        public readonly id: string,
        public readonly quotationId: string,
        public productId: string,
        public quantity: number,
        public uom: string
    ) {}
}
'@

Create-File "src\modules\quotations\domain\entities\SupplierQuotation.ts" @'
export enum SupplierQuotationStatus {
    PENDING = 'Pending',
    SENT = 'Sent',
    REJECTED = 'Rejected'
}

export class SupplierQuotation {
    constructor(
        public readonly id: string,
        public readonly quotationId: string,
        public readonly supplierId: string,
        public price: number,
        public deliveryDays: number,
        public comments: string,
        public status: SupplierQuotationStatus = SupplierQuotationStatus.PENDING,
        public readonly createdAt: Date = new Date()
    ) {}
}
'@

Write-Host "Criando Contexto do Carrinho de Cotação..."

Create-File "src\modules\quotations\presentation\context\QuotationCartContext.tsx" @'
import React, { createContext, useContext, useState } from 'react';

export interface CartItem {
    productId: string;
    name: string;
    uom: string;
    quantity: number;
    manufacturer: string;
    category: string;
}

interface QuotationCartContextType {
    items: CartItem[];
    addItem: (item: CartItem) => void;
    removeItem: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;
    isCartOpen: boolean;
    setCartOpen: (open: boolean) => void;
}

const QuotationCartContext = createContext<QuotationCartContextType | undefined>(undefined);

export function QuotationCartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isCartOpen, setCartOpen] = useState(false);

    const addItem = (item: CartItem) => {
        setItems(prev => {
            const exists = prev.find(i => i.productId === item.productId);
            if (exists) {
                return prev.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i);
            }
            return [...prev, item];
        });
        setCartOpen(true);
    };

    const removeItem = (productId: string) => {
        setItems(prev => prev.filter(i => i.productId !== productId));
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) return;
        setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity } : i));
    };

    const clearCart = () => {
        setItems([]);
        setCartOpen(false);
    };

    return (
        <QuotationCartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, isCartOpen, setCartOpen }}>
            {children}
        </QuotationCartContext.Provider>
    );
}

export function useQuotationCart() {
    const context = useContext(QuotationCartContext);
    if (!context) {
        throw new Error("useQuotationCart must be used within a QuotationCartProvider");
    }
    return context;
}
'@

Write-Host "Atualizando AppLayout e Header..."

Create-File "src\kernel\layouts\AppLayout.tsx" @'
import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Outlet, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, X, Trash2 } from 'lucide-react';
import { Input } from '@/shared/components/ui/Input';
import { Button } from '@/shared/components/ui/Button';
import { useQuotationCart } from '@/modules/quotations/presentation/context/QuotationCartContext';

export function AppLayout() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { items, isCartOpen, setCartOpen, removeItem, updateQuantity } = useQuotationCart();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleFinishQuotation = () => {
    setCartOpen(false);
    navigate('/quotations/new');
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden relative">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Global */}
        <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 md:px-8 shrink-0">
            
            <div className="flex-1 flex justify-center px-4 md:px-8">
              <form onSubmit={handleSearch} className="w-full max-w-2xl relative flex items-center">
                <Search className="absolute left-3 h-5 w-5 text-slate-400" />
                <Input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar produtos..." 
                  className="w-full pl-10 h-10 bg-slate-50 border-slate-300 focus-visible:ring-indigo-500 rounded-l-md rounded-r-none"
                />
                <Button type="submit" className="rounded-l-none h-10 bg-indigo-600 hover:bg-indigo-700 text-white">
                  Buscar
                </Button>
              </form>
            </div>

            <div className="flex items-center gap-4 shrink-0">
                {/* Botão do Carrinho */}
                <button 
                  onClick={() => setCartOpen(true)}
                  className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors flex items-center gap-2"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {items.length > 0 && (
                    <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {items.length}
                    </span>
                  )}
                  <span className="hidden md:inline-block text-sm font-medium">Cotação Atual</span>
                </button>

                <div className="h-8 border-l border-slate-200 mx-2 hidden md:block"></div>

                <div className="h-8 w-8 rounded-full bg-indigo-900 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    AD
                </div>
            </div>
        </div>
        
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-7xl mx-auto min-h-full">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Side Drawer (Cart) */}
      {isCartOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => setCartOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-full duration-300">
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-indigo-600" />
                Cotação Atual
              </h2>
              <button onClick={() => setCartOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.length === 0 ? (
                <div className="text-center text-slate-500 mt-10">
                  <ShoppingCart className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <p>Sua cesta de cotação está vazia.</p>
                  <p className="text-sm mt-2">Pesquise produtos e adicione-os aqui.</p>
                </div>
              ) : (
                items.map(item => (
                  <div key={item.productId} className="flex gap-4 border border-slate-200 p-4 rounded-lg bg-slate-50 relative group">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 text-sm leading-tight pr-6">{item.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">{item.manufacturer} • {item.category}</p>
                      
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center border border-slate-300 rounded-md bg-white">
                          <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="px-2 py-1 text-slate-500 hover:text-slate-900">-</button>
                          <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="px-2 py-1 text-slate-500 hover:text-slate-900">+</button>
                        </div>
                        <span className="text-xs font-medium text-slate-500">{item.uom}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeItem(item.productId)}
                      className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            
            {items.length > 0 && (
              <div className="p-6 border-t border-slate-200 bg-slate-50">
                <Button onClick={handleFinishQuotation} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  Revisar Cotação ({items.length} itens)
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
'@

Write-Host "Atualizando App.tsx para incluir o Provider..."
Create-File "src\App.tsx" @'
import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/kernel/router';
import { QuotationCartProvider } from '@/modules/quotations/presentation/context/QuotationCartContext';

export default function App() {
  return (
    <QuotationCartProvider>
      <RouterProvider router={router} />
    </QuotationCartProvider>
  );
}
'@

Write-Host "Modificando Botão da Tela de Pesquisa..."
Create-File "src\modules\search\presentation\pages\SearchResultsPage.tsx" @'
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { Package, Tag, Clock, Plus } from 'lucide-react';
import { useQuotationCart } from '@/modules/quotations/presentation/context/QuotationCartContext';

const mockResults = [
  { id: '1', name: 'Cabo Flexível 35mm 1kV', sku: 'CAB-35-FLX', category: 'Elétrica / Cabos', manufacturer: 'Sil', price: 18.50, uom: 'MT', status: 'Active', updatedAt: '2026-07-01' },
  { id: '2', name: 'Luva Nitrílica P', sku: 'LUV-NIT-P', category: 'EPI / Luvas', manufacturer: 'Volk', price: 25.90, uom: 'CX', status: 'Active', updatedAt: '2026-07-03' },
  { id: '3', name: 'Graxa Industrial Complexo Lítio', sku: 'GRX-LIT-20', category: 'Manutenção / Lubrificantes', manufacturer: 'Texaco', price: 145.90, uom: 'KG', status: 'Active', updatedAt: '2026-07-05' },
];

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { addItem } = useQuotationCart();

  const handleAdd = (product: any) => {
    addItem({
      productId: product.id,
      name: product.name,
      uom: product.uom,
      quantity: 1,
      manufacturer: product.manufacturer,
      category: product.category
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
      {/* Sidebar de Filtros (Simplificada para brevidade) */}
      <aside className="w-full md:w-64 shrink-0 space-y-6">
        <div>
          <h3 className="font-semibold text-slate-900 mb-4">Filtros</h3>
          {/* ... filtros aqui ... */}
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-md">
            <p className="text-xs text-indigo-800 font-medium">Dica: Adicione produtos à sua Cesta de Cotação enquanto navega!</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 w-full space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Resultados para "{query}"</h2>
            <p className="text-sm text-slate-500">{mockResults.length} produtos encontrados no catálogo geral.</p>
          </div>
        </div>

        <div className="space-y-3">
          {mockResults.map((item) => (
            <Card key={item.id} className="hover:border-indigo-200 transition-colors group">
              <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{item.name}</h3>
                  </div>
                  <div className="text-sm text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                    <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> SKU: {item.sku}</span>
                    <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {item.category} • {item.manufacturer}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 min-w-[200px] border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                  <div className="text-right">
                    <p className="text-xs text-slate-500 mb-1">Preço Referência (Estimado)</p>
                    <p className="text-2xl font-bold text-slate-900">R$ {item.price.toFixed(2)}</p>
                  </div>
                  <Button 
                    onClick={() => handleAdd(item)}
                    className="w-full bg-slate-900 hover:bg-indigo-600 text-white gap-2 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Adicionar à Cotação
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
'@

Write-Host "Criando Telas de Cotações..."

Create-File "src\modules\quotations\presentation\pages\NewQuotationPage.tsx" @'
import React from 'react';
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
                {items.map((item, index) => (
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
'@

Create-File "src\modules\quotations\presentation\pages\QuotationsListPage.tsx" @'
import React from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { useNavigate } from 'react-router-dom';

const mockQuotations = [
  { id: '1001', title: 'Manutenção Preventiva Mês 07', items: 5, responses: 3, status: 'Open', date: 'Hoje' },
  { id: '1002', title: 'EPIs para Obra Matriz', items: 12, responses: 8, status: 'Closed', date: 'Ontem' },
  { id: '1003', title: 'Peças Torno Mecânico', items: 2, responses: 0, status: 'Draft', date: '01/07/2026' },
];

export default function QuotationsListPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Painel de Cotações</h2>
          <p className="text-slate-500">Acompanhe as solicitações e compare as propostas recebidas.</p>
        </div>
        <Button onClick={() => navigate('/search')}>Nova Cotação</Button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Qtd. Itens</TableHead>
              <TableHead>Propostas</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockQuotations.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-medium text-slate-900">#{q.id}</TableCell>
                <TableCell className="font-medium">{q.title}</TableCell>
                <TableCell>{q.items}</TableCell>
                <TableCell>
                  <span className={q.responses > 0 ? "font-bold text-indigo-600" : "text-slate-400"}>
                    {q.responses} recebidas
                  </span>
                </TableCell>
                <TableCell>{q.date}</TableCell>
                <TableCell>
                  <Badge variant={q.status === 'Open' ? 'success' : q.status === 'Closed' ? 'secondary' : 'outline'}>
                    {q.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/quotations/${q.id}/compare`)}>
                    {q.status === 'Open' ? 'Comparar Propostas' : 'Ver Detalhes'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
'@

Create-File "src\modules\quotations\presentation\pages\QuotationComparisonPage.tsx" @'
import React from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/Badge';
import { Check, Trophy, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function QuotationComparisonPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Comparação de Propostas</h2>
          <p className="text-slate-500">Cotação #1001 - Manutenção Preventiva Mês 07 (5 Itens)</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/quotations')}>Voltar</Button>
      </div>

      {/* Resumo da Inteligência */}
      <Card className="bg-indigo-900 border-indigo-950 text-white">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-indigo-800 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-indigo-200">Recomendação da Inteligência</p>
              <h3 className="font-bold text-xl">Fornecedor: Brasil Cabos</h3>
              <p className="text-sm text-indigo-200">Menor preço global (-12%) com prazo de 2 dias.</p>
            </div>
          </div>
          <Button className="bg-white text-indigo-900 hover:bg-slate-100 font-bold">
            Aprovar Proposta Global
          </Button>
        </CardContent>
      </Card>

      {/* Matriz de Preços (Tabela) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold">Produto (Qtd)</th>
              <th className="px-6 py-4 font-semibold text-center border-l border-slate-200 bg-indigo-50/50">Brasil Cabos <Badge className="ml-2 bg-indigo-100 text-indigo-700">Rank A</Badge></th>
              <th className="px-6 py-4 font-semibold text-center border-l border-slate-200">Eletro Tudo B2B <Badge className="ml-2 bg-slate-200 text-slate-700">Rank B</Badge></th>
              <th className="px-6 py-4 font-semibold text-center border-l border-slate-200">Fixação Ind. <Badge className="ml-2 bg-slate-200 text-slate-700">Rank C</Badge></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {/* Item 1 */}
            <tr className="hover:bg-slate-50">
              <td className="px-6 py-4">
                <p className="font-medium text-slate-900">Cabo Flexível 35mm (100 MT)</p>
                <p className="text-xs text-slate-500">Ref: R$ 18,50/MT</p>
              </td>
              <td className="px-6 py-4 text-center border-l border-slate-200 bg-indigo-50/20">
                <p className="font-bold text-green-600">R$ 17,90/MT</p>
                <p className="text-xs text-slate-500 mt-1">Prazo: 2 dias</p>
              </td>
              <td className="px-6 py-4 text-center border-l border-slate-200">
                <p className="font-bold text-slate-900">R$ 18,50/MT</p>
                <p className="text-xs text-slate-500 mt-1">Prazo: 1 dia</p>
              </td>
              <td className="px-6 py-4 text-center border-l border-slate-200">
                <p className="font-bold text-red-600">R$ 19,20/MT</p>
                <p className="text-xs text-slate-500 mt-1">Prazo: 5 dias</p>
              </td>
            </tr>
            {/* Item 2 */}
            <tr className="hover:bg-slate-50">
              <td className="px-6 py-4">
                <p className="font-medium text-slate-900">Luva Nitrílica P (50 CX)</p>
                <p className="text-xs text-slate-500">Ref: R$ 25,90/CX</p>
              </td>
              <td className="px-6 py-4 text-center border-l border-slate-200 bg-indigo-50/20">
                <p className="font-bold text-slate-900">R$ 26,00/CX</p>
                <p className="text-xs text-slate-500 mt-1">Prazo: 2 dias</p>
              </td>
              <td className="px-6 py-4 text-center border-l border-slate-200">
                <p className="font-bold text-green-600">R$ 24,50/CX</p>
                <p className="text-xs text-slate-500 mt-1">Prazo: 3 dias</p>
              </td>
              <td className="px-6 py-4 text-center border-l border-slate-200">
                <span className="text-slate-400 italic text-xs flex items-center justify-center gap-1"><AlertCircle className="h-3 w-3"/> Não cotou</span>
              </td>
            </tr>
            {/* Totais */}
            <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
              <td className="px-6 py-4 text-right">Valor Global:</td>
              <td className="px-6 py-4 text-center text-lg text-indigo-700 bg-indigo-100/50 border-l border-slate-200">R$ 3.090,00 <Check className="inline h-5 w-5 text-green-600 ml-1"/></td>
              <td className="px-6 py-4 text-center text-lg text-slate-900 border-l border-slate-200">R$ 3.075,00</td>
              <td className="px-6 py-4 text-center text-lg text-slate-900 border-l border-slate-200">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
'@

Write-Host "Atualizando Router..."

Create-File "src\kernel\router\index.tsx" @'
import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';

const LoginPage = React.lazy(() => import('../../modules/auth/presentation/pages/LoginPage'));
const DashboardPage = React.lazy(() => import('../../modules/dashboard/presentation/pages/DashboardPage'));
const SuppliersListPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/SuppliersListPage'));
const SupplierFormPage = React.lazy(() => import('../../modules/suppliers/presentation/pages/SupplierFormPage'));
const ProductsListPage = React.lazy(() => import('../../modules/products/presentation/pages/ProductsListPage'));
const ProductFormPage = React.lazy(() => import('../../modules/products/presentation/pages/ProductFormPage'));
const SearchResultsPage = React.lazy(() => import('../../modules/search/presentation/pages/SearchResultsPage'));
const QuotationsListPage = React.lazy(() => import('../../modules/quotations/presentation/pages/QuotationsListPage'));
const NewQuotationPage = React.lazy(() => import('../../modules/quotations/presentation/pages/NewQuotationPage'));
const QuotationComparisonPage = React.lazy(() => import('../../modules/quotations/presentation/pages/QuotationComparisonPage'));

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="p-8 flex justify-center text-slate-500">Carregando...</div>}>
    {children}
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    element: <AuthLayout><Outlet /></AuthLayout>,
    children: [
      {
        path: '/login',
        element: <SuspenseWrapper><LoginPage /></SuspenseWrapper>,
      }
    ]
  },
  {
    element: <AppLayout />,
    children: [
      {
        path: '/dashboard',
        element: <SuspenseWrapper><DashboardPage /></SuspenseWrapper>,
      },
      {
        path: '/suppliers',
        element: <SuspenseWrapper><SuppliersListPage /></SuspenseWrapper>,
      },
      {
        path: '/suppliers/new',
        element: <SuspenseWrapper><SupplierFormPage /></SuspenseWrapper>,
      },
      {
        path: '/products',
        element: <SuspenseWrapper><ProductsListPage /></SuspenseWrapper>,
      },
      {
        path: '/products/new',
        element: <SuspenseWrapper><ProductFormPage /></SuspenseWrapper>,
      },
      {
        path: '/search',
        element: <SuspenseWrapper><SearchResultsPage /></SuspenseWrapper>,
      },
      {
        path: '/quotations',
        element: <SuspenseWrapper><QuotationsListPage /></SuspenseWrapper>,
      },
      {
        path: '/quotations/new',
        element: <SuspenseWrapper><NewQuotationPage /></SuspenseWrapper>,
      },
      {
        path: '/quotations/:id/compare',
        element: <SuspenseWrapper><QuotationComparisonPage /></SuspenseWrapper>,
      },
    ]
  }
]);
'@

Write-Host "Script concluído com sucesso."
