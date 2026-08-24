# Relatório de Auditoria e Implementação: B1-R.4F
**Métricas do Dashboard e Transição de Mock para Real**

## 1. Visão Geral
Durante a auditoria e implementação da B1-R.4F, o objetivo principal foi substituir os dados hardcoded/mockados do Dashboard principal (`DashboardPage.tsx`) por consultas reais isoladas ao tenant, e sinalizar claramente os domínios que ainda não foram desenvolvidos no backend.

## 2. Decisão Arquitetural e Abordagem
- **Concorrência e Agregação**: Optou-se por utilizar o cliente do Supabase diretamente dentro do componente com `Promise.all`, consultando as tabelas reais, pois não havia repositórios consolidados para agregar dados por intervalo de datas (`DateRange`).
- **Isolamento de Tenant**: As consultas às tabelas `connection_requests`, `products` e `quotation_requests` são garantidas a nível de query passando explicitamente o `organization_id` do tenant autenticado ou os identificadores relevantes, e sendo reforçadas pelo Row Level Security (RLS) já ativo em produção.

## 3. Mapeamento Semântico e Implementação dos Cards

### 3.1. Fornecedores
- **Status**: ✅ IMPLEMENTADO
- **Tabela**: `public.connection_requests`
- **Semântica**: Total de conexões de parceiros (fornecedores/compradores) que foram aceitas dentro da janela de tempo.
- **Isolamento**: Busca conexões onde o tenant atual é o `requester_company_id` ou `target_company_id`, e `status = 'accepted'`.
- **Drill-down**: Aponta para a listagem real em `/suppliers/network`.

### 3.2. Produtos
- **Status**: ✅ IMPLEMENTADO
- **Tabela**: `public.products`
- **Semântica**: Total de produtos cadastrados pelo tenant autenticado.
- **Isolamento**: `organization_id = get_auth_tenant_id()`
- **Drill-down**: Aponta para o catálogo de materiais em `/products`.

### 3.3. Cotações
- **Status**: ✅ IMPLEMENTADO
- **Tabela**: `public.quotation_requests`
- **Semântica**: Cotações e requisições vinculadas ao tenant, criadas no período avaliado.
- **Isolamento**: `organization_id = get_auth_tenant_id()`
- **Drill-down**: Navegação conectada a `/quotations`.

### 3.4. Pesquisas
- **Status**: ⚠️ UNAVAILABLE — DOMAIN NOT IMPLEMENTED
- **Justificativa**: A plataforma atual permite busca de produtos ou perfis públicos (`SearchResultsPage.tsx`), mas **não há tabela ou mecanismo arquitetural** no Supabase que rastreie, versione ou grave metadados das pesquisas realizadas.
- **Tratamento UI**: O card foi exibido em opacidade reduzida, com o valor bloqueado em `—` e a sub-legenda `Indisponível (TBD)`. O clique foi removido.

### 3.5. Economia (Saving)
- **Status**: ⚠️ UNAVAILABLE — DOMAIN NOT IMPLEMENTED
- **Justificativa**: Não existem regras de negócio codificadas no banco de dados para cálculo transacional seguro de diferença de saving em cotações e faturas. Não há tabelas de BI/financeiras.
- **Tratamento UI**: O valor mockado (`R$ 42K`, `14.5%`) foi completamente removido. O card é exibido como indisponível com valor em `—` para impedir indução ao erro financeiro.

## 4. IntelligenceDashboardPage (Procurement Intelligence)
**Classificação: P1 / P2 - REQUER SUBETAPA.**

A auditoria sobre a rota `IntelligenceDashboardPage.tsx` revelou que **100% dos dados são hardcoded** (ex: Economia Acumulada YTD R$ 1.284.350, Lead Time 4.2 horas). 
No entanto, o componente possui um *Environment Indicator* que falsamente notifica o usuário estar em "Ambiente Real (Supabase)" caso o `.env` de produção esteja habilitado.

Este é um anti-pattern grave, pois a visualização indica leitura conectada de banco de dados enquanto, na realidade, serve informações falsas do mock.
Não foi ampliado escopo na R.4F para corrigir a rota inteira, mas fica registrado como Débito Técnico Crítico para a subsequente etapa.

## 5. Limpeza de Mocks
A estrutura `STATS_BY_RANGE` contendo dados estáticos injetados na memória do componente `DashboardPage.tsx` foi permanentemente removida da árvore de código e do runtime.
