# Roadmap SupplyHub

## Fase 1: Foundation ✅ (Concluída)
**Objetivo:** Base do projeto configurada e deployável.
- [x] Vite + React + TypeScript + TailwindCSS
- [x] React Router v6 com lazy loading
- [x] Estrutura DDD (kernel, modules, infrastructure, shared)
- [x] tsconfig com paths `@/` + Vite alias
- [x] UI Components: Button, Input, Label, Card, Badge, Table
- [x] Layouts: AppLayout (search + cart), AuthLayout, Sidebar
- [x] Utilitário `cn()` (clsx + tailwind-merge)
- [x] `vite-env.d.ts` com tipos Vite
- [x] Landing Page (marketing completa)

## Fase 2: Identity ✅ (Domain OK, sem Presentation)
**Objetivo:** Usuários e autenticação.
- [x] Entidade `User` + `IAuthUser` + `IAuthRepository`
- [x] `LoginUseCase` + `SupabaseAuthRepository`
- [x] LoginPage (mock — redireciona para dashboard)
- [ ] **Conectar Login real** — integrar `LoginPage` com `LoginUseCase` + `SupabaseAuthRepository`
- [ ] Página de registro de usuário
- [ ] Recuperação de senha
- [ ] Auth guard / PrivateRoute

## Fase 3: Organizations ✅ (Domain OK, sem UI)
**Objetivo:** Multi-tenancy com organizações.
- [x] Entidade `Organization` + `IOrganizationRepository`
- [x] Rota `/organizations` na Sidebar (sem rota no router)
- [ ] **Criar rota e páginas de Organizations** (listar, cadastrar, editar)
- [ ] Fluxo de onboarding (criar organização ao se registrar)

## Fase 4: Suppliers ✅ (Domain + UI, mock)
**Objetivo:** Cadastro e gestão de fornecedores.
- [x] Entidade `Supplier` + `ISupplierRepository`
- [x] `CreateSupplierUseCase` + `SupplierDTOs`
- [x] `SuppliersListPage` + `SupplierFormPage` (mock)
- [ ] Implementar `SupabaseSupplierRepository` real
- [ ] Editar / deletar fornecedor
- [ ] Página de detalhes do fornecedor

## Fase 5: Products ✅ (Domain + UI, mock)
**Objetivo:** Catálogo de produtos atrelados a fornecedores.
- [x] Entidade `Product` + `IProductRepository`
- [x] `CreateProductUseCase` + `ProductDTOs`
- [x] `ProductsListPage` + `ProductFormPage` (mock)
- [ ] Implementar `SupabaseProductRepository` real
- [ ] Editar / deletar produto
- [ ] Upload de imagem do produto

## Fase 6: Categories ✅ (Domain OK, sem UI)
**Objetivo:** Categorias hierárquicas para produtos.
- [x] Entidade `Category` + `ICategoryRepository`
- [ ] Implementar `SupabaseCategoryRepository`
- [ ] Páginas de CRUD de categorias
- [ ] Árvore hierárquica (parent_id)

## Fase 7: Search ✅ (UI + DTO, mock)
**Objetivo:** Busca inteligente no catálogo.
- [x] `SearchResult` entity + `SearchDTOs`
- [x] `SearchResultsPage` com filtros + add to cart (mock)
- [ ] Implementar busca real (SQL full-text search ou Elasticsearch)
- [ ] Filtros funcionais (categoria, fornecedor, faixa de preço)
- [ ] Paginação real

## Fase 8: Quotations ✅ (Domain + UI, mock)
**Objetivo:** Cotações multicotação com comparação.
- [x] Entidades: `QuotationRequest`, `QuotationItem`, `SupplierQuotation`
- [x] `QuotationCartContext` (carrinho de cotação)
- [x] `QuotationsListPage` com abas **ENVIADAS** e **RECEBIDAS** ✅ Sprint 6
- [x] `NewQuotationPage`, `QuotationComparisonPage` (mock)
- [ ] Implementar repositórios reais (Supabase)
- [ ] Submissão real de cotação (disparar e-mail/notificação)
- [ ] Status workflow: Draft → Open → Closed → Cancelled

