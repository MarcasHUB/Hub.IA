# Conversations - Histórico do Projeto SupplyHub

## Visão Geral

Plataforma B2B de marketplace inteligente para compras corporativas.
Stack: **React 18 + TypeScript + Vite + TailwindCSS + React Router v6 + Supabase + React Query**

---

## Histórico de Sprints (Build Scripts)

O projeto foi construído incrementalmente via scripts PowerShell:

| Script | Fase | O que Criou |
|--------|------|-------------|
| `setup-git.ps1` | Fundação | README, CHANGELOG, LICENSE, .gitignore |
| `scaffold.ps1` | Estrutura | Monorepo (apps/web + packages/hub-core), dirs dos módulos |
| `restructure.ps1` | Reestruturação | Colapsou monorepo para src/ flat, criou contracts/ e sdk/ |
| `setup-vite.ps1` | Build | tsconfig, vite.config, tailwind, postcss, index.html, App.tsx, main.tsx |
| `setup-ui.ps1` | UI Components | cn.ts, Button, Input, Label, Card, Badge, Table, Layouts |
| `setup-pages.ps1` | Primeiras Páginas | LoginPage, DashboardPage, SuppliersList/Form, Router v1 |
| `build-modules.ps1` | Domain/Application | Supabase client, EventBus, Auth (entity, repo, DTOs, use case), Identity, Organizations, Suppliers |
| `build-sprint2.ps1` | Categories + Products | Category, Product (entities+repos+DTOs+use cases), ProductsList/Form, Dashboard v2 |
| `build-sprint3.ps1` | Search | SearchResult, SearchDTOs, SearchResultsPage, AppLayout c/ search, Dashboard v3 |
| `build-sprint4.ps1` | Quotations | Quotation entities, CartContext, pages (list/new/compare), AppLayout c/ cart drawer |
| `build-sprint5.ps1` | Intelligence + DB | env.ts, SQL migration (8 tables + RLS), IntelligenceDashboard, Sidebar v2 |
| `build-landing.ps1` | Landing Page | LandingPage.tsx (marketing completa), Router v6 |

---

## Decisões Arquiteturais (ADRs)

| ADR | Decisão |
|-----|---------|
| 0001 | **Domain-Driven Design** - monólito modular com kernel, modules, infrastructure, shared |
| 0002 | **Supabase** como backend (Auth, DB PostgreSQL, RLS, Storage) |
| 0003 | **React Query** para gerenciamento de estado servidor e cache |

---

## Estrutura de Módulos

### Com implementação real (entities + interfaces + partial UI)
- **auth** - LoginUseCase, SupabaseAuthRepository, LoginPage (mock)
- **suppliers** - CreateSupplierUseCase, SuppliersListPage, SupplierFormPage
- **products** - CreateProductUseCase, ProductsListPage, ProductFormPage
- **quotations** - CartContext, QuotationsList/New/ComparisonPage
- **dashboard** - DashboardPage (KPI cards mock)
- **intelligence** - IntelligenceDashboardPage (analytics mock)
- **search** - SearchResultsPage (com add to cart)

### Com domain entities apenas (sem application/presentation)
- **categories** - Category entity + ICategoryRepository
- **identity** - User entity + IUserRepository
- **organizations** - Organization entity + IOrganizationRepository

### Stubs (apenas barrel index.ts vazio)
admin, ai, audit, core, employees, files, integrations, notifications, reports, settings, units, workflows

---

## Auditoria de Código (Realizada em 10/07/2026)

### Comando executado: `npx tsc --noEmit` + análise manual de conectividade

### ✅ 22 ERROS DE COMPILAÇÃO (BLOQUEANTES)

#### Grupo 1: `import.meta.env` sem tipos (2 arquivos)
```
src/infrastructure/supabase/client.ts:3-4
src/kernel/config/env.ts:2-4
```
**Causa:** Falta `/// <reference types="vite/client" />` no `env.d.ts` ou `tsconfig.json`
**Correção:** Adicionar `"types": ["vite/client"]` no tsconfig ou criar `src/vite-env.d.ts`

#### Grupo 2: `React` importado sem uso (10 arquivos)
```
src/App.tsx
src/kernel/layouts/Sidebar.tsx
src/modules/dashboard/presentation/pages/DashboardPage.tsx
src/modules/intelligence/presentation/pages/IntelligenceDashboardPage.tsx
src/modules/landing/presentation/pages/LandingPage.tsx
src/modules/products/presentation/pages/ProductsListPage.tsx
src/modules/quotations/presentation/pages/QuotationComparisonPage.tsx
src/modules/quotations/presentation/pages/QuotationsListPage.tsx
src/modules/search/presentation/pages/SearchResultsPage.tsx
src/modules/suppliers/presentation/pages/SuppliersListPage.tsx
```
**Causa:** `"jsx": "react-jsx"` dispensa import do React. `noUnusedLocals: true` quebra.
**Correção:** Remover `import React from 'react'` desses arquivos.

#### Grupo 3: Imports não utilizados (5 ocorrências)
| Arquivo | Símbolo |
|---------|---------|
| `src/kernel/router/index.tsx:2` | `Navigate` |
| `src/modules/intelligence/IntelligenceDashboardPage.tsx:4` | `TrendingUp` |
| `src/modules/landing/LandingPage.tsx:4` | `Box`, `Sprout` |
| `src/modules/search/SearchResultsPage.tsx:4` | `Badge` |
| `src/modules/search/SearchResultsPage.tsx:6` | `Clock` |
| `src/modules/quotations/NewQuotationPage.tsx:65` | `index` (parâmetro `.map()`) |

### 🟡 PROBLEMAS DE CONECTIVIDADE (3)

| Problema | Arquivo | Impacto |
|----------|---------|---------|
| Sidebar link "Organizações" → `/organizations` sem rota | `Sidebar.tsx:13` | 404 |
| Sidebar link "Configurações" → `/settings` sem rota | `Sidebar.tsx:55` | 404 |
| Botão "Nova Cotação" navega para `/search` em vez de `/quotations/new` | `QuotationsListPage.tsx:23` | UX inconsistente |

### 🟠 PROBLEMAS ARQUITETURAIS (4)

| Problema | Detalhes |
|----------|----------|
| **Login mockado** | `LoginPage.tsx` só faz `navigate('/dashboard')`. `SupabaseAuthRepository` e `LoginUseCase` existem mas não são chamados |
| **21 barrel files vazios** | Todos `modules/*/index.ts` têm só comentários, sem re-exports |
| **6 configs vazias** | `core/config/` (constants, environment, features, permissions, roles, routes) são stubs |
| **AGENTS.md com path errado** | Refere `apps/web/docs/` mas o projeto foi reestruturado para `docs/` |

### 🔵 COSMÉTICOS (2)

| Problema | Arquivo |
|----------|---------|
| `<html lang="en">` em português | `index.html:2` |
| Favicon `/vite.svg` não existe (ref. em `index.html:5`) | `index.html:5` |

---

## Pendências para Próximas Sprints

1. **Corrigir 22 erros de compilação** (pré-requisito para build)
2. **Criar rotas `/organizations` e `/settings`** (resolver 404s)
3. **Conectar Login real** com SupabaseAuthRepository
4. **Implementar repositórios reais** (substituir mocks por queries Supabase)
5. **Preencher barrel exports** dos módulos
6. **Implementar core/config** (constants, permissions, roles, features)
7. **Finalizar módulos stub** conforme Roadmap
8. **Criar testes** (unit, integration, e2e)
9. **Adicionar CI/CD, Docker, i18n**
