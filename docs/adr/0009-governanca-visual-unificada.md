# ADR 0009 — Padronização Visual Unificada da Governança (Minha Empresa)

## Contexto e Problema
Anteriormente, o módulo de Governança corporativa ("Minha Empresa") exibia comportamentos visuais mistos:
1. As sub-páginas de **Dados da Empresa**, **Delegações Temporárias** e **Logs de Auditoria** eram renderizadas de forma encapsulada com um menu lateral permanente à esquerda, permitindo navegação integrada e contexto fluído.
2. As sub-páginas de **Operadores** e **Segmentos** eram carregadas como rotas independentes de tela cheia (full-width), causando descontinuidade visual, quebrando a visibilidade do menu lateral esquerdo e fragmentando a experiência do operador.

Para sanar isso, determinou-se a unificação do layout estrutural de todo o módulo sob o shell `MinhaEmpresaPage`, garantindo a permanência do menu lateral e alinhamento visual de alta fidelidade.

## Decisão de Arquitetura
1. **Unificação do Layout Shell:**
   Todas as subrotas `/empresa/*` (incluindo `/empresa/operadores` e `/empresa/segmentos`) passam a renderizar o contêiner central `MinhaEmpresaPage` no roteador do App (`src/kernel/router/index.tsx`).
2. **Abstração por Abas Internas:**
   O componente `MinhaEmpresaPage` torna-se a central de renderização dinâmica por aba baseada em `location.pathname`, injetando diretamente no grid da direita os componentes `<OperatorsPage />`, `<SegmentsPage />`, `<DelegationsPage />` e `<AccessLogsPage />`.
3. **Consistência Estética e Alinhamento:**
   * O menu lateral esquerdo permanece 100% visível em todas as seções de governança.
   * Eliminam-se as telas cheias independentes, proporcionando paridade com o layout de Delegações.

## Consequências
* **Positivas:**
  * Navegação rápida, intuitiva e sem recargas completas de layout.
  * Consistência visual e fidelidade estética premium.
  * A governança de multi-tenant se mantém organizada sob um único portal visual de administração.
* **Negativas:**
  * Os componentes de subpáginas acumulam arquivos de estilo internos ligeiramente maiores, contornados no empacotamento otimizado do Vite build.
