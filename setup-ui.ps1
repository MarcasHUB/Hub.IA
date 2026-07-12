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

Write-Host "Criando utils..."

Create-File "src\shared\utils\cn.ts" @'
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
'@

Write-Host "Criando componentes shadcn-like..."

Create-File "src\shared\components\ui\Button.tsx" @'
import React from 'react';
import { cn } from '@/shared/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-slate-900 text-slate-50 hover:bg-slate-900/90": variant === 'default',
            "bg-red-500 text-slate-50 hover:bg-red-500/90": variant === 'destructive',
            "border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900": variant === 'outline',
            "bg-slate-100 text-slate-900 hover:bg-slate-100/80": variant === 'secondary',
            "hover:bg-slate-100 hover:text-slate-900": variant === 'ghost',
            "text-slate-900 underline-offset-4 hover:underline": variant === 'link',
            "h-10 px-4 py-2": size === 'default',
            "h-9 rounded-md px-3": size === 'sm',
            "h-11 rounded-md px-8": size === 'lg',
            "h-10 w-10": size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
'@

Create-File "src\shared\components\ui\Input.tsx" @'
import React from 'react';
import { cn } from '@/shared/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
'@

Create-File "src\shared\components\ui\Label.tsx" @'
import React from 'react';
import { cn } from '@/shared/utils/cn';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          className
        )}
        {...props}
      />
    );
  }
);
Label.displayName = 'Label';
'@

Create-File "src\shared\components\ui\Card.tsx" @'
import React from 'react';
import { cn } from '@/shared/utils/cn';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white text-slate-950 shadow", className)} {...props} />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-slate-500", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}
'@

Create-File "src\shared\components\ui\Badge.tsx" @'
import React from 'react';
import { cn } from '@/shared/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-slate-900 text-slate-50 shadow hover:bg-slate-900/80": variant === 'default',
          "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80": variant === 'secondary',
          "border-transparent bg-red-500 text-slate-50 shadow hover:bg-red-500/80": variant === 'destructive',
          "border-transparent bg-green-500 text-slate-50 shadow hover:bg-green-500/80": variant === 'success',
          "text-slate-950": variant === 'outline',
        },
        className
      )}
      {...props}
    />
  );
}
'@

Create-File "src\shared\components\ui\Table.tsx" @'
import React from 'react';
import { cn } from '@/shared/utils/cn';

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-slate-200 transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100",
        className
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 px-2 text-left align-middle font-medium text-slate-500 [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "p-2 align-middle [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  );
}
'@

Write-Host "Criando AppLayout e AuthLayout..."

Create-File "src\kernel\layouts\AuthLayout.tsx" @'
import React from 'react';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md p-8">
        {children}
      </div>
    </div>
  );
}
'@

Create-File "src\kernel\layouts\Sidebar.tsx" @'
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import { Home, Users, Building2, Package, Search, Settings, FileText, LayoutDashboard } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Organizações', href: '/organizations', icon: Building2 },
  { name: 'Fornecedores', href: '/suppliers', icon: Users },
  { name: 'Produtos', href: '/products', icon: Package },
  { name: 'Cotações', href: '/quotations', icon: FileText },
  { name: 'Pesquisa', href: '/search', icon: Search },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-14 items-center border-b border-slate-200 px-6">
        <span className="text-xl font-bold tracking-tight text-slate-900">SupplyHub</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-4">
          {navigation.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                  isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    isActive ? "text-slate-900" : "text-slate-400 group-hover:text-slate-500"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-slate-200 p-4">
        <Link
          to="/settings"
          className="group flex items-center rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <Settings className="mr-3 h-5 w-5 text-slate-400 group-hover:text-slate-500" />
          Configurações
        </Link>
      </div>
    </div>
  );
}
'@

Create-File "src\kernel\layouts\AppLayout.tsx" @'
import React from 'react';
import { Sidebar } from './Sidebar';
import { Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-8">
            <span className="text-sm font-medium text-slate-500">Logado em: <strong className="text-slate-900">Empresa Global S/A</strong></span>
            <div className="flex items-center gap-4">
                <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                    AD
                </div>
            </div>
        </div>
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
'@

Write-Host "Componentes e Layouts gerados com sucesso."
