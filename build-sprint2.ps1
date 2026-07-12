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

Write-Host "Criando módulo Categories..."

Create-File "src\modules\categories\domain\entities\Category.ts" @'
export enum CategoryStatus {
    ACTIVE = 'Active',
    INACTIVE = 'Inactive'
}

export class Category {
    constructor(
        public readonly id: string,
        public readonly tenantId: string,
        public name: string,
        public description: string,
        public parentId?: string,
        public status: CategoryStatus = CategoryStatus.ACTIVE,
        public readonly createdAt: Date = new Date(),
        public updatedAt: Date = new Date()
    ) {}
}
'@

Create-File "src\modules\categories\domain\repositories\ICategoryRepository.ts" @'
import { Category } from '../entities/Category';

export interface ICategoryRepository {
    findById(id: string, tenantId: string): Promise<Category | null>;
    findAll(tenantId: string): Promise<Category[]>;
    save(category: Category): Promise<void>;
}
'@

Write-Host "Criando módulo Products..."

Create-File "src\modules\products\domain\entities\Product.ts" @'
export enum ProductStatus {
    DRAFT = 'Draft',
    ACTIVE = 'Active',
    INACTIVE = 'Inactive'
}

export class Product {
    constructor(
        public readonly id: string,
        public readonly tenantId: string,
        public supplierId: string,
        public categoryId: string,
        public name: string,
        public description: string,
        public sku: string,
        public uom: string, // Unit of Measure
        public manufacturer: string,
        public price: number, // Reference Price for comparisons
        public status: ProductStatus = ProductStatus.ACTIVE,
        
        // Espaço preparado para o futuro:
        // public costPrice?: number,
        // public listPrice?: number,
        // public currency: string = 'BRL',
        // public lastPriceUpdate?: Date,
        
        public readonly createdAt: Date = new Date(),
        public updatedAt: Date = new Date()
    ) {}
}
'@

Create-File "src\modules\products\domain\repositories\IProductRepository.ts" @'
import { Product } from '../entities/Product';

export interface IProductRepository {
    findById(id: string, tenantId: string): Promise<Product | null>;
    findAll(tenantId: string): Promise<Product[]>;
    save(product: Product): Promise<void>;
}
'@

Create-File "src\modules\products\application\dto\ProductDTOs.ts" @'
import { ProductStatus } from '../../domain/entities/Product';

export interface CreateProductRequestDTO {
    supplierId: string;
    categoryId: string;
    name: string;
    description: string;
    sku: string;
    uom: string;
    manufacturer: string;
    price: number;
}

export interface ProductResponseDTO {
    id: string;
    name: string;
    sku: string;
    uom: string;
    manufacturer: string;
    price: number;
    status: ProductStatus;
    updatedAt: Date;
}
'@

Create-File "src\modules\products\application\use-cases\CreateProductUseCase.ts" @'
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { Product, ProductStatus } from '../../domain/entities/Product';
import { CreateProductRequestDTO, ProductResponseDTO } from '../dto/ProductDTOs';
import { EventBus } from '../../../../kernel/events/EventBus';

export class CreateProductUseCase {
    constructor(
        private readonly productRepository: IProductRepository,
        private readonly eventBus: EventBus
    ) {}

    async execute(request: CreateProductRequestDTO, tenantId: string): Promise<ProductResponseDTO> {
        const product = new Product(
            crypto.randomUUID(),
            tenantId,
            request.supplierId,
            request.categoryId,
            request.name,
            request.description,
            request.sku,
            request.uom,
            request.manufacturer,
            request.price,
            ProductStatus.ACTIVE
        );

        await this.productRepository.save(product);

        await this.eventBus.publish({
            eventName: 'ProductCreated',
            occurredOn: new Date(),
            payload: { productId: product.id, tenantId }
        });

        return {
            id: product.id,
            name: product.name,
            sku: product.sku,
            uom: product.uom,
            manufacturer: product.manufacturer,
            price: product.price,
            status: product.status,
            updatedAt: product.updatedAt
        };
    }
}
'@

Write-Host "Criando Telas UI de Produtos..."