## Fase 9: Dashboard ✅ (UI, mock)
**Objetivo:** Visão geral do negócio.
- [x] `DashboardPage` com 5 KPI cards + listas
- [ ] Conectar dados reais do Supabase
- [ ] Gráficos (React Query + Chart library)
- [ ] Métricas por período (filtro data)

## Fase 10: Intelligence ✅ (UI, mock)
**Objetivo:** Analytics e inteligência de compras.
- [x] `IntelligenceDashboardPage` com economia, SLA, ranking, inflação, spend
- [ ] Conectar dados reais
- [ ] Gráficos interativos
- [ ] Exportar relatórios (PDF/CSV)

## Fase 11: Rede de Empresas, Notificações, Chat & FlashPoint ✅ (Sprint 7 — Concluída)
**Objetivo:** Rede de parceiros, central de notificações, chat interno com compliance e utilitário de snapshots rápidos.
- [x] **REDE DE EMPRESAS** — página grid de empresas com filtros e botão Conectar
- [x] **Meus Parceiros** — abas PARCEIROS e CONVITES (Enviados/Recebidos em grid de 3 colunas)
- [x] **Central de Notificações** — sino com badge, painel flutuante, cards por tipo
- [x] **Mensagens B2B (Chat)** — chat com balões de conversa, timestamps e recibos de leitura
- [x] **Motor de Compliance** — analisa e bloqueia automaticamente dados de contato externo, PIX, contas bancárias e desvio de negócios
- [x] **Utilitário FlashPoint** — script `flashpoint.ps1` para backup e restauração instantânea do código da aplicação
- [x] `NotificationContext` com mock data + integração Supabase pronta
- [x] Notificação quando: convite enviado/aceito, cotação recebida, proposta respondida
- [x] **Edge Function** `send-quotation-email` — 3 templates HTML prontos para e-mail real
- [x] Migration SQL: tabelas `companies`, `connection_requests`, `notifications` + RLS + triggers
- [ ] Ativar provedor de e-mail (Resend/SendGrid) e descomentar Edge Function
- [ ] Conectar mensagens com banco de dados real (tabela de mensagens + realtime)

## Fase 12: Purchase Requests ⬜ (Não iniciado)
**Objetivo:** Solicitações de compra internas.
- [ ] Domain: `PurchaseRequest`, `PurchaseRequestItem`
- [ ] Workflow de aprovação (múltiplos níveis)
- [ ] Integração com orçamento
- [ ] UI: listar, criar, aprovar/rejeitar

## Fase 13: AI / ML ⬜ (Não iniciado)
**Objetivo:** Inteligência artificial aplicada a compras.
- [ ] SDK interno `src/sdk/openai/`
- [ ] Previsão de preços
- [ ] Recomendação de fornecedores
- [ ] Chatbot para consultas

## Fase 14: Integrações ⬜ (Não iniciado)
**Objetivo:** Conectar com ERPs e sistemas legados.
- [ ] SDK SAP (`src/sdk/sap/`)
- [ ] SDK TOTVS (`src/sdk/totvs/`)
- [ ] SDK Oracle (`src/sdk/oracle/`)
- [ ] Integração com e-mail/Outlook (`src/sdk/outlook/`)
- [ ] Integração com Teams (`src/sdk/teams/`)

## Fase 15: Reports ⬜ (Não iniciado)
**Objetivo:** Relatórios gerenciais.
- [ ] Módulo `reports` completo
- [ ] Dashboard administrativo (`modules/admin`)
- [ ] Exportação de dados

## Fase 16: Audit & Compliance ⬜ (Não iniciado)
**Objetivo:** Rastreabilidade total.
- [ ] Módulo `audit` (event sourcing)
- [ ] Logs de todas as operações
- [ ] Compliance com políticas de compras

