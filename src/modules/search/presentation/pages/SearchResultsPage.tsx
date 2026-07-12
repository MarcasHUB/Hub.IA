import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui/Button';
import { Package, Tag, Plus } from 'lucide-react';
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
                    <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {item.category} �?� {item.manufacturer}</span>
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