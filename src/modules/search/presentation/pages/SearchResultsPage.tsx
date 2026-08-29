import { useEffect, useMemo, useState } from 'react';
import { Package, Plus, Tag } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent } from '@/shared/components/ui/Card';
import { useQuotationCart } from '@/modules/quotations/presentation/context/QuotationCartContext';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';
import { SupabaseProductRepository } from '@/modules/products/infrastructure/repositories/SupabaseProductRepository';
import { Product } from '@/modules/products/domain/entities/Product';

const repository = new SupabaseProductRepository();

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { data: identity } = useAuthenticatedIdentity();
  const { addItem } = useQuotationCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!identity?.organizationId) return;
    repository.findAll(identity.organizationId).then(setProducts).catch(caught => setError(caught instanceof Error ? caught.message : 'Busca indisponível.'));
  }, [identity?.organizationId]);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return products.filter(product => !normalized || [product.name, product.sku, product.manufacturer, product.manufacturerCode].some(value => (value || '').toLocaleLowerCase('pt-BR').includes(normalized)));
  }, [products, query]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Resultados para “{query}”</h2><p className="text-sm text-slate-500">{results.length} materiais reais encontrados no catálogo da sua empresa.</p></div>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {results.length === 0 ? <div className="rounded-xl border bg-white p-12 text-center text-sm text-slate-500">Nenhum material correspondente no catálogo real.</div> : <div className="space-y-3">{results.map(item => <Card key={item.id} className="transition-colors hover:border-indigo-200"><CardContent className="flex flex-col items-start gap-6 p-5 md:flex-row md:items-center"><div className="flex-1"><h3 className="text-lg font-bold text-slate-900">{item.name}</h3><div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500"><span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> SKU: {item.sku || 'não informado'}</span><span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {item.categoryName || 'Sem categoria'} · {item.manufacturer || 'Sem fabricante'}</span></div></div><Button disabled={!item.availableForPurchase} onClick={() => addItem({ productId: item.id, name: item.name, uom: item.uom, quantity: 1, manufacturer: item.manufacturer, category: item.categoryName || '', sku: item.sku, partNumber: item.manufacturerCode })} className="gap-2 bg-slate-900 text-white hover:bg-indigo-600"><Plus className="h-4 w-4" /> Adicionar à Cotação</Button></CardContent></Card>)}</div>}
    </div>
  );
}