## Fase 17: Notifications ⬜ (Não iniciado — UI implementada na Sprint 6)
**Objetivo:** Notificações em tempo real via Supabase Realtime.
- [x] UI da Central de Notificações (Sprint 6)
- [ ] Subscription Realtime do Supabase
- [ ] E-mail transacional (ativar Edge Function)
- [ ] Push notifications (mobile)

## Fase 18: Mobile ⬜ (Não iniciado)
**Objetivo:** App mobile para aprovações e consultas.
- [ ] React Native ou PWA
- [ ] Aprovação de cotações
- [ ] Consulta de preços

---

## Legenda
✅ = Concluído (pelo menos parcialmente)
⬜ = Não iniciado
🔧 = Em andamento / Parcial

## Pendências Técnicas Imediatas
1. Conectar Login real com Supabase (Auth Guard / PrivateRoute)
2. Implementar repositórios Supabase (remover mocks)
3. Ativar provedor de e-mail e descomentar Edge Function `send-quotation-email`
4. Preencher barrel exports dos módulos
5. Preencher `core/config/` (constants, permissions, roles, features)
6. Testes unitários e de integração


## Fase 2: Identity ✅ (Domain OK, sem Presentation)
**Objetivo:** Usuários e autenticação.
- [x] Entidade `User` + `IAuthUser` + `IAuthRepository`
- [x] `LoginUseCase` + `SupabaseAuthRepository`
- [x] LoginPage (mock — redireciona para dashboard)
- [ ] **Conectar Login real** — integrar `LoginPage` com `LoginUseCase` + `SupabaseAuthRepository`
- [ ] Página de registro de usuário
- [ ] Recuperação de senha
- [ ] Auth guard / PrivateRoute

## Fase 3: Organizations ✅ (Domain OK, sem UI)
**Objetivo:** Multi-tenancy com organizações.
- [x] Entidade `Organization` + `IOrganizationRepository`
- [x] Rota `/organizations` na Sidebar (sem rota no router)
- [ ] **Criar rota e páginas de Organizations** (listar, cadastrar, editar)
- [ ] Fluxo de onboarding (criar organização ao se registrar)

## Fase 4: Suppliers ✅ (Domain + UI, mock)
**Objetivo:** Cadastro e gestão de fornecedores.
- [x] Entidade `Supplier` + `ISupplierRepository`
- [x] `CreateSupplierUseCase` + `SupplierDTOs`
- [x] `SuppliersListPage` + `SupplierFormPage` (mock)
- [ ] Implementar `SupabaseSupplierRepository` real
- [ ] Editar / deletar fornecedor
- [ ] Página de detalhes do fornecedor

## Fase 5: Products ✅ (Domain + UI, mock)
**Objetivo:** Catálogo de produtos atrelados a fornecedores.
- [x] Entidade `Product` + `IProductRepository`
- [x] `CreateProductUseCase` + `ProductDTOs`
- [x] `ProductsListPage` + `ProductFormPage` (mock)
- [ ] Implementar `SupabaseProductRepository` real
- [ ] Editar / deletar produto
- [ ] Upload de imagem do produto

## Fase 6: Categories ✅ (Domain OK, sem UI)
**Objetivo:** Categorias hierárquicas para produtos.
- [x] Entidade `Category` + `ICategoryRepository`
- [ ] Implementar `SupabaseCategoryRepository`
- [ ] Páginas de CRUD de categorias
- [ ] Árvore hierárquica (parent_id)

## Fase 7: Search ✅ (UI + DTO, mock)
**Objetivo:** Busca inteligente no catálogo.
- [x] `SearchResult` entity + `SearchDTOs`
- [x] `SearchResultsPage` com filtros + add to cart (mock)
- [ ] Implementar busca real (SQL full-text search ou Elasticsearch)
- [ ] Filtros funcionais (categoria, fornecedor, faixa de preço)
- [ ] Paginação real