Create-File "src\modules\products\presentation\pages\ProductsListPage.tsx" @'
import React from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/Table';
import { Badge } from '@/shared/components/ui/Badge';
import { Plus, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const mockProducts = [
  { id: '1', name: 'Cabo Flexível 35mm', sku: 'CAB-35-FLX', supplier: 'Brasil Cabos', category: 'Elétrica / Cabos', manufacturer: 'Sil', price: 18.50, status: 'Active', updatedAt: '2026-07-01' },
  { id: '2', name: 'Parafuso Sextavado M8', sku: 'PAR-M8-SEX', supplier: 'Fixação Industrial', category: 'Ferrengens / Parafusos', manufacturer: 'Ciser', price: 0.45, status: 'Active', updatedAt: '2026-07-02' },
  { id: '3', name: 'Luva Nitrílica P', sku: 'LUV-NIT-P', supplier: 'Segurança Total', category: 'EPI / Luvas', manufacturer: 'Volk', price: 25.90, status: 'Draft', updatedAt: '2026-07-05' },
];

export default function ProductsListPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Catálogo de Produtos</h2>
          <p className="text-slate-500">Gerencie os produtos atrelados aos seus fornecedores.</p>
        </div>
        <Button onClick={() => navigate('/products/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Fabricante</TableHead>
              <TableHead className="text-right">Preço Ref.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Última Att.</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium text-slate-900">{product.name}</TableCell>
                <TableCell className="text-slate-500">{product.sku}</TableCell>
                <TableCell>{product.supplier}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell>{product.manufacturer}</TableCell>
                <TableCell className="text-right font-medium">R$ {product.price.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={product.status === 'Active' ? 'success' : 'secondary'}>
                    {product.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-500">{product.updatedAt}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
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

Create-File "src\modules\products\presentation\pages\ProductFormPage.tsx" @'
import React from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { useNavigate } from 'react-router-dom';

export default function ProductFormPage() {
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/products');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cadastrar Produto</h2>
        <p className="text-slate-500">Adicione um novo item ao catálogo corporativo.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Produto</Label>
              <Input id="name" placeholder="Ex: Luva Nitrílica P" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" placeholder="Ex: LUV-NIT-P" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" placeholder="Descrição detalhada do produto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Fabricante</Label>
              <Input id="manufacturer" placeholder="Ex: Volk" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uom">Unidade de Medida (UoM)</Label>
              <Input id="uom" placeholder="Ex: CX, PC, KG, UN" required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
            <div className="space-y-2">
              <Label htmlFor="supplierId">Fornecedor</Label>
              <Input id="supplierId" placeholder="Selecione..." required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">Categoria</Label>
              <Input id="categoryId" placeholder="Selecione..." required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Preço Base (Referência)</Label>
              <Input id="price" type="number" step="0.01" placeholder="0.00" required />
            </div>
          </div>

        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={() => navigate('/products')}>
            Cancelar
          </Button>
          <Button type="submit">
            Salvar Produto
          </Button>
        </div>
      </form>
    </div>
  );
}
'@

Write-Host "Atualizando Dashboard..."

Create-File "src\modules\dashboard\presentation\pages\DashboardPage.tsx" @'
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Users, Package, FileText, TrendingDown, Clock } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard de Compras</h2>
        <p className="text-slate-500">Bem-vindo de volta! Aqui está o resumo das suas operações.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fornecedores</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">128</div>
            <p className="text-xs text-slate-500">Ativos na plataforma</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Produtos Cadastrados</CardTitle>
            <Package className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3.450</div>
            <p className="text-xs text-slate-500">Em 24 categorias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Economia Potencial</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">R$ 184.350</div>
            <p className="text-xs text-slate-500">Baseado no último trimestre</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cotações Realizadas</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.284</div>
            <p className="text-xs text-slate-500">Processadas digitalmente</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-600" />
              Últimos Produtos Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Cabo Flexível 35mm', supplier: 'Brasil Cabos', date: 'Hoje, 14:30' },
                { name: 'Parafuso Sextavado M8', supplier: 'Fixação Industrial', date: 'Hoje, 10:15' },
                { name: 'Luva Nitrílica P', supplier: 'Segurança Total', date: 'Ontem, 16:45' }
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900">{item.name}</span>
                    <span className="text-sm text-slate-500">{item.supplier}</span>
                  </div>
                  <div className="text-sm text-slate-400">
                    {item.date}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
    ]
  }
]);
'@

Write-Host "Script concluído com sucesso."