## Fase 8: Quotations ✅ (Domain + UI, mock)
**Objetivo:** Cotações multicotação com comparação.
- [x] Entidades: `QuotationRequest`, `QuotationItem`, `SupplierQuotation`
- [x] `QuotationCartContext` (carrinho de cotação)
- [x] `QuotationsListPage`, `NewQuotationPage`, `QuotationComparisonPage` (mock)
- [ ] Implementar repositórios reais (Supabase)
- [ ] Submissão real de cotação (disparar e-mail/notificação)
- [ ] Status workflow: Draft → Open → Closed → Cancelled

## Fase 9: Dashboard ✅ (UI, mock)
**Objetivo:** Visão geral do negócio.
- [x] `DashboardPage` com 5 KPI cards + listas
- [ ] Conectar dados reais do Supabase
- [ ] Gráficos (React Query + Chart library)
- [ ] Métricas por período (filtro data)

## Fase 10: Intelligence ✅ (UI, mock)
**Objetivo:** Analytics e inteligência de compras.
- [x] `IntelligenceDashboardPage` com economia, SLA, ranking, inflação, spend
- [ ] Conectar dados reais
- [ ] Gráficos interativos
- [ ] Exportar relatórios (PDF/CSV)

## Fase 11: Purchase Requests ⬜ (Não iniciado)
**Objetivo:** Solicitações de compra internas.
- [ ] Domain: `PurchaseRequest`, `PurchaseRequestItem`
- [ ] Workflow de aprovação (múltiplos níveis)
- [ ] Integração com orçamento
- [ ] UI: listar, criar, aprovar/rejeitar

## Fase 12: AI / ML ⬜ (Não iniciado)
**Objetivo:** Inteligência artificial aplicada a compras.
- [ ] SDK interno `src/sdk/openai/`
- [ ] Previsão de preços
- [ ] Recomendação de fornecedores
- [ ] Chatbot para consultas

## Fase 13: Integrações ⬜ (Não iniciado)
**Objetivo:** Conectar com ERPs e sistemas legados.
- [ ] SDK SAP (`src/sdk/sap/`)
- [ ] SDK TOTVS (`src/sdk/totvs/`)
- [ ] SDK Oracle (`src/sdk/oracle/`)
- [ ] Integração com e-mail/Outlook (`src/sdk/outlook/`)
- [ ] Integração com Teams (`src/sdk/teams/`)

## Fase 14: Reports ⬜ (Não iniciado)
**Objetivo:** Relatórios gerenciais.
- [ ] Módulo `reports` completo
- [ ] Dashboard administrativo (`modules/admin`)
- [ ] Exportação de dados

## Fase 15: Audit & Compliance ⬜ (Não iniciado)
**Objetivo:** Rastreabilidade total.
- [ ] Módulo `audit` (event sourcing)
- [ ] Logs de todas as operações
- [ ] Compliance com políticas de compras

## Fase 16: Notifications ⬜ (Não iniciado)
**Objetivo:** Notificações em tempo real.
- [ ] Módulo `notifications`
- [ ] Notificações in-app
- [ ] E-mail transacional
- [ ] Push notifications (mobile)

## Fase 17: Mobile ⬜ (Não iniciado)
**Objetivo:** App mobile para aprovações e consultas.
- [ ] React Native ou PWA
- [ ] Aprovação de cotações
- [ ] Consulta de preços

---

## Legenda
✅ = Concluído (pelo menos parcialmente)
⬜ = Não iniciado
🔧 = Em andamento / Parcial

## Pendências Técnicas Imediatas
1. ~~Corrigir 22 erros de compilação~~ ✅ (resolvido)
2. Criar rotas `/organizations` e `/settings`
3. Conectar Login real com Supabase
4. Implementar repositórios Supabase (remover mocks)
5. Preencher barrel exports dos módulos
6. Preencher `core/config/` (constants, permissions, roles, features)
7. Testes unitários e de integração
